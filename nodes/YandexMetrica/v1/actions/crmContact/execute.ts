import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { unknownOperation } from '../../../../../utils/router';
import { counterFor, jsonParameter, toItems } from '../../helpers/request';
import { listFrom, metricaApiRequest } from '../../transport';

/** Reads a JSON array field and refuses an empty one with the field's own name. */
export function arrayParameter(
	this: IExecuteFunctions,
	name: string,
	label: string,
	itemIndex: number,
): IDataObject[] {
	const parsed = jsonParameter.call(this, name, label, itemIndex);
	const rows = (Array.isArray(parsed) ? parsed : parsed ? [parsed] : []) as IDataObject[];

	if (rows.length === 0) {
		throw new NodeOperationError(this.getNode(), `${label} is empty`, {
			description: `${label} has to be an array of objects. An expression such as {{ $input.all().map(i => i.json) }} builds one from the incoming items.`,
			itemIndex,
		});
	}

	return rows;
}

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const base = `/cdp/api/v1/counter/${counter}`;

	switch (operation) {
		case 'upload': {
			const contacts = arrayParameter.call(this, 'rows', 'Contacts', itemIndex);

			const payload = (await metricaApiRequest.call(
				this,
				'POST',
				`${base}/data/contacts/json`,
				{ contacts },
				{ merge_mode: this.getNodeParameter('mergeMode', itemIndex, 'SAVE') },
			)) as IDataObject;

			return toItems(payload.uploading ?? payload, { uploaded: contacts.length });
		}

		case 'createAttributes': {
			const attributes = arrayParameter.call(this, 'attributes', 'Attributes', itemIndex);

			const payload = (await metricaApiRequest.call(
				this,
				'POST',
				`${base}/schema/attributes`,
				{ attributes },
				{ entity_type: this.getNodeParameter('entityType', itemIndex, 'CONTACT') },
			)) as IDataObject;

			return toItems(payload, { created: attributes.length });
		}

		case 'getAttributes': {
			const payload = await metricaApiRequest.call(
				this,
				'GET',
				`${base}/schema/attributes`,
				undefined,
				{ entity_type: this.getNodeParameter('entityType', itemIndex, 'CONTACT') },
				{ readOnly: true },
			);

			return listFrom(payload, 'attributes').map((row) => ({ json: row }));
		}

		case 'getUploadings': {
			const payload = await metricaApiRequest.call(
				this,
				'GET',
				`${base}/last_uploadings`,
				undefined,
				undefined,
				{ readOnly: true },
			);

			return listFrom(payload, 'uploadings').map((row) => ({ json: row }));
		}

		default:
			throw unknownOperation.call(this, 'CRM Contact', operation, itemIndex);
	}
}
