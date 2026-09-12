import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { unknownOperation } from '../../../../../utils/router';
import { counterFor, jsonParameter, omitEmpty, toItems, toList } from '../../helpers/request';
import { listFrom, metricaApiRequest, metricaApiRequestAllItems } from '../../transport';

/**
 * Turns the node's flat settings into the counter object Metrica expects.
 *
 * The nesting is the service's, not ours, and it is not guessable: the site goes
 * inside `site2`, extra domains inside `mirrors2` as objects rather than
 * strings, session recording inside `webvisor`, ecommerce inside `code_options`
 * beside the tag settings, and the Measurement Protocol switch inside
 * `counter_flags`. A flat field sent at the top level is silently ignored.
 */
function counterPayload(this: IExecuteFunctions, itemIndex: number): IDataObject {
	const settings = this.getNodeParameter('counterFields', itemIndex, {}) as IDataObject;
	const counter: IDataObject = {};

	if (settings.name !== undefined) counter.name = settings.name;
	if (settings.site !== undefined && settings.site !== '') counter.site2 = { site: settings.site };

	const mirrors = toList(settings.mirrors);
	if (mirrors.length > 0) counter.mirrors2 = mirrors.map((site) => ({ site }));

	if (settings.timeZoneName !== undefined && settings.timeZoneName !== '') {
		counter.time_zone_name = settings.timeZoneName;
	}

	if (settings.visitThreshold !== undefined) counter.visit_threshold = settings.visitThreshold;
	if (settings.filterRobots !== undefined) counter.filter_robots = settings.filterRobots;
	if (settings.autogoalsEnabled !== undefined) {
		counter.autogoals_enabled = settings.autogoalsEnabled;
	}

	if (settings.webvisor !== undefined) counter.webvisor = { arch_enabled: settings.webvisor };
	if (settings.ecommerce !== undefined) counter.code_options = { ecommerce: settings.ecommerce };

	if (settings.measurementEnabled !== undefined) {
		counter.counter_flags = { measurement_enabled: settings.measurementEnabled };
	}

	const raw = jsonParameter.call(this, 'counterJson', 'Raw Counter JSON', itemIndex);
	if (raw !== undefined && typeof raw === 'object') Object.assign(counter, raw as IDataObject);

	return counter;
}

/** The label id for this item, as a bare number. */
function labelIdFor(this: IExecuteFunctions, itemIndex: number): string {
	const id = String(this.getNodeParameter('labelId', itemIndex, '') ?? '').replace(/[^0-9]/g, '');

	if (id === '') {
		throw new NodeOperationError(this.getNode(), 'This operation needs a label', {
			description:
				'Pick a label, or set the field to an expression yielding its number. Get Many Labels lists what the account has.',
			itemIndex,
		});
	}

	return id;
}

/** `POST /management/v1/counters`. */
async function create(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const name = String(this.getNodeParameter('name', itemIndex, '') ?? '').trim();
	const site = String(this.getNodeParameter('site', itemIndex, '') ?? '').trim();

	if (name === '' || site === '') {
		throw new NodeOperationError(this.getNode(), 'A counter needs a name and a site', {
			description: 'Metrica requires both before it will create one.',
			itemIndex,
		});
	}

	const counter: IDataObject = {
		name,
		site2: { site },
		...counterPayload.call(this, itemIndex),
	};

	const payload = (await metricaApiRequest.call(
		this,
		'POST',
		'/management/v1/counters',
		{ counter },
		undefined,
	)) as IDataObject;

	return toItems(payload.counter ?? payload, { name, site });
}

/** `GET /management/v1/counter/{id}`. */
async function get(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const field = this.getNodeParameter('field', itemIndex, []) as string[];

	const payload = (await metricaApiRequest.call(
		this,
		'GET',
		`/management/v1/counter/${counter}`,
		undefined,
		// An empty `field` has to be sent as an empty string rather than omitted:
		// left out entirely, Metrica attaches goals, filters, operations and grants
		// to every counter, which is what turns a list of fifty into a megabyte.
		{ field: field.length > 0 ? field.join(',') : '' },
		{ readOnly: true },
	)) as IDataObject;

	return toItems(payload.counter ?? payload, { id: Number(counter) });
}

/** `GET /management/v1/counters`. */
async function getMany(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
	const filters = this.getNodeParameter('listFilters', itemIndex, {}) as IDataObject;
	const field = this.getNodeParameter('field', itemIndex, []) as string[];

	const qs = omitEmpty({
		search_string: filters.searchString,
		label_id: filters.labelId,
		permission: filters.permission,
		status: filters.status,
		favorite: filters.favorite === true ? 1 : undefined,
	});

	qs.field = field.length > 0 ? field.join(',') : '';

	const rows = await metricaApiRequestAllItems.call(this, 'GET', '/management/v1/counters', qs, {
		listKey: 'counters',
		limit: returnAll ? undefined : Math.max(1, limit),
		pageSize: 200,
	});

	return rows.map((row) => ({ json: row }));
}

/** `PUT /management/v1/counter/{id}`. */
async function update(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const changes = counterPayload.call(this, itemIndex);

	if (Object.keys(changes).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Nothing to update', {
			description:
				'Add at least one setting under Counter Settings, or put the fields in Raw Counter JSON.',
			itemIndex,
		});
	}

	const payload = (await metricaApiRequest.call(
		this,
		'PUT',
		`/management/v1/counter/${counter}`,
		{ counter: changes },
	)) as IDataObject;

	return toItems(payload.counter ?? payload, { id: Number(counter), updated: true });
}

/** `DELETE /management/v1/counter/{id}`. */
async function remove(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);

	const payload = await metricaApiRequest.call(
		this,
		'DELETE',
		`/management/v1/counter/${counter}`,
	);

	return toItems(payload, { id: Number(counter), deleted: true });
}

/** `POST` and `DELETE /management/v1/counter/{counterId}/label/{labelId}`. */
async function label(
	this: IExecuteFunctions,
	itemIndex: number,
	attach: boolean,
): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const labelId = labelIdFor.call(this, itemIndex);

	const payload = await metricaApiRequest.call(
		this,
		attach ? 'POST' : 'DELETE',
		`/management/v1/counter/${counter}/label/${labelId}`,
	);

	return toItems(payload, {
		counter_id: Number(counter),
		label_id: Number(labelId),
		attached: attach,
	});
}

/** The five account-level label methods, which share one small body. */
async function labelCrud(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'getManyLabels') {
		const payload = await metricaApiRequest.call(
			this,
			'GET',
			'/management/v1/labels',
			undefined,
			undefined,
			{ readOnly: true },
		);

		return listFrom(payload, 'labels').map((row) => ({ json: row }));
	}

	if (operation === 'createLabel') {
		const name = String(this.getNodeParameter('labelName', itemIndex, '') ?? '').trim();

		const payload = (await metricaApiRequest.call(this, 'POST', '/management/v1/labels', {
			label: { name },
		})) as IDataObject;

		return toItems(payload.label ?? payload, { name });
	}

	const labelId = labelIdFor.call(this, itemIndex);

	if (operation === 'getLabel') {
		const payload = (await metricaApiRequest.call(
			this,
			'GET',
			`/management/v1/label/${labelId}`,
			undefined,
			undefined,
			{ readOnly: true },
		)) as IDataObject;

		return toItems(payload.label ?? payload, { id: Number(labelId) });
	}

	if (operation === 'updateLabel') {
		const name = String(this.getNodeParameter('labelName', itemIndex, '') ?? '').trim();

		const payload = (await metricaApiRequest.call(
			this,
			'PUT',
			`/management/v1/label/${labelId}`,
			{ label: { name } },
		)) as IDataObject;

		return toItems(payload.label ?? payload, { id: Number(labelId), name });
	}

	const payload = await metricaApiRequest.call(
		this,
		'DELETE',
		`/management/v1/label/${labelId}`,
	);

	return toItems(payload, { id: Number(labelId), deleted: true });
}

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'create':
			return await create.call(this, itemIndex);
		case 'get':
			return await get.call(this, itemIndex);
		case 'getMany':
			return await getMany.call(this, itemIndex);
		case 'update':
			return await update.call(this, itemIndex);
		case 'delete':
			return await remove.call(this, itemIndex);
		case 'attachLabel':
			return await label.call(this, itemIndex, true);
		case 'detachLabel':
			return await label.call(this, itemIndex, false);
		case 'createLabel':
		case 'getLabel':
		case 'getManyLabels':
		case 'updateLabel':
		case 'deleteLabel':
			return await labelCrud.call(this, operation, itemIndex);
		default:
			throw unknownOperation.call(this, 'Counter', operation, itemIndex);
	}
}
