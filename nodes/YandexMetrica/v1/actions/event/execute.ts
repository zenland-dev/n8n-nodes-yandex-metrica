import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { COLLECT_URL } from '../../../../../credentials/YandexMetricaApi.credentials';
import { unknownOperation } from '../../../../../utils/router';
import { counterFor, omitEmpty, pairsFromCollection, toItems } from '../../helpers/request';
import { metricaApiRequest } from '../../transport';

/**
 * The token to sign this hit with.
 *
 * Reading an existing one is deliberate. A counter may hold five tokens and
 * there is no way to retire one from here, so a node that generated its own on
 * every execution would exhaust the counter in five runs and then fail for good.
 * The read costs one extra call, and only when the field is left empty.
 */
async function tokenFor(
	this: IExecuteFunctions,
	counter: string,
	itemIndex: number,
): Promise<string> {
	const chosen = String(this.getNodeParameter('measurementToken', itemIndex, '') ?? '').trim();
	if (chosen !== '') return chosen;

	const payload = (await metricaApiRequest.call(
		this,
		'GET',
		`/management/v1/counter/${counter}`,
		undefined,
		{ field: 'measurement_tokens' },
		{ readOnly: true },
	)) as IDataObject;

	const tokens = ((payload?.counter as IDataObject)?.measurement_tokens ?? []) as string[];

	if (tokens.length === 0) {
		throw new NodeOperationError(this.getNode(), 'This counter has no measurement token', {
			description:
				'Run Event → Generate Token once for this counter, then leave the token field empty and this node will find it. If generating fails, turn Measurement Protocol on first: it is the Measurement Protocol switch under Counter → Update.',
			itemIndex,
		});
	}

	return String(tokens[0]);
}

/**
 * `POST https://mc.yandex.ru/collect` — the one call that leaves the API host.
 *
 * Everything travels in the query string, including the token, which is how the
 * protocol is defined. The answer carries no verdict: Metrica replies the same
 * way whether the hit was attached to a visit, dropped for being more than 12
 * hours late, or dropped because the ClientID was never seen. So the item
 * returned here says what was sent, not what became of it.
 */
async function send(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const clientId = String(this.getNodeParameter('clientId', itemIndex, '') ?? '').trim();

	if (clientId === '') {
		throw new NodeOperationError(this.getNode(), 'This operation needs a ClientID', {
			description:
				'Fill in Client ID with the visitor identifier the site recorded through ym(id, "getClientID"). Without it there is nobody to attach the event to.',
			itemIndex,
		});
	}

	const token = await tokenFor.call(this, counter, itemIndex);
	const type = this.getNodeParameter('type', itemIndex, 'pageview') as string;

	const qs: IDataObject = omitEmpty({
		ms: token,
		tid: counter,
		cid: clientId,
		t: type,
		et: this.getNodeParameter('eventTime', itemIndex, ''),
		ea: type === 'event' ? this.getNodeParameter('goalId', itemIndex, '') : undefined,
		...(this.getNodeParameter('pageFields', itemIndex, {}) as IDataObject),
	});

	Object.assign(qs, pairsFromCollection(this.getNodeParameter('extraQuery', itemIndex, {})));

	const response = await metricaApiRequest.call(this, 'POST', '', undefined, qs, {
		baseURL: COLLECT_URL,
		// The collect endpoint answers with an empty body and a bare 200, not JSON.
		binary: true,
	});

	return [
		{
			json: {
				sent: true,
				counter_id: Number(counter),
				client_id: clientId,
				type,
				// Everything but the token, so a run can be read back without the secret
				// ending up in the execution log.
				parameters: omitEmpty({ ...qs, ms: undefined }),
				response: Buffer.isBuffer(response) ? response.toString('utf8') : response,
			},
		},
	];
}

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);

	switch (operation) {
		case 'send':
			return await send.call(this, itemIndex);

		case 'getTokens': {
			const payload = (await metricaApiRequest.call(
				this,
				'GET',
				`/management/v1/counter/${counter}`,
				undefined,
				{ field: 'measurement_tokens' },
				{ readOnly: true },
			)) as IDataObject;

			const tokens = ((payload?.counter as IDataObject)?.measurement_tokens ?? []) as string[];

			return [{ json: { counter_id: Number(counter), measurement_tokens: tokens } }];
		}

		case 'generateToken': {
			const payload = (await metricaApiRequest.call(
				this,
				'GET',
				`/management/v1/counter/${counter}/measurement/generate`,
			)) as IDataObject;

			return toItems(
				typeof payload?.response === 'string' ? { token: payload.response } : payload,
				{ counter_id: Number(counter) },
			);
		}

		default:
			throw unknownOperation.call(this, 'Event', operation, itemIndex);
	}
}
