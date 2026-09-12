import type { INodeProperties } from 'n8n-workflow';

import { counterIdProperty, extraQueryProperty } from '../../descriptions/common';

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['event'], operation: operations },
});

/**
 * Hits sent straight to Metrica, without a browser.
 *
 * This is the one resource that leaves `api-metrika.yandex.net`: it posts to
 * `mc.yandex.ru/collect` with a per-counter token instead of the OAuth header.
 * The token is still issued through the API with the same credential, so nothing
 * extra has to be configured — the node reads the counter's existing tokens when
 * the field is left empty.
 *
 * Three things decide whether a sent event actually lands, and all three are
 * silent when they fail.
 *
 * The option has to be on. `measurement_enabled` is a counter flag, and the
 * Counter resource is where this node turns it on.
 *
 * A visit can only be extended for 12 hours after it ends. Older than that and
 * the event is accepted and dropped; the way to record something for an old
 * visitor is to send a `pageview` first, which opens a new visit their ClientID
 * is attached to. Anything genuinely historical belongs in Offline Conversion
 * instead.
 *
 * The ClientID has to be one Metrica has seen. The service remembers them for 21
 * days after the option is switched on, and an id it does not recognise becomes
 * a brand-new visitor rather than the returning one you meant.
 */
const operation: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'send',
	displayOptions: { show: { resource: ['event'] } },
	options: [
		{
			name: 'Generate Token',
			value: 'generateToken',
			action: 'Generate a measurement token',
			description:
				'Выпустить новый токен Measurement Protocol. A counter holds at most five, so generate deliberately rather than on every run.',
		},
		{
			name: 'Get Tokens',
			value: 'getTokens',
			action: 'Get the measurement tokens of a counter',
			description: 'Активные токены счётчика',
		},
		{
			name: 'Send',
			value: 'send',
			action: 'Send an event to a counter',
			description:
				'Отправить взаимодействие в счётчик напрямую. The answer says only that Metrica took the request, never whether it was attached to a visit.',
		},
	],
};

const fields: INodeProperties[] = [
	{
		displayName: 'Measurement Token Name or ID',
		name: 'measurementToken',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getMeasurementTokens' },
		default: '',
		displayOptions: showFor(['send']),
		description: 'Токен счётчика для Measurement Protocol. Leave empty and the node reads an existing token for this counter itself, using the same credential. Choose one from the list, or specify it using an <a href="https://docs.n8n.io/code/expressions/">expression</a>, when the counter has several and the choice matters. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Client ID',
		name: 'clientId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: showFor(['send']),
		placeholder: '133591247640966458',
		description: 'Идентификатор посетителя — целое неотрицательное число, каким его отдаёт ym(counter, "getClientID") на сайте. An identifier Metrica has never seen starts a new visitor rather than continuing an existing one.',
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		default: 'pageview',
		displayOptions: showFor(['send']),
		options: [
			{
				name: 'Event',
				value: 'event',
				description: 'JavaScript-событие или событие электронной коммерции',
			},
			{
				name: 'Pageview',
				value: 'pageview',
				description: 'Просмотр страницы. The only type that can open a new visit.',
			},
		],
		description:
			'Тип взаимодействия. An event sent for a visitor with no open visit is dropped, so a pageview usually goes first.',
	},
	{
		displayName: 'Goal ID',
		name: 'goalId',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['event'], operation: ['send'], type: ['event'] } },
		description: 'Идентификатор JS-цели, которую засчитать. It is the goal identifier from the goal settings, not the numeric goal ID.',
	},
	{
		displayName: 'Event Time',
		name: 'eventTime',
		type: 'string',
		default: '',
		displayOptions: showFor(['send']),
		placeholder: '1789456123',
		description:
			'Время события в Unix-секундах, не в миллисекундах. Leave empty for now. A value more than 12 hours after the visit ended is accepted and then ignored.',
	},
	{
		displayName: 'Page Fields',
		name: 'pageFields',
		type: 'collection',
		default: {},
		placeholder: 'Add Field',
		displayOptions: showFor(['send']),
		description: 'Данные о странице и событии',
		options: [
			{
				displayName: 'Currency',
				name: 'cu',
				type: 'string',
				default: '',
				placeholder: 'RUB',
				description: 'Валюта суммы',
			},
			{
				displayName: 'Goal Value',
				name: 'ev',
				type: 'number',
				default: 0,
				description: 'Ценность достижения цели',
			},
			{
				displayName: 'Page Title',
				name: 'dt',
				type: 'string',
				default: '',
				description: 'Заголовок страницы',
			},
			{
				displayName: 'Page URL',
				name: 'dl',
				type: 'string',
				default: '',
				description: 'Адрес страницы, к которой относится взаимодействие',
			},
			{
				displayName: 'Product Action',
				name: 'pa',
				type: 'string',
				default: '',
				placeholder: 'purchase',
				description:
					'Действие с товаром в расширенной электронной коммерции: detail, add, remove, purchase и остальные',
			},
			{
				displayName: 'Referrer',
				name: 'dr',
				type: 'string',
				default: '',
				description:
					'Адрес источника перехода. This is what gives a server-side pageview a traffic source at all.',
			},
			{
				displayName: 'Screen Resolution',
				name: 'sr',
				type: 'string',
				default: '',
				placeholder: '1920x1080',
				description: 'Размер окна',
			},
			{
				displayName: 'Transaction Coupon',
				name: 'tcc',
				type: 'string',
				default: '',
				description: 'Купон транзакции',
			},
			{
				displayName: 'Transaction ID',
				name: 'ti',
				type: 'string',
				default: '',
				description: 'Идентификатор транзакции электронной коммерции',
			},
			{
				displayName: 'Transaction Revenue',
				name: 'tr',
				type: 'number',
				default: 0,
				description: 'Доход транзакции',
			},
		],
	},
	extraQueryProperty('event', ['send']),
];

export const description: INodeProperties[] = [
	operation,
	{ ...counterIdProperty, displayOptions: { show: { resource: ['event'] } } },
	...fields,
];
