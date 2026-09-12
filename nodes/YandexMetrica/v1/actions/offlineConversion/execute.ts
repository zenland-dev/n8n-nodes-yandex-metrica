import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { unknownOperation } from '../../../../../utils/router';
import type { UploadConfig } from '../shared/upload';
import { rowsFor, runUpload, runUploadingRead } from '../shared/upload';

const CONFIG: UploadConfig = {
	uploadPath: 'offline_conversions/upload',
	listPath: 'offline_conversions/uploadings',
	itemPath: 'offline_conversions/uploading',
	listKey: 'uploadings',
	filename: 'offline-conversions.csv',
};

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'upload') {
		const rows = rowsFor.call(this, itemIndex, 'conversions');

		return await runUpload.call(this, itemIndex, CONFIG, rows, {
			client_id_type: this.getNodeParameter('clientIdType', itemIndex, 'CLIENT_ID'),
		});
	}

	if (operation === 'get' || operation === 'getMany') {
		return await runUploadingRead.call(this, operation, itemIndex, CONFIG);
	}

	throw unknownOperation.call(this, 'Offline Conversion', operation, itemIndex);
}
