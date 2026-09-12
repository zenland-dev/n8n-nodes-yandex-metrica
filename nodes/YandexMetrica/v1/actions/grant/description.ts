import type { INodeProperties } from 'n8n-workflow';

import { counterIdProperty, returnAllProperties } from '../../descriptions/common';

const NEEDS_LOGIN = ['create', 'get', 'update', 'delete'];
const WRITE = ['create', 'update'];

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['grant'], operation: operations },
});

/**
 * Who may see a counter, and how much of it.
 *
 * Access is granted to a Yandex login, one at a time, and the counter is the
 * unit — there is no account-wide role. Automating this is what an agency
 * onboarding a client actually needs, and it is also the operation with the
 * shortest fuse in the API: three grants an hour per counter and no more.
 *
 * Public access is a different thing with a similar name. It opens the counter's
 * reports to anyone holding the link, without naming a login, which is why it is
 * two operations of its own rather than a permission value.
 */
const operation: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'getMany',
	displayOptions: { show: { resource: ['grant'] } },
	options: [
		{
			name: 'Create',
			value: 'create',
			action: 'Grant access to a counter',
			description:
				'Выдать доступ логину. Rate-limited to three an hour per counter, so an onboarding that adds ten people has to be spread out.',
		},
		{
			name: 'Delete',
			value: 'delete',
			action: 'Revoke access to a counter',
			description: 'Отозвать доступ у логина',
		},
		{
			name: 'Disable Public Access',
			value: 'deletePublic',
			action: 'Disable public access to a counter',
			description: 'Закрыть публичный доступ по ссылке',
		},
		{
			name: 'Enable Public Access',
			value: 'createPublic',
			action: 'Enable public access to a counter',
			description:
				'Открыть отчёты по ссылке всем, кто её знает. No login is named and nothing is logged about who looked.',
		},
		{ name: 'Get', value: 'get', action: 'Get one access grant', description: 'Доступ одного логина' },
		{
			name: 'Get Many',
			value: 'getMany',
			action: 'Get many access grants',
			description: 'Все выданные доступы к счётчику',
		},
		{
			name: 'Get Own Access',
			value: 'getMine',
			action: 'Get own access to a counter',
			description:
				'Какой доступ у владельца токена. The cheapest way to find out whether a workflow may write to a counter before it tries.',
		},
		{
			name: 'Update',
			value: 'update',
			action: 'Update an access grant',
			description: 'Изменить уровень доступа логина',
		},
	],
};

const fields: INodeProperties[] = [
	{
		displayName: 'User Login',
		name: 'userLogin',
		type: 'string',
		default: '',
		required: true,
		displayOptions: showFor(NEEDS_LOGIN),
		placeholder: 'ivanov',
		description:
			'Логин на Яндексе, которому выдаётся доступ. The login, not the email address — for a login tied to a domain the whole address is the login.',
	},
	{
		displayName: 'Permission',
		name: 'perm',
		type: 'options',
		default: 'view',
		displayOptions: showFor([...WRITE, 'createPublic']),
		options: [
			{
				name: 'Analyst',
				value: 'analyst',
				description: 'Читать отчёты вместе с данными, закрытыми для гостей',
			},
			{
				name: 'Analyst With Access Filter',
				value: 'analyst_access_filter',
				description: 'Аналитик, но в пределах назначенного фильтра доступа',
			},
			{ name: 'Edit', value: 'edit', description: 'Читать и менять настройки счётчика' },
			{
				name: 'Public Stats',
				value: 'public_stat',
				description: 'Публичный доступ к отчётам по ссылке',
			},
			{ name: 'View', value: 'view', description: 'Читать отчёты' },
		],
		description: 'Что позволено этому доступу',
	},
	{
		displayName: 'Comment',
		name: 'comment',
		type: 'string',
		default: '',
		displayOptions: showFor(WRITE),
		description: 'Пометка, зачем выдан доступ — видна в списке доступов счётчика',
	},
	{
		displayName: 'Partner Data Access',
		name: 'partnerDataAccess',
		type: 'boolean',
		default: false,
		displayOptions: showFor(WRITE),
		description: 'Whether this login may also see the partner data attached to the counter',
	},
];

export const description: INodeProperties[] = [
	operation,
	{ ...counterIdProperty, displayOptions: { show: { resource: ['grant'] } } },
	...fields,
	...returnAllProperties('grant', ['getMany']),
];
