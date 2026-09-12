import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { counterFor, jsonParameter, toItems } from '../../helpers/request';
import { listFrom, metricaApiRequest } from '../../transport';

/**
 * The five uploads Metrica accepts are one upload with five column sets.
 *
 * Offline conversions, calls, chats, advertising costs and visitor parameters
 * all take `multipart/form-data` with a single CSV part named `file`, all answer
 * with an `uploading` record, and all offer the same pair of read methods for
 * checking what happened to it afterwards. The columns differ, and Metrica
 * matches them **by name** — order does not matter, a misspelling invalidates
 * the whole file — so each resource documents its own set and this module knows
 * nothing about them.
 *
 * Nothing here waits for the upload to be processed. Metrica accepts the file
 * and works through it in the background, so the status on the answer is the
 * status at hand-over, not the outcome; a workflow that has to know the outcome
 * reads the uploading back a minute later.
 */

/** The rows to upload, and the two read methods, worded per resource. */
export function uploadRowsProperty(
	resource: string,
	placeholder: string,
	description: string,
): INodeProperties {
	return {
		displayName: 'Rows',
		name: 'rows',
		type: 'json',
		default: '',
		required: true,
		typeOptions: { rows: 5 },
		displayOptions: { show: { resource: [resource], operation: ['upload'] } },
		placeholder,
		description,
	};
}

/** The uploading id, for the operation that reads one back. */
export function uploadingIdProperty(resource: string): INodeProperties {
	return {
		displayName: 'Uploading ID',
		name: 'uploadingId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: [resource], operation: ['get'] } },
		description: 'Номер загрузки, каким его вернула операция Upload',
	};
}

/** A comment stored with the upload, which is all the audit trail there is. */
export function uploadCommentProperty(resource: string): INodeProperties {
	return {
		displayName: 'Comment',
		name: 'comment',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: [resource], operation: ['upload'] } },
		description:
			'Пометка к загрузке, видна в списке загрузок. Worth filling in from a workflow: it is the only way to tell later which run produced which file.',
	};
}

/** Escapes one CSV cell the way Metrica's parser expects. */
function csvCell(value: unknown): string {
	if (value === undefined || value === null) return '';

	const text = typeof value === 'object' ? JSON.stringify(value) : String(value);

	return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Turns the rows into CSV, with the header taken from the rows themselves.
 *
 * The columns are the union of every key in order of first appearance rather
 * than the keys of the first row: a call record that omits an optional column on
 * one line and fills it on the next would otherwise lose the later value
 * silently. A row missing a column is written as an empty cell, which Metrica
 * reads as absent.
 */
export function rowsToCsv(rows: IDataObject[]): string {
	const columns: string[] = [];

	for (const row of rows) {
		for (const key of Object.keys(row)) {
			if (!columns.includes(key)) columns.push(key);
		}
	}

	const lines = [columns.join(',')];

	for (const row of rows) {
		lines.push(columns.map((column) => csvCell(row[column])).join(','));
	}

	return lines.join('\n');
}

/** Reads the Rows field and fails with something better than a parser message. */
export function rowsFor(
	this: IExecuteFunctions,
	itemIndex: number,
	what: string,
): IDataObject[] {
	const parsed = jsonParameter.call(this, 'rows', 'Rows', itemIndex);

	const rows = Array.isArray(parsed) ? (parsed as IDataObject[]) : parsed ? [parsed as IDataObject] : [];

	if (rows.length === 0) {
		throw new NodeOperationError(this.getNode(), `No ${what} to upload`, {
			description:
				'Rows has to be an array of objects, one per line of the file, with the column names as keys. An expression such as {{ $input.all().map(i => i.json) }} turns the incoming items into one.',
			itemIndex,
		});
	}

	return rows;
}

export interface UploadConfig {
	/** Path after `/management/v1/counter/{id}/`, for the upload itself. */
	uploadPath: string;
	/** Path for the list of past uploadings. */
	listPath: string;
	/** Path for one past uploading, which the id is appended to. */
	itemPath: string;
	/** Key the list arrives under. */
	listKey: string;
	/** Name given to the CSV part, which Metrica logs but does not read. */
	filename: string;
}

/** `POST` the CSV, and hand back the uploading record Metrica answers with. */
export async function runUpload(
	this: IExecuteFunctions,
	itemIndex: number,
	config: UploadConfig,
	rows: IDataObject[],
	qs: IDataObject,
): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);

	const payload = (await metricaApiRequest.call(
		this,
		'POST',
		`/management/v1/counter/${counter}/${config.uploadPath}`,
		undefined,
		{ ...qs, comment: this.getNodeParameter('comment', itemIndex, '') },
		{ file: { filename: config.filename, content: rowsToCsv(rows) } },
	)) as IDataObject;

	return toItems(payload.uploading ?? payload, {
		counter_id: Number(counter),
		lines: rows.length,
	});
}

/** The two read methods every upload resource carries. */
export async function runUploadingRead(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
	config: UploadConfig,
): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const base = `/management/v1/counter/${counter}`;

	if (operation === 'getMany') {
		const payload = await metricaApiRequest.call(
			this,
			'GET',
			`${base}/${config.listPath}`,
			undefined,
			undefined,
			{ readOnly: true },
		);

		return listFrom(payload, config.listKey).map((row) => ({ json: row }));
	}

	const id = String(this.getNodeParameter('uploadingId', itemIndex, '') ?? '').replace(/[^0-9]/g, '');

	if (id === '') {
		throw new NodeOperationError(this.getNode(), 'This operation needs an uploading ID', {
			description: 'Fill in Uploading ID — the id Upload returned. Get Many lists the recent ones.',
			itemIndex,
		});
	}

	const payload = (await metricaApiRequest.call(
		this,
		'GET',
		`${base}/${config.itemPath}/${id}`,
		undefined,
		undefined,
		{ readOnly: true },
	)) as IDataObject;

	return toItems(payload.uploading ?? payload, { id: Number(id) });
}
