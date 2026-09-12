import type { INodeProperties } from 'n8n-workflow';

import { counterIdProperty } from '../../descriptions/common';
import { uploadCommentProperty, uploadRowsProperty, uploadingIdProperty } from '../shared/upload';

/**
 * Calls from a PBX Metrica does not know about.
 *
 * Metrica has its own call tracking, and this is for everything it does not
 * cover: a phone system of your own, or numbers that were never dynamic. The
 * uploaded calls land in the same reports as tracked ones, with duration, hold
 * time and whether anybody picked up.
 *
 * A call is an offline conversion with more columns, which is why it shares the
 * endpoint. The difference worth knowing is that this upload can create the goal
 * it needs on the fly, through New Goal Name, instead of failing on a target
 * that does not exist yet.
 */
const operation: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'upload',
	displayOptions: { show: { resource: ['call'] } },
	options: [
		{
			name: 'Get',
			value: 'get',
			action: 'Get a call uploading',
			description: 'Статус одной загрузки звонков, с разбивкой на динамические и статические',
		},
		{
			name: 'Get Many',
			value: 'getMany',
			action: 'Get many call uploadings',
			description: 'Список прошлых загрузок звонков',
		},
		{
			name: 'Upload',
			value: 'upload',
			action: 'Upload calls',
			description: 'Загрузить звонки из своей телефонии',
		},
	],
};

const fields: INodeProperties[] = [
	{
		displayName: 'Identifier Type',
		name: 'clientIdType',
		type: 'options',
		default: 'CLIENT_ID',
		displayOptions: { show: { resource: ['call'], operation: ['upload'] } },
		options: [
			{ name: 'Client ID', value: 'CLIENT_ID', description: 'Идентификатор посетителя Метрики' },
			{ name: 'User ID', value: 'USER_ID', description: 'Ваш собственный идентификатор' },
			{ name: 'Yclid', value: 'YCLID', description: 'Идентификатор клика Яндекс Директа' },
		],
		description: 'Чем связывать звонок с визитом',
	},
	{
		displayName: 'New Goal Name',
		name: 'newGoalName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['call'], operation: ['upload'] } },
		description:
			'Название цели, которую завести под эти звонки, если её ещё нет. Leave empty when the goal already exists and the file names it in the Target column.',
	},
	uploadRowsProperty(
		'call',
		'[{ "ClientId": "133591247640966458", "DateTime": 1481718166, "PhoneNumber": "+70001234567", "TalkDuration": 140, "HoldDuration": 12, "CallMissed": 0 }]',
		'Строки файла: массив объектов, по объекту на звонок. The identifier column and DateTime are required; PhoneNumber, TalkDuration, HoldDuration, CallMissed, Tag, FirstTimeCaller, URL, StaticCall, Price and Currency are optional. Durations are in seconds and DateTime is a Unix timestamp.',
	),
	uploadCommentProperty('call'),
	uploadingIdProperty('call'),
];

export const description: INodeProperties[] = [
	operation,
	{ ...counterIdProperty, displayOptions: { show: { resource: ['call'] } } },
	...fields,
];
