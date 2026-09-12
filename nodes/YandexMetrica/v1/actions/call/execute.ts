import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { unknownOperation } from '../../../../../utils/router';
import { omitEmpty } from '../../helpers/request';
import type { UploadConfig } from '../shared/upload';
import { rowsFor, runUpload, runUploadingRead } from '../shared/upload';

const CONFIG: UploadConfig = {
	uploadPath: 'offline_conversions/upload_calls',
	listPath: 'offline_conversions/calls_uploadings',
	itemPath: 'offline_conversions/calls_uploading',
	listKey: 'uploadings',
	filename: 'calls.csv',
};

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'upload') {
		const rows = rowsFor.call(this, itemIndex, 'calls');

		return await runUpload.call(
			this,
			itemIndex,
			CONFIG,
			rows,
			omitEmpty({
				client_id_type: this.getNodeParameter('clientIdType', itemIndex, 'CLIENT_ID'),
				new_goal_name: this.getNodeParameter('newGoalName', itemIndex, ''),
			}),
		);
	}

	if (operation === 'get' || operation === 'getMany') {
		return await runUploadingRead.call(this, operation, itemIndex, CONFIG);
	}

	throw unknownOperation.call(this, 'Call', operation, itemIndex);
}
