import type { INodeProperties } from 'n8n-workflow';

import { counterIdProperty } from '../../descriptions/common';

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['crmOrder'], operation: operations },
});

/**
 * Deals from the CRM, and the two schemas they depend on.
 *
 * An order is what turns a visit into money in the reports: it names the contact
 * it belongs to, its status, its revenue and cost, and Metrica walks back from
 * there to the channel that produced the first visit.
 *
 * The status mapping is easy to skip and costly to skip. A CRM's own statuses
 * mean nothing to Metrica until each is mapped to one of its three outcomes —
 * in progress, paid, cancelled — and until then no funnel can tell a won deal
 * from a lost one.
 *
 * The simplified upload exists for the common case where clients and orders come
 * out of the CRM as one flat export. It takes a CSV, creates the contacts it
 * needs, and accepts fewer columns in exchange.
 */
const operation: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'upload',
	displayOptions: { show: { resource: ['crmOrder'] } },
	options: [
		{
			name: 'Create Products',
			value: 'createProducts',
			action: 'Create the product dictionary',
			description:
				'Завести справочник товаров, на которые ссылаются заказы. Without it an order can carry a total but not a basket.',
		},
		{
			name: 'Get Statuses',
			value: 'getStatuses',
			action: 'Get the order status mapping',
			description: 'Как статусы вашей CRM сопоставлены с исходами Метрики',
		},
		{
			name: 'Map Statuses',
			value: 'mapStatuses',
			action: 'Map order statuses',
			description:
				'Сопоставить статусы CRM с исходами Метрики: в работе, оплачен, отменён. Nothing in the funnel works before this is done.',
		},
		{
			name: 'Upload',
			value: 'upload',
			action: 'Upload CRM orders',
			description:
				'Загрузить заказы. Contacts they point at have to be uploaded first, or the orders land with nobody attached.',
		},
		{
			name: 'Upload Simplified',
			value: 'uploadSimple',
			action: 'Upload simplified orders',
			description:
				'Загрузить плоскую выгрузку, где клиент и заказ в одной строке. Metrica creates the contacts itself, at the cost of the fields the full format supports.',
		},
	],
};

const fields: INodeProperties[] = [
	{
		displayName: 'Merge Mode',
		name: 'mergeMode',
		type: 'options',
		default: 'SAVE',
		displayOptions: showFor(['upload', 'uploadSimple']),
		options: [
			{ name: 'Save', value: 'SAVE', description: 'Дополнять существующие записи' },
			{
				name: 'Update',
				value: 'UPDATE',
				description: 'Перезаписывать поля значениями из загрузки',
			},
		],
		description: 'Что делать с заказом, который уже загружали. Matching is by the order identifier.',
	},
	{
		displayName: 'Orders',
		name: 'rows',
		type: 'json',
		default: '',
		required: true,
		typeOptions: { rows: 5 },
		displayOptions: showFor(['upload']),
		// eslint-disable-next-line n8n-nodes-base/node-param-placeholder-miscased-id -- "id" is the field name Metrica requires, not prose
		placeholder: '[{ "id": "704", "client_uniq_id": "J3QQ4-H7H2V", "client_type": "CONTACT", "order_status": "IN_PROGRESS", "revenue": 12000 }]',
		description: 'Массив заказов. Required are the identifier, client_uniq_id and client_type; order_status, create_date_time, update_date_time, finish_date_time, revenue, cost, currency, products, goals, user_comment and attribute_values are optional. Dates are written as YYYY-MM-DD HH:MM:SS in the counter timezone, not as ISO instants.',
	},
	{
		displayName: 'Rows',
		name: 'simpleRows',
		type: 'json',
		default: '',
		required: true,
		typeOptions: { rows: 5 },
		displayOptions: showFor(['uploadSimple']),
		placeholder:
			'[{ "order_id": "704", "client_name": "Иванов И.", "client_email": "ivanov@example.com", "order_revenue": 12000 }]',
		description:
			'Строки плоской выгрузки: массив объектов, по объекту на заказ вместе с его клиентом. Sent as CSV, so the column names have to match the simplified format Metrica documents.',
	},
	{
		displayName: 'Order Statuses',
		name: 'orderStatuses',
		type: 'json',
		default: '',
		required: true,
		typeOptions: { rows: 4 },
		displayOptions: showFor(['mapStatuses']),
		// eslint-disable-next-line n8n-nodes-base/node-param-placeholder-miscased-id -- "id" is the field name Metrica requires, not prose
		placeholder: '[{ "id": "new", "humanized": "Новый", "type": "IN_PROGRESS" }]',
		description: 'Сопоставление статусов. Each entry carries your own status key, a humanized label for the interface, and a type that is IN_PROGRESS, PAID or CANCELLED. A status left unmapped keeps its deals out of the funnel entirely.',
	},
	{
		displayName: 'Products',
		name: 'products',
		type: 'json',
		default: '',
		required: true,
		typeOptions: { rows: 4 },
		displayOptions: showFor(['createProducts']),
		placeholder: '{ "items": [{ "name": "apple", "humanized": "Яблоко" }], "attributes": [] }',
		description:
			'Справочник товаров: items с парами name и humanized, плюс attributes с дополнительными полями товара. A bare array is accepted too and is taken as the items list.',
	},
];

export const description: INodeProperties[] = [
	operation,
	{ ...counterIdProperty, displayOptions: { show: { resource: ['crmOrder'] } } },
	...fields,
];
