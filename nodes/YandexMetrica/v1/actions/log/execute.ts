import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { unknownOperation } from '../../../../../utils/router';
import { counterFor, toItems, toList, toMetricaDate } from '../../helpers/request';
import { BUDGETS, listFrom, metricaApiRequest } from '../../transport';

/** The parameters both Create and Evaluate take, in the names Metrica uses. */
function requestQuery(this: IExecuteFunctions, itemIndex: number): IDataObject {
	return {
		date1: toMetricaDate(this.getNodeParameter('date1', itemIndex, '')),
		date2: toMetricaDate(this.getNodeParameter('date2', itemIndex, '')),
		source: this.getNodeParameter('source', itemIndex, 'visits'),
		fields: toList(this.getNodeParameter('fields', itemIndex, '')).join(','),
		attribution: this.getNodeParameter('attribution', itemIndex, ''),
	};
}

/** The request id for this item, as a bare number. */
function requestIdFor(this: IExecuteFunctions, itemIndex: number): string {
	const id = String(this.getNodeParameter('requestId', itemIndex, '') ?? '').replace(/[^0-9]/g, '');

	if (id === '') {
		throw new NodeOperationError(this.getNode(), 'This operation needs a log request ID', {
			description:
				'Fill in Request ID — the request_id field that Create returned. Get Many lists the ones this counter already has.',
			itemIndex,
		});
	}

	return id;
}

/** `POST /logrequests` — asks for the export; the data is not ready on return. */
async function create(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);

	const payload = (await metricaApiRequest.call(
		this,
		'POST',
		`/management/v1/counter/${counter}/logrequests`,
		undefined,
		requestQuery.call(this, itemIndex),
		{ budget: BUDGETS.logs },
	)) as IDataObject;

	return toItems(payload.log_request ?? payload, { counter_id: Number(counter) });
}

/**
 * `GET /logrequests/evaluate` — will Metrica take this on, and in how many parts.
 *
 * Worth calling before Create for anything wide or long: a request the service
 * refuses still has to be cleaned up, and this one costs no storage at all.
 */
async function evaluate(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);

	const payload = (await metricaApiRequest.call(
		this,
		'GET',
		`/management/v1/counter/${counter}/logrequests/evaluate`,
		undefined,
		requestQuery.call(this, itemIndex),
		{ budget: BUDGETS.logs, readOnly: true },
	)) as IDataObject;

	return toItems(payload.log_request_evaluation ?? payload, { counter_id: Number(counter) });
}

/** `GET /logrequest/{id}` — the status a Wait loop checks, and the part list. */
async function get(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const requestId = requestIdFor.call(this, itemIndex);

	const payload = (await metricaApiRequest.call(
		this,
		'GET',
		`/management/v1/counter/${counter}/logrequest/${requestId}`,
		undefined,
		undefined,
		{ budget: BUDGETS.logs, readOnly: true },
	)) as IDataObject;

	return toItems(payload.log_request ?? payload, { request_id: Number(requestId) });
}

/**
 * `GET /logrequests` — every request this counter holds.
 *
 * Not paginated by Metrica, and the `size` field on each row is the only way to
 * learn how much of the counter's 10 GB is still free: there is no endpoint that
 * reports the remaining quota, so the total is summed here as a convenience.
 */
async function getMany(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);

	const payload = (await metricaApiRequest.call(
		this,
		'GET',
		`/management/v1/counter/${counter}/logrequests`,
		undefined,
		undefined,
		{ budget: BUDGETS.logs, readOnly: true },
	)) as IDataObject;

	const rows = listFrom(payload, 'requests');

	return rows.map((row) => ({ json: row }));
}

/**
 * `GET /logrequest/{id}/part/{n}/download` — one part of a prepared export.
 *
 * The answer is TSV with a header line, not JSON, so it comes back as bytes and
 * is parsed here. Splitting on tabs alone is correct for this format: Metrica
 * escapes tabs and newlines inside values rather than quoting fields, so there
 * is no CSV-style quoting to honour.
 */
async function download(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const requestId = requestIdFor.call(this, itemIndex);
	const part = Number(this.getNodeParameter('partNumber', itemIndex, 0)) || 0;
	const output = this.getNodeParameter('downloadOutput', itemIndex, 'rows') as string;

	const body = (await metricaApiRequest.call(
		this,
		'GET',
		`/management/v1/counter/${counter}/logrequest/${requestId}/part/${part}/download`,
		undefined,
		undefined,
		{ budget: BUDGETS.logs, readOnly: true, binary: true },
	)) as Buffer;

	const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));

	if (output === 'binary') {
		const property = String(this.getNodeParameter('binaryProperty', itemIndex, 'data'));
		const file = await this.helpers.prepareBinaryData(
			buffer,
			`metrica-log-${requestId}-part-${part}.tsv`,
			'text/tab-separated-values',
		);

		return [{ json: { request_id: Number(requestId), part }, binary: { [property]: file } }];
	}

	const text = buffer.toString('utf8');

	if (output === 'raw') {
		return [{ json: { request_id: Number(requestId), part, data: text } }];
	}

	const lines = text.split('\n').filter((line) => line !== '');
	if (lines.length === 0) return [{ json: { request_id: Number(requestId), part, rows: 0 } }];

	const header = lines[0].split('\t');

	return lines.slice(1).map((line) => {
		const cells = line.split('\t');
		const row: IDataObject = {};
		header.forEach((name, index) => {
			row[name] = cells[index] ?? null;
		});

		return { json: row };
	});
}

/** `POST /logrequest/{id}/cancel` and `/clean` — the two ways a request ends. */
async function finish(
	this: IExecuteFunctions,
	itemIndex: number,
	action: 'cancel' | 'clean',
): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const requestId = requestIdFor.call(this, itemIndex);

	const payload = (await metricaApiRequest.call(
		this,
		'POST',
		`/management/v1/counter/${counter}/logrequest/${requestId}/${action}`,
		undefined,
		undefined,
		{ budget: BUDGETS.logs },
	)) as IDataObject;

	return toItems(payload.log_request ?? payload, {
		request_id: Number(requestId),
		[action === 'cancel' ? 'canceled' : 'cleaned']: true,
	});
}

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'create':
			return await create.call(this, itemIndex);
		case 'evaluate':
			return await evaluate.call(this, itemIndex);
		case 'get':
			return await get.call(this, itemIndex);
		case 'getMany':
			return await getMany.call(this, itemIndex);
		case 'download':
			return await download.call(this, itemIndex);
		case 'cancel':
			return await finish.call(this, itemIndex, 'cancel');
		case 'clean':
			return await finish.call(this, itemIndex, 'clean');
		default:
			throw unknownOperation.call(this, 'Log', operation, itemIndex);
	}
}
