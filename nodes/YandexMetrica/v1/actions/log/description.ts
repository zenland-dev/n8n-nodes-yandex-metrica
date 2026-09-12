import type { INodeProperties } from 'n8n-workflow';

import { counterIdProperty } from '../../descriptions/common';

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['log'], operation: operations },
});

const NEEDS_REQUEST = ['get', 'download', 'cancel', 'clean'];

/**
 * Raw rows, one per visit or per pageview, rather than aggregated numbers.
 *
 * Logs API is asynchronous and that shapes the whole resource: a request is
 * created, Metrica prepares it in the background, and only then can the parts be
 * downloaded. Nothing here polls for you — a workflow waits with a Wait node
 * between Create and Get, which is also what keeps the 10 requests a second this
 * API allows from being spent on polling.
 *
 * The storage quota is the part that bites. A counter has 10 GB for prepared
 * logs, downloading does not free it, and a workflow that creates requests and
 * never cleans them stops working once the quota is full. Clean is not optional
 * housekeeping here; it is the last step of the loop.
 */
const operation: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'create',
	displayOptions: { show: { resource: ['log'] } },
	options: [
		{
			name: 'Cancel',
			value: 'cancel',
			action: 'Cancel a log request',
			description:
				'Отменить запрос, который ещё не обработан. A processed one cannot be cancelled, only cleaned.',
		},
		{
			name: 'Clean',
			value: 'clean',
			action: 'Clean a processed log request',
			description:
				'Удалить подготовленные файлы и освободить место. The 10 GB quota is per counter and shared by every integration, so this is the step that keeps the next request possible.',
		},
		{
			name: 'Create',
			value: 'create',
			action: 'Create a log request',
			description: 'Заказать выгрузку за период. Returns immediately with a request ID and status created — the data is not ready yet.',
		},
		{
			name: 'Download',
			value: 'download',
			action: 'Download a part of a log request',
			description:
				'Скачать одну часть готовой выгрузки. Metrica splits large exports into parts; the part count arrives with Get once the status is processed.',
		},
		{
			name: 'Evaluate',
			value: 'evaluate',
			action: 'Check whether a log request is possible',
			description:
				'Узнать заранее, возьмётся ли Метрика за такую выгрузку и на сколько частей её разобьёт. Costs nothing against the storage quota and answers in one call.',
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get a log request',
			description:
				'Статус запроса и, когда он processed, список частей с размерами. This is what a Wait loop checks.',
		},
		{
			name: 'Get Many',
			value: 'getMany',
			action: 'Get many log requests',
			description:
				'Все запросы счётчика с их статусами и размерами. Summing the size field is the only way to find out how much of the 10 GB is left.',
		},
	],
};

const request: INodeProperties[] = [
	{
		displayName: 'Source',
		name: 'source',
		type: 'options',
		default: 'visits',
		displayOptions: showFor(['create', 'evaluate']),
		options: [
			{
				name: 'Hits',
				value: 'hits',
				description: 'Просмотры: отдельные обращения к страницам внутри визитов',
			},
			{
				name: 'Visits',
				value: 'visits',
				description: 'Визиты: сессия целиком, с источником, длительностью и целями',
			},
		],
		description: 'Какой лог выгружать. The two have completely different field sets.',
	},
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'string',
		default: 'ym:s:visitID,ym:s:dateTime,ym:s:lastTrafficSource',
		required: true,
		displayOptions: showFor(['create', 'evaluate']),
		placeholder: 'ym:s:visitID,ym:s:dateTime,ym:s:clientID',
		description:
			'Поля выгрузки через запятую. The whole list is capped at 3000 characters, which is roughly a hundred fields; visits use the ym:s: prefix and hits ym:pv:.',
	},
	{
		displayName: 'Date From',
		name: 'date1',
		type: 'string',
		default: '',
		required: true,
		displayOptions: showFor(['create', 'evaluate']),
		placeholder: '2026-09-01',
		description:
			'Начало периода, YYYY-MM-DD. Today is not available — the data is still arriving — and one request may cover at most a year.',
	},
	{
		displayName: 'Date To',
		name: 'date2',
		type: 'string',
		default: '',
		required: true,
		displayOptions: showFor(['create', 'evaluate']),
		placeholder: '2026-09-07',
		description:
			'Конец периода, включительно, YYYY-MM-DD. Ask for yesterday at the latest; visits keep being updated for about three days after they start.',
	},
	{
		displayName: 'Attribution',
		name: 'attribution',
		type: 'options',
		default: '',
		displayOptions: showFor(['create', 'evaluate']),
		options: [
			{ name: 'Automatic', value: 'automatic' },
			{ name: 'Counter Default', value: '' },
			{ name: 'Cross Device First Click', value: 'cross_device_first' },
			{ name: 'Cross Device Last Click', value: 'cross_device_last' },
			{ name: 'Cross Device Last Significant Click', value: 'cross_device_last_significant' },
			{ name: 'First Click', value: 'first' },
			{ name: 'Last Click', value: 'last' },
			{ name: 'Last Significant Click', value: 'lastsign' },
			{ name: 'Last Yandex Direct Click', value: 'last_yandex_direct_click' },
		],
		description: 'Модель атрибуции для полей источника трафика',
	},
	{
		displayName: 'Request ID',
		name: 'requestId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: showFor(NEEDS_REQUEST),
		description: 'Номер запроса логов, каким его вернула операция Create',
	},
	{
		displayName: 'Part Number',
		name: 'partNumber',
		type: 'number',
		typeOptions: { minValue: 0 },
		default: 0,
		displayOptions: showFor(['download']),
		description:
			'Номер части, с нуля. Get reports how many there are once the request is processed.',
	},
	{
		displayName: 'Output',
		name: 'downloadOutput',
		type: 'options',
		default: 'rows',
		displayOptions: showFor(['download']),
		options: [
			{
				name: 'Binary File',
				value: 'binary',
				description: 'Вложение с TSV-файлом',
			},
			{
				name: 'Raw TSV',
				value: 'raw',
				description: 'Файл как есть, одной строкой — для записи на диск без разбора',
			},
			{
				name: 'Rows',
				value: 'rows',
				description: 'Одна запись n8n на строку лога, поля названы по заголовку',
			},
		],
		description:
			'Как отдать скачанную часть. Rows is the useful default; a part can hold hundreds of thousands of lines, so a whole export may be worth keeping as a file instead.',
	},
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		default: 'data',
		displayOptions: {
			show: { resource: ['log'], operation: ['download'], downloadOutput: ['binary'] },
		},
		description: 'Имя бинарного поля для файла',
	},
];

export const description: INodeProperties[] = [
	operation,
	{ ...counterIdProperty, displayOptions: { show: { resource: ['log'] } } },
	...request,
];
