import type { INodeProperties } from 'n8n-workflow';

import { crudCommonProperties, crudOperations } from '../shared/crud';

const WRITE = ['create', 'update'];

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['annotation'], operation: operations },
});

/**
 * Notes pinned to a date on the charts.
 *
 * They change no data at all; they answer the question somebody asks three
 * months later about why traffic moved on a particular Tuesday. Writing one from
 * a workflow is the point: a deploy pipeline or a campaign launch can leave the
 * note itself, which nobody remembers to do by hand.
 */
const fields: INodeProperties[] = [
	{
		displayName: 'Date',
		name: 'date',
		type: 'string',
		default: '',
		displayOptions: showFor(WRITE),
		placeholder: '2026-09-12',
		description: 'Дата примечания, YYYY-MM-DD',
	},
	{
		displayName: 'Time',
		name: 'time',
		type: 'string',
		default: '',
		displayOptions: showFor(WRITE),
		placeholder: '12:00:00',
		description: 'Время внутри даты. Optional; without it the note sits at the start of the day.',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		displayOptions: showFor(WRITE),
		description: 'Заголовок примечания — то, что видно на графике до наведения',
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		default: '',
		displayOptions: showFor(WRITE),
		description: 'Текст примечания, который раскрывается при наведении',
	},
	{
		displayName: 'Group',
		name: 'group',
		type: 'options',
		default: 'A',
		displayOptions: showFor(WRITE),
		options: [
			{ name: 'A', value: 'A' },
			{ name: 'B', value: 'B' },
			{ name: 'C', value: 'C' },
			{ name: 'D', value: 'D' },
			{ name: 'E', value: 'E' },
		],
		description:
			'Группа, которой помечено примечание. Groups are how the interface colours and filters notes, so one group per kind of event — releases in A, campaigns in B — is what makes them readable.',
	},
];

export const description: INodeProperties[] = [
	crudOperations(
		'annotation',
		'getMany',
		{
			create: 'Поставить примечание на дату — релиз, запуск кампании, авария',
			delete: 'Удалить примечание',
			get: 'Одно примечание',
			getMany: 'Все примечания счётчика',
			update: 'Изменить примечание',
		},
		{
			create: 'Create an annotation',
			delete: 'Delete an annotation',
			get: 'Get an annotation',
			getMany: 'Get many annotations',
			update: 'Update an annotation',
		},
	),
	...crudCommonProperties(
		'annotation',
		'annotationId',
		'Annotation',
		'Номер примечания, каким его вернула операция Get Many',
	),
	...fields,
];
