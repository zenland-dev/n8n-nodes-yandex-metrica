import type { INodeProperties } from 'n8n-workflow';

import { crudCommonProperties, crudOperations } from '../shared/crud';

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['segment'], operation: operations },
});

/**
 * Saved segments, the ones the API can create.
 *
 * Metrica keeps two kinds and they are not interchangeable. A segment saved from
 * the interface belongs to the report it was saved in and is invisible here; a
 * segment created through the API has `segment_source: api` and is the only kind
 * these methods return. Somebody looking for the segment they made yesterday in
 * the browser will not find it in Get Many, and that is the API's behaviour, not
 * a gap in this node.
 */
const fields: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		displayOptions: showFor(['create', 'update']),
		description: 'Название сегмента',
	},
	{
		displayName: 'Expression',
		name: 'expression',
		type: 'string',
		default: '',
		displayOptions: showFor(['create', 'update']),
		placeholder: "ym:s:regionCity=='Москва'",
		description:
			'Условие сегмента на языке сегментации Метрики. The same syntax the Segment Filter field on the Report resource takes, and a good way to build one is to segment a report first and copy what worked.',
	},
];

export const description: INodeProperties[] = [
	crudOperations(
		'segment',
		'getMany',
		{
			create: 'Создать сегмент, доступный отчётам и ретаргетингу',
			delete: 'Удалить сегмент',
			get: 'Один сегмент с его выражением',
			getMany:
				'Сегменты счётчика, созданные через API. Ones saved from the Metrica interface are not listed here.',
			update: 'Изменить название или условие сегмента',
		},
		{
			create: 'Create a segment',
			delete: 'Delete a segment',
			get: 'Get a segment',
			getMany: 'Get many segments',
			update: 'Update a segment',
		},
	),
	...crudCommonProperties(
		'segment',
		'segmentId',
		'Segment',
		'Сегмент, с которым работаем. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		'getSegments',
	),
	...fields,
];
