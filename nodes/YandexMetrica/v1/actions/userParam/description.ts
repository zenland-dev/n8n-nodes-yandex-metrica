import type { INodeProperties } from 'n8n-workflow';

import { counterIdProperty } from '../../descriptions/common';
import { uploadCommentProperty, uploadRowsProperty, uploadingIdProperty } from '../shared/upload';

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['userParam'], operation: operations },
});

/**
 * Facts about a visitor that the site itself never sees.
 *
 * A subscription tier from the billing system, a loyalty level, a segment
 * computed overnight: once uploaded, any report can be split by it and any
 * segment can filter on it. This is the one import that describes people rather
 * than events.
 *
 * The two-step shape is Metrica's and it catches people out. An upload arrives
 * in a pending state and changes nothing until it is confirmed, which is a
 * separate call with the uploading id. A workflow that uploads and walks away
 * leaves the data sitting there unapplied.
 */
const operation: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'upload',
	displayOptions: { show: { resource: ['userParam'] } },
	options: [
		{
			name: 'Confirm',
			value: 'confirm',
			action: 'Confirm a visitor parameter uploading',
			description:
				'Подтвердить загрузку, без чего она не применяется. The step that is easy to forget and leaves the upload doing nothing.',
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get a visitor parameter uploading',
			description: 'Статус одной загрузки параметров',
		},
		{
			name: 'Get Many',
			value: 'getMany',
			action: 'Get many visitor parameter uploadings',
			description: 'Список загрузок параметров посетителей',
		},
		{
			name: 'Upload',
			value: 'upload',
			action: 'Upload visitor parameters',
			description: 'Загрузить параметры посетителей. Confirm has to follow before they take effect.',
		},
	],
};

const fields: INodeProperties[] = [
	{
		displayName: 'Action',
		name: 'uploadAction',
		type: 'options',
		default: 'update',
		displayOptions: showFor(['upload']),
		options: [
			{
				name: 'Delete Keys',
				value: 'delete_keys',
				description: 'Удалить перечисленные параметры у перечисленных посетителей',
			},
			{ name: 'Update', value: 'update', description: 'Записать или перезаписать значения' },
		],
		description: 'Что сделать с параметрами из файла',
	},
	{
		displayName: 'Identifier Type',
		name: 'contentIdType',
		type: 'options',
		default: 'client_id',
		displayOptions: showFor(['upload']),
		options: [
			{ name: 'Client ID', value: 'client_id', description: 'Идентификатор посетителя Метрики' },
			{ name: 'User ID', value: 'user_id', description: 'Ваш собственный идентификатор' },
		],
		description: 'Чем опознавать посетителя в файле',
	},
	uploadRowsProperty(
		'userParam',
		'[{ "client_id": "133591247640966458", "tariff": "pro", "ltv": 48000 }]',
		'Строки файла: массив объектов, по объекту на посетителя. The first column is the identifier — client_id or user_id to match Identifier Type — and every other column becomes a parameter of that name. Nested structure is not supported here: a dotted name such as billing.plan is how a hierarchy is expressed.',
	),
	uploadCommentProperty('userParam'),
	uploadingIdProperty('userParam'),
	{
		displayName: 'Uploading ID',
		name: 'confirmUploadingId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: showFor(['confirm']),
		description: 'Номер загрузки, которую подтвердить — тот, что вернула операция Upload',
	},
];

export const description: INodeProperties[] = [
	operation,
	{ ...counterIdProperty, displayOptions: { show: { resource: ['userParam'] } } },
	...fields,
];
