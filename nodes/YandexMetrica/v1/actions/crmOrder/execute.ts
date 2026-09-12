import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { unknownOperation } from '../../../../../utils/router';
import { counterFor, jsonParameter, toItems } from '../../helpers/request';
import { listFrom, metricaApiRequest } from '../../transport';
import { arrayParameter } from '../crmContact/execute';
import { rowsToCsv } from '../shared/upload';

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const base = `/cdp/api/v1/counter/${counter}`;

	switch (operation) {
		case 'upload': {
			const orders = arrayParameter.call(this, 'rows', 'Orders', itemIndex);

			const payload = (await metricaApiRequest.call(
				this,
				'POST',
				`${base}/data/orders/json`,
				{ orders },
				{ merge_mode: this.getNodeParameter('mergeMode', itemIndex, 'SAVE') },
			)) as IDataObject;

			return toItems(payload.uploading ?? payload, { uploaded: orders.length });
		}

		case 'uploadSimple': {
			const rows = arrayParameter.call(this, 'simpleRows', 'Rows', itemIndex);

			// The simplified format has no JSON variant: it is a CSV upload, and the
			// delimiter is named rather than left to be guessed, because a file whose
			// values hold commas is read wrong otherwise.
			const payload = (await metricaApiRequest.call(
				this,
				'POST',
				`${base}/data/simple_orders`,
				undefined,
				{
					merge_mode: this.getNodeParameter('mergeMode', itemIndex, 'SAVE'),
					delimiter_type: 'COMMA',
				},
				{ file: { filename: 'simple-orders.csv', content: rowsToCsv(rows) } },
			)) as IDataObject;

			return toItems(payload.uploading ?? payload, { uploaded: rows.length });
		}

		case 'mapStatuses': {
			const statuses = arrayParameter.call(this, 'orderStatuses', 'Order Statuses', itemIndex);

			const payload = (await metricaApiRequest.call(
				this,
				'POST',
				`${base}/schema/order_statuses`,
				{ order_statuses: statuses },
			)) as IDataObject;

			return toItems(payload, { mapped: statuses.length });
		}

		case 'getStatuses': {
			const payload = await metricaApiRequest.call(
				this,
				'GET',
				`${base}/schema/order_statuses`,
				undefined,
				undefined,
				{ readOnly: true },
			);

			return listFrom(payload, 'order_statuses').map((row) => ({ json: row }));
		}

		case 'createProducts': {
			const parsed = jsonParameter.call(this, 'products', 'Products', itemIndex);

			const body = Array.isArray(parsed)
				? { items: parsed, attributes: [] }
				: ((parsed ?? {}) as IDataObject);

			const payload = (await metricaApiRequest.call(
				this,
				'POST',
				`${base}/schema/products`,
				body,
			)) as IDataObject;

			return toItems(payload, { created: true });
		}

		default:
			throw unknownOperation.call(this, 'CRM Order', operation, itemIndex);
	}
}
