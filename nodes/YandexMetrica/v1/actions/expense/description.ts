import type { INodeProperties } from 'n8n-workflow';

import { counterIdProperty } from '../../descriptions/common';
import { uploadCommentProperty, uploadRowsProperty, uploadingIdProperty } from '../shared/upload';

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['expense'], operation: operations },
});

/**
 * The other half of ROI.
 *
 * Metrica knows what every channel earned and nothing about what it cost, unless
 * the channel is Yandex Direct. Everything else — a mailing list, a blogger, a
 * marketplace, a channel with no integration at all — has to be booked here, and
 * only then do the cost-per-acquisition and return-on-investment metrics mean
 * anything.
 *
 * Rows are matched on the UTM tags plus the date, which is also how a correction
 * works: uploading the same day and tags again replaces the figures rather than
 * adding to them. Deleting is a separate method because an overstated cost
 * cannot be fixed by uploading a smaller one on a different day.
 */
const operation: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'upload',
	displayOptions: { show: { resource: ['expense'] } },
	options: [
		{
			name: 'Delete',
			value: 'delete',
			action: 'Delete advertising costs',
			description:
				'Удалить расходы: либо одну строку по дате и меткам, либо всё, что описано в файле',
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get an expense uploading',
			description: 'Статус одной загрузки расходов',
		},
		{
			name: 'Get Many',
			value: 'getMany',
			action: 'Get many expense uploadings',
			description: 'Список прошлых загрузок расходов',
		},
		{
			name: 'Upload',
			value: 'upload',
			action: 'Upload advertising costs',
			description:
				'Загрузить расходы по каналам. Re-uploading the same date and UTM tags overwrites the figures instead of adding to them.',
		},
	],
};

const fields: INodeProperties[] = [
	{
		displayName: 'Provider',
		name: 'provider',
		type: 'string',
		default: 'default',
		displayOptions: showFor(['upload', 'delete']),
		description:
			'Метка источника расходов. Keeping one name per system — one for the mailing tool, another for a marketplace — is what lets each be corrected without touching the rest.',
	},
	uploadRowsProperty(
		'expense',
		'[{ "Date": "2026-09-01", "UTMSource": "newsletter", "UTMMedium": "email", "UTMCampaign": "september", "Expenses": 15000, "Clicks": 420, "Currency": "RUB" }]',
		'Строки файла: массив объектов, по объекту на день и набор меток. Date, UTMSource and Expenses are required; UTMMedium, UTMCampaign, UTMTerm, UTMContent, Clicks and Currency are optional. Expenses is in the currency named by Currency, not in the counter currency.',
	),
	{
		displayName: 'Delete Mode',
		name: 'deleteMode',
		type: 'options',
		default: 'single',
		displayOptions: showFor(['delete']),
		options: [
			{
				name: 'By File',
				value: 'file',
				description: 'Удалить всё, что перечислено в строках ниже',
			},
			{
				name: 'One Line',
				value: 'single',
				description: 'Удалить расходы за дату с указанными метками',
			},
		],
		description: 'Удалять одну запись или список',
	},
	{
		displayName: 'Date',
		name: 'deleteDate',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['expense'], operation: ['delete'], deleteMode: ['single'] } },
		placeholder: '2026-09-01',
		description: 'Дата, за которую удалить расходы, YYYY-MM-DD',
	},
	{
		displayName: 'UTM Tags',
		name: 'deleteTags',
		type: 'collection',
		default: {},
		placeholder: 'Add Tag',
		displayOptions: { show: { resource: ['expense'], operation: ['delete'], deleteMode: ['single'] } },
		description:
			'Метки удаляемой строки. They have to match what was uploaded exactly — a row booked with a UTM Term is not deleted by a request without one.',
		options: [
			{ displayName: 'Traffic Source', name: 'trafficSource', type: 'string', default: '', description: 'Источник трафика' },
			{ displayName: 'Traffic Source Detail', name: 'trafficSourceDetail', type: 'string', default: '', description: 'Уточнение источника' },
			{ displayName: 'UTM Campaign', name: 'UTMCampaign', type: 'string', default: '', description: 'Метка utm_campaign' },
			{ displayName: 'UTM Content', name: 'UTMContent', type: 'string', default: '', description: 'Метка utm_content' },
			{ displayName: 'UTM Medium', name: 'UTMMedium', type: 'string', default: '', description: 'Метка utm_medium' },
			{ displayName: 'UTM Source', name: 'UTMSource', type: 'string', default: '', description: 'Метка utm_source' },
			{ displayName: 'UTM Term', name: 'UTMTerm', type: 'string', default: '', description: 'Метка utm_term' },
		],
	},
	{
		displayName: 'Rows to Delete',
		name: 'deleteRows',
		type: 'json',
		default: '',
		typeOptions: { rows: 4 },
		displayOptions: { show: { resource: ['expense'], operation: ['delete'], deleteMode: ['file'] } },
		placeholder: '[{ "Date": "2026-09-01", "UTMSource": "newsletter" }]',
		description: 'Строки для удаления в том же виде, что и при загрузке',
	},
	uploadCommentProperty('expense'),
	uploadingIdProperty('expense'),
];

export const description: INodeProperties[] = [
	operation,
	{ ...counterIdProperty, displayOptions: { show: { resource: ['expense'] } } },
	...fields,
];
