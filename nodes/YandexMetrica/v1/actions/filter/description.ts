import type { INodeProperties } from 'n8n-workflow';

import { crudCommonProperties, crudOperations } from '../shared/crud';

const WRITE = ['create', 'update'];

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['filter'], operation: operations },
});

/**
 * What the counter refuses to record.
 *
 * A filter decides at collection time, so it is not a report setting that can be
 * undone: traffic excluded by a filter is never stored and cannot be recovered
 * afterwards. That is the difference from a segment, which only narrows what an
 * existing report shows.
 */
const fields: INodeProperties[] = [
	{
		displayName: 'Attribute',
		name: 'attr',
		type: 'options',
		default: 'client_ip',
		displayOptions: showFor(WRITE),
		options: [
			{ name: 'IP Address', value: 'client_ip', description: 'Адрес посетителя' },
			{ name: 'Page Title', value: 'title', description: 'Заголовок страницы' },
			{ name: 'Referer', value: 'referer', description: 'Откуда пришли' },
			{ name: 'URL', value: 'url', description: 'Адрес страницы' },
			{ name: 'Visitor ID', value: 'uniq_id', description: 'Идентификатор посетителя' },
		],
		description: 'По какому полю фильтровать',
	},
	{
		displayName: 'Match',
		name: 'type',
		type: 'options',
		default: 'equal',
		displayOptions: showFor(WRITE),
		options: [
			{ name: 'Contains', value: 'contain' },
			{ name: 'Equals', value: 'equal' },
			{
				name: 'IP Range',
				value: 'interval',
				description: 'Диапазон адресов — заполните Start IP и End IP',
			},
			{ name: 'Matches Regexp', value: 'regexp' },
			{
				name: 'Mirrors Only',
				value: 'only_mirrors',
				description: 'Только основной домен и зеркала, без значения',
			},
			{
				name: 'My Visits',
				value: 'me',
				description: 'Собственные визиты владельца счётчика, без значения',
			},
			{ name: 'Starts With', value: 'start' },
		],
		description: 'Как сравнивать',
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'string',
		default: '',
		displayOptions: showFor(WRITE),
		description: 'Значение для сравнения. Not used by My Visits, Mirrors Only or IP Range.',
	},
	{
		displayName: 'Action',
		name: 'filterAction',
		type: 'options',
		default: 'exclude',
		displayOptions: showFor(WRITE),
		options: [
			{
				name: 'Exclude',
				value: 'exclude',
				description: 'Не записывать подходящие визиты. Irreversible for the data it drops.',
			},
			{
				name: 'Include Only',
				value: 'include',
				description: 'Записывать только подходящие визиты и больше никакие',
			},
		],
		description: 'Что делать с подходящим трафиком',
	},
	{
		displayName: 'Start IP',
		name: 'startIp',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['filter'], operation: WRITE, type: ['interval'] } },
		description: 'Начало диапазона адресов',
	},
	{
		displayName: 'End IP',
		name: 'endIp',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['filter'], operation: WRITE, type: ['interval'] } },
		description: 'Конец диапазона адресов, включительно',
	},
	{
		displayName: 'With Subdomains',
		name: 'withSubdomains',
		type: 'boolean',
		default: false,
		displayOptions: showFor(WRITE),
		description: 'Whether the filter also applies to subdomains of the value',
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
		description:
			'Работает фильтр или выключен. Creating one disabled is the safe way to stage a filter before it starts dropping traffic.',
	},
];

export const description: INodeProperties[] = [
	crudOperations(
		'filter',
		'getMany',
		{
			create:
				'Завести фильтр сбора данных. It starts working at once and what it excludes is not recorded anywhere.',
			delete: 'Удалить фильтр. Data dropped while it was active does not come back.',
			get: 'Один фильтр',
			getMany: 'Все фильтры счётчика',
			update: 'Изменить фильтр или выключить его',
		},
		{
			create: 'Create a filter',
			delete: 'Delete a filter',
			get: 'Get a filter',
			getMany: 'Get many filters',
			update: 'Update a filter',
		},
	),
	...crudCommonProperties(
		'filter',
		'filterId',
		'Filter',
		'Номер фильтра, каким его вернула операция Get Many',
	),
	...fields,
];
