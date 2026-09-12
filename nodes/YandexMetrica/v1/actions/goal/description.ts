import type { INodeProperties } from 'n8n-workflow';

import { crudCommonProperties, crudOperations } from '../shared/crud';

const WRITE = ['create', 'update'];

const showFor = (operations: string[]): INodeProperties['displayOptions'] => ({
	show: { resource: ['goal'], operation: operations },
});

/**
 * The goals a counter counts conversions against.
 *
 * A goal is a rule, not a number: what a visitor has to do for the visit to be
 * counted as a conversion. The thirteen kinds Metrica supports differ enough
 * that the API models them as thirteen different objects, so this resource
 * offers the four that workflows actually create and hands the rest to Raw Goal
 * JSON rather than pretending to cover them.
 */
const fields: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		displayOptions: showFor(WRITE),
		description: 'Название цели, каким его видно в отчётах',
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		default: 'action',
		displayOptions: showFor(WRITE),
		options: [
			{
				name: 'JavaScript Event',
				value: 'action',
				description: 'Цель на вызов reachGoal с сайта — самая частая',
			},
			{
				name: 'Multi-Step',
				value: 'step',
				description: 'Составная цель из шагов. The steps go in Raw Goal JSON.',
			},
			{ name: 'Page Depth', value: 'number', description: 'Просмотрено столько-то страниц' },
			{ name: 'Page URL', value: 'url', description: 'Визит дошёл до адреса' },
			{ name: 'Visit Duration', value: 'time', description: 'Визит продлился столько-то' },
		],
		description: 'Вид цели. The other eight kinds Metrica has go through Raw Goal JSON.',
	},
	{
		displayName: 'Conditions',
		name: 'conditions',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		placeholder: 'Add Condition',
		displayOptions: showFor(WRITE),
		description:
			'Что должно совпасть. Several conditions on one goal are an OR — any of them counts as the goal.',
		options: [
			{
				displayName: 'Condition',
				name: 'condition',
				values: [
					{
						displayName: 'Match',
						name: 'type',
						type: 'options',
						default: 'exact',
						options: [
							{ name: 'Contains', value: 'contain' },
							{ name: 'Contains (Event ID)', value: 'contain_action' },
							{ name: 'Exactly', value: 'exact' },
							{ name: 'Exactly (Event ID)', value: 'exact_action' },
							{ name: 'Matches Regexp', value: 'regexp' },
							{ name: 'Matches Regexp (Event ID)', value: 'regexp_action' },
							{ name: 'Starts With', value: 'start' },
							{ name: 'Starts With (Event ID)', value: 'start_action' },
						],
						description:
							'Как сравнивать. The four _action variants are for a JavaScript event identifier; the plain four are for a URL.',
					},
					{
						displayName: 'Value',
						name: 'url',
						type: 'string',
						default: '',
						placeholder: 'order',
						description: 'Значение для сравнения. Metrica calls this field URL whatever the goal type is, so a JavaScript goal puts its event ID here too.',
					},
				],
			},
		],
	},
	{
		displayName: 'Depth or Seconds',
		name: 'depth',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 2,
		displayOptions: {
			show: { resource: ['goal'], operation: WRITE, type: ['number', 'time'] },
		},
		description: 'Сколько страниц для цели на глубину, либо сколько секунд для цели на время',
	},
	{
		displayName: 'Default Price',
		name: 'defaultPrice',
		type: 'number',
		default: 0,
		displayOptions: showFor(WRITE),
		description:
			'Ценность достижения цели в валюте счётчика. Reports multiply it by conversions when no revenue of its own arrives, which is how a form submission gets a monetary value.',
	},
	{
		displayName: 'Favourite',
		name: 'isFavorite',
		type: 'boolean',
		default: false,
		displayOptions: showFor(WRITE),
		description: 'Whether to pin the goal to the top of the reports that list goals',
	},
	{
		displayName: 'Raw Goal JSON',
		name: 'goalJson',
		type: 'json',
		default: '',
		typeOptions: { rows: 3 },
		displayOptions: showFor(WRITE),
		placeholder: '{ "type": "step", "steps": [] }',
		description:
			'Поля цели, которых нет среди полей выше — составные цели, цели на мессенджеры, платёжные системы, звонки. Merged into the goal object last and wins over everything above.',
	},
];

export const description: INodeProperties[] = [
	crudOperations(
		'goal',
		'getMany',
		{
			create: 'Завести цель на счётчике',
			delete: 'Удалить цель. Reports keep the conversions already counted, but stop gaining new ones.',
			get: 'Одна цель со своими условиями',
			getMany: 'Все цели счётчика',
			update:
				'Изменить цель. Metrica replaces the conditions wholesale rather than merging, so send the full set even to change one.',
		},
		{
			create: 'Create a goal',
			delete: 'Delete a goal',
			get: 'Get a goal',
			getMany: 'Get many goals',
			update: 'Update a goal',
		},
	),
	...crudCommonProperties(
		'goal',
		'goalId',
		'Goal',
		'Цель, с которой работаем. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		'getGoals',
	),
	...fields,
];
