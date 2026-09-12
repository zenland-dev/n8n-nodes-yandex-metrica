import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { unknownOperation } from '../../../../../utils/router';
import { counterFor, jsonParameter, omitEmpty, toItems, toMetricaDate } from '../../helpers/request';
import { metricaApiRequest } from '../../transport';
import type { UploadConfig } from '../shared/upload';
import { rowsFor, rowsToCsv, runUpload, runUploadingRead } from '../shared/upload';

const CONFIG: UploadConfig = {
	uploadPath: 'expense/upload',
	listPath: 'expense/uploadings',
	itemPath: 'expense/uploading',
	listKey: 'uploadings',
	filename: 'expenses.csv',
};

/**
 * `POST /expense/delete` or `/expense/delete_single`.
 *
 * Two different requests for the same intent: a file of rows to remove, sent as
 * multipart like an upload, or one row named by its date and tags, sent as plain
 * JSON. The single-line form is what a correction from a workflow normally
 * wants, and it is exact — a row booked with a UTM Term is not matched by a
 * request that omits one.
 */
async function remove(this: IExecuteFunctions, itemIndex: number): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const provider = this.getNodeParameter('provider', itemIndex, 'default');
	const mode = this.getNodeParameter('deleteMode', itemIndex, 'single') as string;

	if (mode === 'file') {
		const parsed = jsonParameter.call(this, 'deleteRows', 'Rows to Delete', itemIndex);
		const rows = (Array.isArray(parsed) ? parsed : [parsed]) as IDataObject[];

		const payload = (await metricaApiRequest.call(
			this,
			'POST',
			`/management/v1/counter/${counter}/expense/delete`,
			undefined,
			{ provider, comment: this.getNodeParameter('comment', itemIndex, '') },
			{ file: { filename: 'expenses-delete.csv', content: rowsToCsv(rows) } },
		)) as IDataObject;

		return toItems(payload.uploading ?? payload, { deleted_lines: rows.length });
	}

	const tags = this.getNodeParameter('deleteTags', itemIndex, {}) as IDataObject;

	const body = omitEmpty({
		date: toMetricaDate(this.getNodeParameter('deleteDate', itemIndex, '')),
		provider,
		comment: this.getNodeParameter('comment', itemIndex, ''),
		...tags,
	});

	const payload = (await metricaApiRequest.call(
		this,
		'POST',
		`/management/v1/counter/${counter}/expense/delete_single`,
		body,
	)) as IDataObject;

	return toItems(payload.uploading ?? payload, { deleted: true, ...body });
}

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	if (operation === 'upload') {
		const rows = rowsFor.call(this, itemIndex, 'expense rows');

		return await runUpload.call(this, itemIndex, CONFIG, rows, {
			provider: this.getNodeParameter('provider', itemIndex, 'default'),
		});
	}

	if (operation === 'delete') return await remove.call(this, itemIndex);

	if (operation === 'get' || operation === 'getMany') {
		return await runUploadingRead.call(this, operation, itemIndex, CONFIG);
	}

	throw unknownOperation.call(this, 'Advertising Cost', operation, itemIndex);
}
