import type { INodeProperties } from 'n8n-workflow';

/**
 * The counter, named on almost every call.
 *
 * One OAuth token opens every counter the account can see, so the counter is a
 * per-request choice rather than a property of the credential — which is what
 * lets one credential serve an agency with fifty clients. The dropdown is filled
 * from the account's own list; an expression can be typed in instead when the
 * number comes from the data.
 */
export const counterIdProperty: INodeProperties = {
	displayName: 'Counter Name or ID',
	name: 'counterId',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getCounters' },
	default: '',
	required: true,
	description: 'Счётчик, к которому относится операция. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. It is the number shown in Метрика → Настройки, and the same number that sits in the site\'s tag. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
};

/** Return All and its companion Limit, for the endpoints that page. */
export const returnAllProperties = (
	resource: string,
	operations: string[],
): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: [resource], operation: operations } },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: { show: { resource: [resource], operation: operations, returnAll: [false] } },
		description: 'Max number of results to return',
	},
];

/**
 * The report period.
 *
 * Metrica takes either a date or one of its own words, and the words are what
 * make a scheduled workflow correct: `yesterday` on a daily run always means the
 * day that just closed, while a date computed in an expression drifts with the
 * server's timezone. `NdaysAgo` counts back from today, so `7daysAgo` to
 * `yesterday` is the last full week.
 */
export const dateRangeProperties = (
	resource: string,
	operations: string[],
): INodeProperties[] => [
	{
		displayName: 'Date From',
		name: 'date1',
		type: 'string',
		default: '7daysAgo',
		required: true,
		displayOptions: { show: { resource: [resource], operation: operations } },
		placeholder: '2026-09-01',
		description:
			'Начало периода: YYYY-MM-DD, либо today, yesterday или NdaysAgo. Data for the current day is incomplete until it closes, so a daily report is usually 7daysAgo to yesterday rather than to today.',
	},
	{
		displayName: 'Date To',
		name: 'date2',
		type: 'string',
		default: 'yesterday',
		required: true,
		displayOptions: { show: { resource: [resource], operation: operations } },
		placeholder: '2026-09-07',
		description: 'Конец периода, включительно. Same formats as Date From.',
	},
];

/**
 * The escape hatch for Metrica's own segmentation language.
 *
 * `ym:s:regionCity=='Москва'` and the rest of it is a small language with `and`,
 * `or`, `not`, `EXISTS` and quantifiers, and rebuilding it as n8n fields would
 * be a worse version of it. The fields that matter per operation are offered
 * directly; this takes anything the API accepts, for everything else.
 */
export const filtersProperty = (resource: string, operations: string[]): INodeProperties => ({
	displayName: 'Segment Filter',
	name: 'filters',
	type: 'string',
	default: '',
	displayOptions: { show: { resource: [resource], operation: operations } },
	placeholder: "ym:s:regionCity=='Москва' AND ym:s:isNewUser=='Yes'",
	description:
		'Сегментация в синтаксисе Метрики. Attribute names carry the namespace they belong to — ym:s: for visits, ym:pv: for pageviews — and mixing namespaces from different report types in one expression is rejected.',
});

/**
 * Free-form query parameters.
 *
 * The report API has some forty parameters and grows; the ones a workflow
 * actually sets are offered as fields, and this carries the rest without a node
 * release. Anything set here wins over the fields above, which is what makes it
 * usable for working around a bug rather than only for extending.
 */
export const extraQueryProperty = (
	resource: string,
	operations: string[],
): INodeProperties => ({
	displayName: 'Additional Query Parameters',
	name: 'extraQuery',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	default: {},
	placeholder: 'Add Parameter',
	displayOptions: { show: { resource: [resource], operation: operations } },
	description:
		'Параметры запроса, которых нет среди полей выше. They are merged last, so a name repeated here replaces what a field above set.',
	options: [
		{
			displayName: 'Parameter',
			name: 'parameter',
			values: [
				{
					displayName: 'Name',
					name: 'name',
					type: 'string',
					default: '',
					description: 'Имя параметра, как его называет документация Метрики',
				},
				{
					displayName: 'Value',
					name: 'value',
					type: 'string',
					default: '',
					description: 'Значение параметра',
				},
			],
		},
	],
});
