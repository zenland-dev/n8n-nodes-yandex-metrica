import type { INodeProperties } from 'n8n-workflow';

import { counterIdProperty, returnAllProperties } from '../../descriptions/common';

const NEEDS_COUNTER = ['delete', 'get', 'update', 'attachLabel', 'detachLabel'];
const LABEL_WRITE = ['createLabel', 'updateLabel'];
const NEEDS_LABEL = ['attachLabel', 'detachLabel', 'deleteLabel', 'getLabel', 'updateLabel'];

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['counter'], operation: operations },
});

/**
 * The counter itself, and the labels counters are filed under.
 *
 * Labels live on the account rather than on a counter — one label can be hung on
 * many counters, and an agency uses them to separate clients — which is why
 * creating a label and attaching it are two different operations here. They
 * share this resource because a label has no meaning apart from the counters it
 * groups.
 */
const operation: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'getMany',
	displayOptions: { show: { resource: ['counter'] } },
	options: [
		{
			name: 'Attach Label',
			value: 'attachLabel',
			action: 'Attach a label to a counter',
			description: 'Повесить метку на счётчик',
		},
		{
			name: 'Create',
			value: 'create',
			action: 'Create a counter',
			description:
				'Завести счётчик. The tag still has to be put on the site afterwards; this only creates the counter and its number.',
		},
		{
			name: 'Create Label',
			value: 'createLabel',
			action: 'Create a label',
			description: 'Создать метку на аккаунте',
		},
		{
			name: 'Delete',
			value: 'delete',
			action: 'Delete a counter',
			description:
				'Удалить счётчик. It goes to a deleted state rather than vanishing, and Metrica can restore it for a while — through the interface, since this node does not carry the undelete method.',
		},
		{
			name: 'Delete Label',
			value: 'deleteLabel',
			action: 'Delete a label',
			description: 'Удалить метку с аккаунта вместе со всеми её привязками',
		},
		{
			name: 'Detach Label',
			value: 'detachLabel',
			action: 'Detach a label from a counter',
			description: 'Снять метку со счётчика, саму метку не удаляя',
		},
		{
			name: 'Get',
			value: 'get',
			action: 'Get a counter',
			description:
				'Настройки счётчика. By default only the basics; Include asks for goals, filters, grants and the rest.',
		},
		{
			name: 'Get Label',
			value: 'getLabel',
			action: 'Get a label',
			description: 'Одна метка по её номеру',
		},
		{
			name: 'Get Many',
			value: 'getMany',
			action: 'Get many counters',
			description:
				'Счётчики, доступные аккаунту, свои и чужие. This is the list that fills the counter dropdowns elsewhere in this node.',
		},
		{
			name: 'Get Many Labels',
			value: 'getManyLabels',
			action: 'Get many labels',
			description: 'Все метки аккаунта',
		},
		{
			name: 'Update',
			value: 'update',
			action: 'Update a counter',
			description:
				'Изменить настройки счётчика. Only the fields sent are touched, so the flags left alone keep their values.',
		},
		{
			name: 'Update Label',
			value: 'updateLabel',
			action: 'Update a label',
			description: 'Переименовать метку',
		},
	],
};

const counterFields: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: showFor(['create']),
		description: 'Название счётчика, каким его видно в списке Метрики',
	},
	{
		displayName: 'Site',
		name: 'site',
		type: 'string',
		default: '',
		required: true,
		displayOptions: showFor(['create']),
		placeholder: 'example.com',
		description:
			'Основной домен сайта, без протокола. Metrica stores it under site2.site and uses it to decide what counts as an internal transition.',
	},
	{
		displayName: 'Counter Settings',
		name: 'counterFields',
		type: 'collection',
		default: {},
		placeholder: 'Add Setting',
		displayOptions: showFor(['create', 'update']),
		description: 'Настройки счётчика, которые нужно задать или изменить',
		options: [
			{
				displayName: 'Autogoals',
				name: 'autogoalsEnabled',
				type: 'boolean',
				default: false,
				description: 'Whether Metrica may create goals for the counter on its own',
			},
			{
				displayName: 'Ecommerce',
				name: 'ecommerce',
				type: 'boolean',
				default: false,
				description: 'Whether to read the ecommerce data layer from the page',
			},
			{
				displayName: 'Filter Robots',
				name: 'filterRobots',
				type: 'options',
				default: 1,
				options: [
					{ name: 'By Rules Only', value: 1 },
					{ name: 'By Rules and Behaviour', value: 2 },
				],
				description: 'Как отсеивать роботов',
			},
			{
				displayName: 'Measurement Protocol',
				name: 'measurementEnabled',
				type: 'boolean',
				default: false,
				description:
					'Whether server-side events may be sent to this counter. The Event resource needs this on, and turning it on here is the only way to do it through the API.',
			},
			{
				displayName: 'Mirrors',
				name: 'mirrors',
				type: 'string',
				default: '',
				placeholder: 'www.example.com, example.ru',
				description:
					'Дополнительные домены через запятую. A visit moving between the main domain and a mirror stays one visit; without the mirror it becomes two with a referral in between.',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Название счётчика',
			},
			{
				displayName: 'Site',
				name: 'site',
				type: 'string',
				default: '',
				description: 'Основной домен сайта',
			},
			{
				displayName: 'Timezone',
				name: 'timeZoneName',
				type: 'string',
				default: '',
				placeholder: 'Europe/Moscow',
				description: 'Часовой пояс, в котором счётчик считает сутки',
			},
			{
				displayName: 'Visit Threshold',
				name: 'visitThreshold',
				type: 'number',
				typeOptions: { minValue: 60 },
				default: 1800,
				description:
					'Таймаут визита в секундах. A visit ends after this much inactivity; the Measurement Protocol uses the same window when deciding whether an event joins an existing visit.',
			},
			{
				displayName: 'Webvisor',
				name: 'webvisor',
				type: 'boolean',
				default: false,
				description: 'Whether to record sessions with Вебвизор',
			},
		],
	},
	{
		displayName: 'Raw Counter JSON',
		name: 'counterJson',
		type: 'json',
		default: '',
		typeOptions: { rows: 3 },
		displayOptions: showFor(['create', 'update']),
		placeholder: '{ "gdpr_agreement_accepted": 1 }',
		description:
			'Поля счётчика, которых нет среди настроек выше. A counter has some seventy of them and this node offers the ones workflows actually set; anything here is merged into the counter object last and wins.',
	},
];

const listFilters: INodeProperties = {
	displayName: 'Filters',
	name: 'listFilters',
	type: 'collection',
	default: {},
	placeholder: 'Add Filter',
	displayOptions: showFor(['getMany']),
	description: 'Чем сузить список счётчиков',
	options: [
		{
			displayName: 'Favourite Only',
			name: 'favorite',
			type: 'boolean',
			default: false,
			description: 'Whether to list only the counters marked as favourites',
		},
		{
			displayName: 'Label Name or ID',
			name: 'labelId',
			type: 'options',
			typeOptions: { loadOptionsMethod: 'getLabels' },
			default: '',
			description:
				'Только счётчики с этой меткой. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		},
		{
			displayName: 'Permission',
			name: 'permission',
			type: 'options',
			default: 'own',
			options: [
				{ name: 'Own', value: 'own', description: 'Счётчики, которыми аккаунт владеет' },
				{ name: 'Guest', value: 'view', description: 'Счётчики, к которым выдан доступ' },
			],
			description: 'Свои счётчики или те, куда пустили гостем',
		},
		{
			displayName: 'Search String',
			name: 'searchString',
			type: 'string',
			default: '',
			description: 'Подстрока в названии или домене счётчика',
		},
		{
			displayName: 'Status',
			name: 'status',
			type: 'options',
			default: 'Active',
			options: [
				{ name: 'Active', value: 'Active' },
				{ name: 'Deleted', value: 'Deleted' },
			],
			description: 'Действующие счётчики или удалённые',
		},
	],
};

const includeField: INodeProperties = {
	displayName: 'Include',
	name: 'field',
	type: 'multiOptions',
	default: [],
	displayOptions: showFor(['get', 'getMany']),
	options: [
		{ name: 'Counter Flags', value: 'counter_flags' },
		{ name: 'Filters', value: 'filters' },
		{ name: 'Goals', value: 'goals' },
		{ name: 'Grants', value: 'grants' },
		{ name: 'Labels', value: 'labels' },
		{ name: 'Measurement Tokens', value: 'measurement_tokens' },
		{ name: 'Mirrors', value: 'mirrors2' },
		{ name: 'Operations', value: 'operations' },
	],
	description:
		'Какие блоки приложить к счётчику. Each one costs size: asking for goals and grants on a list of fifty counters turns a small answer into a large one, so the default asks for none.',
};

const labelFields: INodeProperties[] = [
	{
		displayName: 'Label Name or ID',
		name: 'labelId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getLabels' },
		default: '',
		required: true,
		displayOptions: showFor(NEEDS_LABEL),
		description:
			'Метка, с которой работаем. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Label Name',
		name: 'labelName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: showFor(LABEL_WRITE),
		description: 'Название метки',
	},
];

export const description: INodeProperties[] = [
	operation,
	{
		...counterIdProperty,
		displayOptions: { show: { resource: ['counter'], operation: NEEDS_COUNTER } },
	},
	...counterFields,
	listFilters,
	includeField,
	...returnAllProperties('counter', ['getMany']),
	...labelFields,
];
