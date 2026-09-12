import type { IDataObject, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

import { listFrom, metricaCachedRequest } from '../transport';

/**
 * The dropdown sources.
 *
 * Every one of these is a real call against the account's 5000 a day, so they go
 * through `metricaCachedRequest` — the editor re-runs a picker whenever a field
 * it depends on changes, and that budget is shared with the workflows doing the
 * actual work.
 */

/** Sorts by the label people read, not by the id they do not. */
function byName(options: INodePropertyOptions[]): INodePropertyOptions[] {
	return options.sort((a, b) => a.name.localeCompare(b.name));
}

/** The counter chosen on the node, reduced to digits, or empty if none is set yet. */
function currentCounter(this: ILoadOptionsFunctions): string {
	const raw = this.getCurrentNodeParameter('counterId') as string | number | undefined;
	return String(raw ?? '').replace(/[^0-9]/g, '');
}

/**
 * Every counter the account can see.
 *
 * `field=` asks for none of the optional blocks — without it Metrica attaches
 * goals, filters, operations and grants to each counter, which turns a list of
 * fifty into a megabyte of JSON for a dropdown that shows names.
 */
export async function getCounters(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const payload = await metricaCachedRequest.call(this, '/management/v1/counters', {
		per_page: 1000,
		field: '',
	});

	return byName(
		listFrom(payload, 'counters').map((counter: IDataObject) => ({
			name: `${String(counter.name ?? counter.id)} (${String(counter.id)})`,
			value: String(counter.id ?? ''),
			description: String(counter.site ?? ''),
		})),
	);
}

/**
 * The goals of the counter chosen above.
 *
 * Returns an empty list rather than failing when no counter is picked yet: a
 * dropdown that shows a red error before the field above it has been filled in
 * reads as a broken node.
 */
export async function getGoals(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const counter = currentCounter.call(this);
	if (counter === '') return [];

	const payload = await metricaCachedRequest.call(
		this,
		`/management/v1/counter/${counter}/goals`,
	);

	return byName(
		listFrom(payload, 'goals').map((goal: IDataObject) => ({
			name: `${String(goal.name ?? goal.id)} (${String(goal.id)})`,
			value: String(goal.id ?? ''),
			description: String(goal.type ?? ''),
		})),
	);
}

/** The saved segments of the counter chosen above. */
export async function getSegments(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const counter = currentCounter.call(this);
	if (counter === '') return [];

	const payload = await metricaCachedRequest.call(
		this,
		`/management/v1/counter/${counter}/apisegment/segments`,
	);

	return byName(
		listFrom(payload, 'segments').map((segment: IDataObject) => ({
			name: `${String(segment.name ?? segment.segment_id)} (${String(segment.segment_id)})`,
			value: String(segment.segment_id ?? ''),
		})),
	);
}

/** The labels on the account, which counters can be tagged with. */
export async function getLabels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const payload = await metricaCachedRequest.call(this, '/management/v1/labels');

	return byName(
		listFrom(payload, 'labels').map((label: IDataObject) => ({
			name: `${String(label.name ?? label.id)} (${String(label.id)})`,
			value: String(label.id ?? ''),
		})),
	);
}

/**
 * The Measurement Protocol tokens already minted for this counter.
 *
 * They are read rather than generated, which is the whole point of the list: a
 * counter may hold at most five, and a node that minted one per execution would
 * exhaust that in five runs and then fail for good. The value is the secret
 * itself, so the label shows only enough of it to tell two apart.
 */
export async function getMeasurementTokens(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const counter = currentCounter.call(this);
	if (counter === '') return [];

	const payload = (await metricaCachedRequest.call(this, `/management/v1/counter/${counter}`, {
		field: 'measurement_tokens',
	})) as IDataObject;

	const tokens = ((payload?.counter as IDataObject)?.measurement_tokens ?? []) as string[];

	return tokens.map((token, index) => ({
		name: `Token ${index + 1} (…${String(token).slice(-6)})`,
		value: String(token),
	}));
}

export const loadOptions = {
	getCounters,
	getGoals,
	getLabels,
	getMeasurementTokens,
	getSegments,
};
