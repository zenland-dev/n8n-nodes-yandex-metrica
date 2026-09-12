import type { INodeProperties } from 'n8n-workflow';

import { crudCommonProperties, crudOperations } from '../shared/crud';

const WRITE = ['create', 'update'];

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['operation'], operation: operations },
});

/**
 * Rewrites applied to an address before it is recorded.
 *
 * The point is report readability: without cutting the UTM parameters off, one
 * page appears in a report as a hundred rows that differ only by campaign. Like
 * a filter, an operation runs at collection time and the original value is not
 * kept, so a rule that cuts too much cannot be undone for data already gathered.
 */
const fields: INodeProperties[] = [
	{
		displayName: 'Action',
		name: 'operationAction',
		type: 'options',
		default: 'cut_parameter',
		displayOptions: showFor(WRITE),
		options: [
			{
				name: 'Cut All Parameters',
				value: 'cut_all_parameters',
				description: 'Убрать всю строку запроса',
			},
			{ name: 'Cut Fragment', value: 'cut_fragment', description: 'Убрать якорь после решётки' },
			{
				name: 'Cut Parameter',
				value: 'cut_parameter',
				description: 'Убрать один параметр запроса — его имя идёт в поле Value',
			},
			{
				name: 'Merge HTTP and HTTPS',
				value: 'merge_https_and_http',
				description: 'Считать http и https одним адресом',
			},
			{
				name: 'Replace Domain',
				value: 'replace_domain',
				description: 'Заменить домен на указанный в поле Value',
			},
			{
				name: 'To Lower Case',
				value: 'to_lower',
				description: 'Привести адрес к нижнему регистру',
			},
		],
		description: 'Что сделать с адресом',
	},
	{
		displayName: 'Attribute',
		name: 'attr',
		type: 'options',
		default: 'url',
		displayOptions: showFor(WRITE),
		options: [
			{ name: 'Referer', value: 'referer', description: 'Адрес источника перехода' },
			{ name: 'URL', value: 'url', description: 'Адрес страницы' },
		],
		description: 'Какое поле переписывать',
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'string',
		default: '',
		displayOptions: showFor(WRITE),
		placeholder: 'utm_source',
		description:
			'Аргумент операции: имя параметра для Cut Parameter, домен для Replace Domain. The other four actions take none.',
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'active',
		displayOptions: showFor(WRITE),
		options: [
			{ name: 'Active', value: 'active' },
			{ name: 'Disabled', value: 'disabled' },
		],
		description: 'Работает операция или выключена',
	},
];

export const description: INodeProperties[] = [
	crudOperations(
		'operation',
		'getMany',
		{
			create:
				'Завести операцию над адресами. It applies to data arriving from now on, not to what is already stored.',
			delete: 'Удалить операцию',
			get: 'Одна операция',
			getMany: 'Все операции счётчика',
			update: 'Изменить операцию или выключить её',
		},
		{
			create: 'Create an operation',
			delete: 'Delete an operation',
			get: 'Get an operation',
			getMany: 'Get many operations',
			update: 'Update an operation',
		},
	),
	...crudCommonProperties(
		'operation',
		'operationId',
		'Operation',
		'Номер операции, каким его вернула операция Get Many',
	),
	...fields,
];
