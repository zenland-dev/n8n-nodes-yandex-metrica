import type { INodeProperties } from 'n8n-workflow';

import {
	counterIdProperty,
	dateRangeProperties,
	extraQueryProperty,
	filtersProperty,
	returnAllProperties,
} from '../../descriptions/common';

const ALL = ['getTable', 'getByTime', 'getDrilldown', 'getPivot', 'compare', 'compareDrilldown'];
const SINGLE_PERIOD = ['getTable', 'getByTime', 'getDrilldown', 'getPivot'];
const COMPARISON = ['compare', 'compareDrilldown'];

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['report'], operation: operations },
});

/**
 * The aggregated numbers, the way the Metrica interface draws them.
 *
 * Six methods, one query language. Every one takes the same dimensions and
 * metrics and differs only in the shape it returns them in: a flat table, a
 * series over time, one level of a tree, a cross-tab, or two periods side by
 * side. Picking the wrong one is the usual reason a report "has no data" — a
 * drill-down without a parent row returns the top level and nothing else.
 */
const operation: INodeProperties = {
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	default: 'getTable',
	displayOptions: { show: { resource: ['report'] } },
	options: [
		{
			name: 'Compare Drill Down',
			value: 'compareDrilldown',
			action: 'Compare two periods one level down',
			description: 'То же сравнение, но для одного уровня дерева группировок',
		},
		{
			name: 'Compare Periods',
			value: 'compare',
			action: 'Compare two periods in a report',
			description:
				'Два периода или два сегмента рядом, с разницей между ними. Segment A and segment B can differ by date, by filter, or by both.',
		},
		{
			name: 'Drill Down',
			value: 'getDrilldown',
			action: 'Get one level of a report tree',
			description:
				'Один уровень дерева: дети выбранной строки. Without a parent row it returns the same thing as a table, which is the usual reason this looks broken.',
		},
		{
			name: 'Get By Time',
			value: 'getByTime',
			action: 'Get a report as a series over time',
			description:
				'Показатели по дням, неделям или месяцам — то, что в интерфейсе рисуется линией. The grouping is set by Group By rather than by a dimension.',
		},
		{
			name: 'Get Pivot',
			value: 'getPivot',
			action: 'Get a report as a pivot table',
			description:
				'Сводная таблица: одни группировки в строках, другие в колонках. The newest of the six methods and absent from older API write-ups.',
		},
		{
			name: 'Get Table',
			value: 'getTable',
			action: 'Get a report as a table',
			description:
				'Плоская таблица: строка на комбинацию группировок. The method almost every report starts from.',
		},
	],
};

const query: INodeProperties[] = [
	{
		displayName: 'Metrics',
		name: 'metrics',
		type: 'string',
		default: 'ym:s:visits,ym:s:users',
		required: true,
		displayOptions: showFor(ALL),
		placeholder: 'ym:s:visits,ym:s:users,ym:s:bounceRate',
		description:
			'Что считать, через запятую, максимум 20. The prefix is the report type and is not interchangeable: ym:s: counts visits, ym:pv: pageviews, ym:ad: Direct clicks. Mixing prefixes from different types in one request is refused.',
	},
	{
		displayName: 'Dimensions',
		name: 'dimensions',
		type: 'string',
		default: '',
		displayOptions: showFor(ALL),
		placeholder: 'ym:s:trafficSource,ym:s:regionCity',
		description:
			'По чему группировать, через запятую, максимум 10. Leave empty for a single row of totals over the whole period.',
	},
	{
		displayName: 'Pivot Dimensions',
		name: 'pivotDimensions',
		type: 'string',
		default: '',
		displayOptions: showFor(['getPivot']),
		placeholder: 'ym:s:date',
		description: 'Группировки, которые уходят в колонки. Dimensions above stay in the rows.',
	},
	{
		displayName: 'Preset',
		name: 'preset',
		type: 'string',
		default: '',
		displayOptions: showFor(ALL),
		placeholder: 'sources_summary',
		description:
			'Готовый отчёт вместо ручного набора метрик. A preset replaces the metrics and dimensions above entirely — filling both in does not merge them. Names are listed in the Metrica documentation under Пресеты.',
	},
	{
		displayName: 'Group By',
		name: 'group',
		type: 'options',
		default: 'day',
		displayOptions: showFor(['getByTime']),
		options: [
			{ name: 'Auto', value: 'auto' },
			{ name: 'Day', value: 'day' },
			{ name: 'Hour', value: 'hour' },
			{ name: 'Month', value: 'month' },
			{ name: 'Ten Minutes', value: 'tenminute' },
			{ name: 'Week', value: 'week' },
		],
		description: 'Шаг временного ряда',
	},
	{
		displayName: 'Parent Row ID',
		name: 'parentId',
		type: 'string',
		default: '',
		displayOptions: showFor(['getDrilldown', 'compareDrilldown']),
		placeholder: "ym:s:trafficSource=='organic'",
		description:
			'Строка, детей которой раскрыть, в виде условия по родительской группировке. Leave empty to get the top level.',
	},
	{
		displayName: 'Sort',
		name: 'sort',
		type: 'string',
		default: '',
		displayOptions: showFor(ALL),
		placeholder: '-ym:s:visits',
		description:
			'Поля сортировки через запятую; минус в начале — по убыванию. Any metric or dimension in the request can be sorted on.',
	},
	{
		displayName: 'Accuracy',
		name: 'accuracy',
		type: 'string',
		default: '',
		displayOptions: showFor(ALL),
		placeholder: 'medium',
		description:
			'Точность против скорости: full, medium, low, или доля выборки от 0 до 1. Metrica samples big reports by default; full forces it to read everything and can turn a fast report into a timeout.',
	},
	{
		displayName: 'Language',
		name: 'lang',
		type: 'options',
		default: 'ru',
		displayOptions: showFor(ALL),
		options: [
			{ name: 'English', value: 'en' },
			{ name: 'Russian', value: 'ru' },
			{ name: 'Turkish', value: 'tr' },
			{ name: 'Ukrainian', value: 'uk' },
		],
		description: 'Язык названий в результате — городов, браузеров, источников',
	},
	{
		displayName: 'Timezone',
		name: 'timezone',
		type: 'string',
		default: '',
		displayOptions: showFor(ALL),
		placeholder: '+03:00',
		description: "Часовой пояс дат в отчёте. Defaults to the counter's own.",
	},
	{
		displayName: 'Include Undefined',
		name: 'includeUndefined',
		type: 'boolean',
		default: false,
		displayOptions: showFor(ALL),
		description:
			'Whether to keep the rows where a dimension has no value. Off by default, which is why the sum of a grouped report can be smaller than the total.',
	},
];

const comparison: INodeProperties[] = [
	{
		displayName: 'A: Date From',
		name: 'date1A',
		type: 'string',
		default: '14daysAgo',
		required: true,
		displayOptions: showFor(COMPARISON),
		description: 'Начало первого периода: YYYY-MM-DD, today, yesterday или NdaysAgo',
	},
	{
		displayName: 'A: Date To',
		name: 'date2A',
		type: 'string',
		default: '8daysAgo',
		required: true,
		displayOptions: showFor(COMPARISON),
		description: 'Конец первого периода, включительно',
	},
	{
		displayName: 'B: Date From',
		name: 'date1B',
		type: 'string',
		default: '7daysAgo',
		required: true,
		displayOptions: showFor(COMPARISON),
		description: 'Начало второго периода',
	},
	{
		displayName: 'B: Date To',
		name: 'date2B',
		type: 'string',
		default: 'yesterday',
		required: true,
		displayOptions: showFor(COMPARISON),
		description: 'Конец второго периода, включительно',
	},
	{
		displayName: 'A: Segment Filter',
		name: 'filtersA',
		type: 'string',
		default: '',
		displayOptions: showFor(COMPARISON),
		description:
			'Сегментация первой половины сравнения. Set both this and its B counterpart to compare two audiences over the same dates.',
	},
	{
		displayName: 'B: Segment Filter',
		name: 'filtersB',
		type: 'string',
		default: '',
		displayOptions: showFor(COMPARISON),
		description: 'Сегментация второй половины сравнения',
	},
];

const output: INodeProperties = {
	displayName: 'Simplify',
	name: 'simple',
	type: 'boolean',
	default: true,
	displayOptions: showFor(ALL),
	description: 'Whether to return a simplified version of the response instead of the raw data',
};

export const description: INodeProperties[] = [
	operation,
	{ ...counterIdProperty, displayOptions: { show: { resource: ['report'] } } },
	...query,
	...dateRangeProperties('report', SINGLE_PERIOD),
	...comparison,
	filtersProperty('report', SINGLE_PERIOD),
	...returnAllProperties('report', ALL),
	output,
	extraQueryProperty('report', ALL),
];
