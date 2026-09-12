import type { INodeProperties } from 'n8n-workflow';

import { counterIdProperty } from '../../descriptions/common';
import { uploadCommentProperty, uploadRowsProperty, uploadingIdProperty } from '../shared/upload';

/**
 * Conversations from messengers, tied back to the visit that started them.
 *
 * Same endpoint as offline conversions with `type=CHATS`, which is why the
 * uploading records show up in the same list. A chat is worth uploading for the
 * same reason a call is: somebody who wrote instead of filling in a form is a
 * lead the site never recorded.
 */
const operation: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'upload',
	displayOptions: { show: { resource: ['chat'] } },
	options: [
		{
			name: 'Get',
			value: 'get',
			action: 'Get a chat uploading',
			description: 'Статус одной загрузки чатов',
		},
		{
			name: 'Get Many',
			value: 'getMany',
			action: 'Get many chat uploadings',
			description:
				'Список загрузок. Metrica keeps chats and offline conversions in one list, so this shows both.',
		},
		{
			name: 'Upload',
			value: 'upload',
			action: 'Upload chats',
			description: 'Загрузить переписки из мессенджеров',
		},
	],
};

const fields: INodeProperties[] = [
	{
		displayName: 'Identifier Type',
		name: 'clientIdType',
		type: 'options',
		default: 'CLIENT_ID',
		displayOptions: { show: { resource: ['chat'], operation: ['upload'] } },
		options: [
			{ name: 'Client ID', value: 'CLIENT_ID', description: 'Идентификатор посетителя Метрики' },
			{ name: 'User ID', value: 'USER_ID', description: 'Ваш собственный идентификатор' },
			{ name: 'Yclid', value: 'YCLID', description: 'Идентификатор клика Яндекс Директа' },
		],
		description: 'Чем связывать переписку с визитом',
	},
	uploadRowsProperty(
		'chat',
		'[{ "ClientId": "133591247640966458", "DateTime": 1481718166, "Target": "CHAT_STARTED" }]',
		'Строки файла: массив объектов, по объекту на переписку. The identifier column and DateTime are required. Column names follow the chat transfer documentation rather than the offline conversion one, even though the endpoint is shared.',
	),
	uploadCommentProperty('chat'),
	uploadingIdProperty('chat'),
];

export const description: INodeProperties[] = [
	operation,
	{ ...counterIdProperty, displayOptions: { show: { resource: ['chat'] } } },
	...fields,
];
