import type { INodeProperties } from 'n8n-workflow';

import { counterIdProperty } from '../../descriptions/common';
import { uploadCommentProperty, uploadRowsProperty, uploadingIdProperty } from '../shared/upload';

/**
 * What happened after the browser closed.
 *
 * A deal signed by phone a week after the visit is invisible to Metrica until it
 * is uploaded here, and once it is, every report can attribute it to the channel
 * that produced the visit. That is the whole of end-to-end analytics in one
 * method.
 *
 * The identifier is the part that decides whether it works. ClientId is
 * Metrica's own visitor id, read from the page with `ym(id, 'getClientID')` and
 * stored alongside the lead; UserId is your own account id, which only matches
 * if the site also reports it to Metrica; Yclid is the click id Yandex Direct
 * appends to the landing URL. A row whose identifier was never seen by the
 * counter is accepted and then quietly attributed to nothing.
 */
const operation: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'upload',
	displayOptions: { show: { resource: ['offlineConversion'] } },
	options: [
		{
			name: 'Get',
			value: 'get',
			action: 'Get an offline conversion uploading',
			description:
				'Статус одной загрузки. This is where a file that was accepted but rejected row by row shows up.',
		},
		{
			name: 'Get Many',
			value: 'getMany',
			action: 'Get many offline conversion uploadings',
			description: 'Список прошлых загрузок офлайн-конверсий',
		},
		{
			name: 'Upload',
			value: 'upload',
			action: 'Upload offline conversions',
			description:
				'Загрузить конверсии, случившиеся вне сайта. Metrica takes the file and processes it in the background, so a green answer means accepted, not applied.',
		},
	],
};

const fields: INodeProperties[] = [
	{
		displayName: 'Identifier Type',
		name: 'clientIdType',
		type: 'options',
		default: 'CLIENT_ID',
		displayOptions: { show: { resource: ['offlineConversion'], operation: ['upload'] } },
		options: [
			{
				name: 'Client ID',
				value: 'CLIENT_ID',
				description: 'Идентификатор посетителя Метрики, из ym(counter, "getClientID") на сайте',
			},
			{
				name: 'User ID',
				value: 'USER_ID',
				description: 'Ваш собственный идентификатор, если сайт передаёт его в Метрику',
			},
			{
				name: 'Yclid',
				value: 'YCLID',
				description: 'Идентификатор клика Яндекс Директа из адреса посадочной страницы',
			},
		],
		description:
			'Чем связывать конверсию с визитом. The column in the file has to match: ClientId, UserId or Yclid respectively.',
	},
	uploadRowsProperty(
		'offlineConversion',
		'[{ "ClientId": "133591247640966458", "Target": "ORDER", "DateTime": 1481718166, "Price": 12000, "Currency": "RUB" }]',
		'Строки файла: массив объектов, по объекту на конверсию. Required columns are the identifier (ClientId, UserId or Yclid), Target with the goal identifier, and DateTime as a Unix timestamp; Price and Currency are optional. Metrica matches columns by name, so a misspelling invalidates the whole upload rather than one field.',
	),
	uploadCommentProperty('offlineConversion'),
	uploadingIdProperty('offlineConversion'),
];

export const description: INodeProperties[] = [
	operation,
	{ ...counterIdProperty, displayOptions: { show: { resource: ['offlineConversion'] } } },
	...fields,
];
