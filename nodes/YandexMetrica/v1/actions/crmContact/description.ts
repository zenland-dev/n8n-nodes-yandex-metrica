import type { INodeProperties } from 'n8n-workflow';

import { counterIdProperty } from '../../descriptions/common';

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['crmContact'], operation: operations },
});

/**
 * People from the CRM, so that orders have somebody to belong to.
 *
 * This is Metrica's CDP rather than the management API, and it lives under a
 * different path on the same host with the same token. A contact is matched to
 * the site's own visitors by whatever identifies it: the Metrica client ids the
 * site recorded, or a phone or email hashed to MD5 for the cases where the
 * plain value must not leave the CRM.
 *
 * Contacts go first. An order pointing at a contact that has not been uploaded
 * is accepted and then has nobody to attach to, which is the usual reason an
 * end-to-end funnel comes out empty.
 */
const operation: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'upload',
	displayOptions: { show: { resource: ['crmContact'] } },
	options: [
		{
			name: 'Create Attributes',
			value: 'createAttributes',
			action: 'Create contact attributes',
			description:
				'Завести пользовательские поля контактов. A field has to exist before an upload can carry it; an unknown attribute is rejected rather than created on the fly.',
		},
		{
			name: 'Get Attributes',
			value: 'getAttributes',
			action: 'Get the CRM attribute schema',
			description: 'Все поля контактов и заказов — системные и заведённые вами',
		},
		{
			name: 'Get Uploadings',
			value: 'getUploadings',
			action: 'Get recent CRM uploadings',
			description:
				'Последние загрузки CRM-данных с их статусами проверки. Covers orders as well as contacts.',
		},
		{
			name: 'Upload',
			value: 'upload',
			action: 'Upload CRM contacts',
			description: 'Загрузить клиентов из CRM',
		},
	],
};

const fields: INodeProperties[] = [
	{
		displayName: 'Merge Mode',
		name: 'mergeMode',
		type: 'options',
		default: 'SAVE',
		displayOptions: showFor(['upload']),
		options: [
			{
				name: 'Save',
				value: 'SAVE',
				description: 'Дополнять существующие записи, оставляя незаполненные поля как были',
			},
			{
				name: 'Update',
				value: 'UPDATE',
				description: 'Перезаписывать поля значениями из загрузки',
			},
		],
		description:
			'Что делать с контактом, который уже есть. Matching is by uniq_id, so re-uploading the same identifier updates rather than duplicates either way.',
	},
	{
		displayName: 'Contacts',
		name: 'rows',
		type: 'json',
		default: '',
		required: true,
		typeOptions: { rows: 5 },
		displayOptions: showFor(['upload']),
		placeholder:
			'[{ "uniq_id": "J3QQ4-H7H2V", "name": "Иванов И.", "emails": ["ivanov@example.com"], "client_ids": [133591247640966458] }]',
		description:
			'Массив контактов. Only uniq_id is required, and it is your CRM\'s own identifier; name, emails, phones, emails_md5, phones_md5, client_ids, birth_date, create_date_time and attribute_values are optional. Use the md5 variants when the plain contact details must not leave your systems — Metrica matches on them just as well.',
	},
	{
		displayName: 'Attributes',
		name: 'attributes',
		type: 'json',
		default: '',
		required: true,
		typeOptions: { rows: 4 },
		displayOptions: showFor(['createAttributes']),
		placeholder:
			'[{ "name": "loyalty_tier", "type_name": "text", "humanized": "Уровень лояльности", "multivalued": false }]',
		description:
			'Поля, которые завести. Each needs a name, a type_name and a humanized label; multivalued decides whether one contact may hold several values of it.',
	},
	{
		displayName: 'Entity Type',
		name: 'entityType',
		type: 'options',
		default: 'CONTACT',
		displayOptions: showFor(['createAttributes', 'getAttributes']),
		options: [
			{ name: 'Contact', value: 'CONTACT', description: 'Поля клиентов' },
			{ name: 'Order', value: 'ORDER', description: 'Поля заказов' },
		],
		description: 'К чему относятся поля',
	},
];

export const description: INodeProperties[] = [
	operation,
	{ ...counterIdProperty, displayOptions: { show: { resource: ['crmContact'] } } },
	...fields,
];
