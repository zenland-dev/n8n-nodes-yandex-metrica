import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { unknownOperation } from '../../../../../utils/router';
import { counterFor, pairsFromCollection, toList, toMetricaDate } from '../../helpers/request';
import { BUDGETS, metricaApiRequest } from '../../transport';

/** Which URL each operation reads, all under the same report API. */
const ENDPOINT: Record<string, string> = {
	getTable: '/stat/v1/data',
	getByTime: '/stat/v1/data/bytime',
	getDrilldown: '/stat/v1/data/drilldown',
	getPivot: '/stat/v1/data/pivot',
	compare: '/stat/v1/data/comparison',
	compareDrilldown: '/stat/v1/data/comparison/drilldown',
};

const COMPARISON = new Set(['compare', 'compareDrilldown']);

/**
 * Turns Metrica's parallel arrays into rows a workflow can address by name.
 *
 * The API answers `{"data": [{"dimensions": [{"name": "Москва"}], "metrics": [42]}]}`
 * and puts the names of those positions somewhere else entirely, in `query`. So
 * a row arrives as two anonymous lists, and nothing downstream can reach a value
 * without counting positions. This pairs them back up.
 *
 * A dimension is an object rather than a scalar — `{id, name, icon_id, …}` —
 * and which key matters depends on the dimension. `name` is what the interface
 * shows, so it becomes the value, and the whole object is kept beside it under
 * `<dimension>_raw` for the cases where the id is what a workflow needs.
 *
 * A comparison answers two metric lists per row, `metrics` for segment A and
 * `metrics_b` for segment B, plus the already-computed difference. Those are
 * suffixed rather than merged, because a caller comparing two periods wants both
 * numbers and the delta, not one of them.
 */
function flattenRows(payload: IDataObject, comparison: boolean): IDataObject[] {
	const query = (payload.query ?? {}) as IDataObject;
	const dimensionNames = toList(query.dimensions);
	const metricNames = toList(query.metrics);

	const rows = Array.isArray(payload.data) ? (payload.data as IDataObject[]) : [];

	return rows.map((row) => {
		const flat: IDataObject = {};

		const dimensions = Array.isArray(row.dimensions) ? (row.dimensions as IDataObject[]) : [];
		dimensions.forEach((dimension, index) => {
			const key = dimensionNames[index] ?? `dimension${index}`;
			flat[key] = dimension?.name ?? dimension?.id ?? null;
			flat[`${key}_raw`] = dimension;
		});

		const attach = (values: unknown, suffix: string): void => {
			if (!Array.isArray(values)) return;
			values.forEach((value, index) => {
				flat[`${metricNames[index] ?? `metric${index}`}${suffix}`] = value as never;
			});
		};

		if (comparison) {
			attach(row.metrics, '_a');
			attach(row.metrics_b, '_b');
			attach(row.metrics_difference, '_difference');
		} else {
			attach(row.metrics, '');
		}

		return flat;
	});
}

/** Everything every report method takes, gathered once. */
function baseQuery(this: IExecuteFunctions, itemIndex: number): IDataObject {
	return {
		ids: counterFor.call(this, itemIndex),
		metrics: toList(this.getNodeParameter('metrics', itemIndex, '')).join(','),
		dimensions: toList(this.getNodeParameter('dimensions', itemIndex, '')).join(','),
		preset: this.getNodeParameter('preset', itemIndex, ''),
		sort: toList(this.getNodeParameter('sort', itemIndex, '')).join(','),
		accuracy: this.getNodeParameter('accuracy', itemIndex, ''),
		lang: this.getNodeParameter('lang', itemIndex, 'ru'),
		timezone: this.getNodeParameter('timezone', itemIndex, ''),
		include_undefined: this.getNodeParameter('includeUndefined', itemIndex, false)
			? 'true'
			: undefined,
	};
}

async function runReport(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const comparison = COMPARISON.has(operation);
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = this.getNodeParameter('limit', itemIndex, 50) as number;
	const simple = this.getNodeParameter('simple', itemIndex, true) as boolean;

	const qs: IDataObject = baseQuery.call(this, itemIndex);

	if (comparison) {
		qs.date1_a = toMetricaDate(this.getNodeParameter('date1A', itemIndex, ''));
		qs.date2_a = toMetricaDate(this.getNodeParameter('date2A', itemIndex, ''));
		qs.date1_b = toMetricaDate(this.getNodeParameter('date1B', itemIndex, ''));
		qs.date2_b = toMetricaDate(this.getNodeParameter('date2B', itemIndex, ''));
		qs.filters_a = this.getNodeParameter('filtersA', itemIndex, '');
		qs.filters_b = this.getNodeParameter('filtersB', itemIndex, '');
	} else {
		qs.date1 = toMetricaDate(this.getNodeParameter('date1', itemIndex, ''));
		qs.date2 = toMetricaDate(this.getNodeParameter('date2', itemIndex, ''));
		qs.filters = this.getNodeParameter('filters', itemIndex, '');
	}

	if (operation === 'getByTime') qs.group = this.getNodeParameter('group', itemIndex, 'day');

	if (operation === 'getPivot') {
		qs.pivot_dimensions = toList(this.getNodeParameter('pivotDimensions', itemIndex, '')).join(',');
	}

	if (operation === 'getDrilldown' || operation === 'compareDrilldown') {
		qs.parent_id = this.getNodeParameter('parentId', itemIndex, '');
	}

	// The report API pages with limit and offset like the rest of Metrica, but a
	// report is not a list: asking for "all" of a grouping with a million distinct
	// values is a way to spend the whole daily quota on one node. So Return All
	// asks for the largest page the API allows and stops there, and the response's
	// own total_rows says whether anything was left behind.
	qs.limit = returnAll ? 100_000 : Math.max(1, limit);

	Object.assign(qs, pairsFromCollection(this.getNodeParameter('extraQuery', itemIndex, {})));

	const payload = (await metricaApiRequest.call(
		this,
		'GET',
		ENDPOINT[operation],
		undefined,
		qs,
		{ budget: BUDGETS.report, readOnly: true },
	)) as IDataObject;

	if (!simple) return [{ json: payload }];

	const rows = flattenRows(payload, comparison);

	// A report with no matching rows still has to emit something, or the branch
	// downstream simply does not run and the workflow looks like it skipped a
	// step. The sampling information is what a reader needs in that case anyway.
	if (rows.length === 0) {
		return [
			{
				json: {
					total_rows: payload.total_rows ?? 0,
					sampled: payload.sampled ?? false,
					sample_share: payload.sample_share ?? null,
					data_lag: payload.data_lag ?? null,
				},
			},
		];
	}

	return rows.map((row) => ({ json: row }));
}

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	if (ENDPOINT[operation] === undefined) {
		throw unknownOperation.call(this, 'Report', operation, itemIndex);
	}

	return await runReport.call(this, operation, itemIndex);
}
