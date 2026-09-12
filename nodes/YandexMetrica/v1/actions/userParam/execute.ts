import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { unknownOperation } from '../../../../../utils/router';
import { counterFor, toItems } from '../../helpers/request';
import { metricaApiRequest } from '../../transport';
import type { UploadConfig } from '../shared/upload';
import { rowsFor, runUpload, runUploadingRead } from '../shared/upload';

const CONFIG: UploadConfig = {
	uploadPath: 'user_params/uploadings/upload',
	listPath: 'user_params/uploadings',
	itemPath: 'user_params/uploading',
	listKey: 'uploadings',
	filename: 'user-params.csv',
};

/** `POST /user_params/uploading/{id}/confirm` — the step that applies the file. */
async function confirm(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const id = String(this.getNodeParameter('confirmUploadingId', itemIndex, '') ?? '').replace(
		/[^0-9]/g,
		'',
	);

	if (id === '') {
		throw new NodeOperationError(this.getNode(), 'This operation needs an uploading ID', {
			description:
				'Fill in Uploading ID with the id Upload returned. Until an uploading is confirmed the parameters in it are stored but not applied to anybody.',
			itemIndex,
		});
	}

	const payload = (await metricaApiRequest.call(
		this,
		'POST',
		`/management/v1/counter/${counter}/user_params/uploading/${id}/confirm`,
	)) as IDataObject;

	return toItems(payload.uploading ?? payload, { id: Number(id), confirmed: true });
}

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'upload') {
		const rows = rowsFor.call(this, itemIndex, 'visitor parameters');

		return await runUpload.call(this, itemIndex, CONFIG, rows, {
			action: this.getNodeParameter('uploadAction', itemIndex, 'update'),
			content_id_type: this.getNodeParameter('contentIdType', itemIndex, 'client_id'),
		});
	}

	if (operation === 'confirm') return await confirm.call(this, itemIndex);

	if (operation === 'get' || operation === 'getMany') {
		return await runUploadingRead.call(this, operation, itemIndex, CONFIG);
	}

	throw unknownOperation.call(this, 'Visitor Parameter', operation, itemIndex);
}
