import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { unknownOperation } from '../../../../../utils/router';
import type { UploadConfig } from '../shared/upload';
import { rowsFor, runUpload, runUploadingRead } from '../shared/upload';

/**
 * Chats ride on the offline conversion endpoint.
 *
 * `type=CHATS` is the only thing that separates them, and the uploading records
 * come back from the same two read methods — which is why Get Many here lists
 * offline conversions as well. There is no chat-only list to ask for.
 */
const CONFIG: UploadConfig = {
	uploadPath: 'offline_conversions/upload',
	listPath: 'offline_conversions/uploadings',
	itemPath: 'offline_conversions/uploading',
	listKey: 'uploadings',
	filename: 'chats.csv',
};

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'upload') {
		const rows = rowsFor.call(this, itemIndex, 'chats');

		return await runUpload.call(this, itemIndex, CONFIG, rows, {
			type: 'CHATS',
			client_id_type: this.getNodeParameter('clientIdType', itemIndex, 'CLIENT_ID'),
		});
	}

	if (operation === 'get' || operation === 'getMany') {
		return await runUploadingRead.call(this, operation, itemIndex, CONFIG);
	}

	throw unknownOperation.call(this, 'Chat', operation, itemIndex);
}
