import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/**
 * The counter for this item, as a bare number.
 *
 * It goes into the path of nearly every URL this node builds, so it is reduced
 * to digits rather than trusted as typed: the dropdown yields a number, but an
 * expression can yield anything, and people paste whole URLs out of the Metrica
 * address bar.
 */
export function counterFor(this: IExecuteFunctions, itemIndex: number): string {
	const raw = this.getNodeParameter('counterId', itemIndex, '') as string | number;
	const counter = String(raw ?? '').replace(/[^0-9]/g, '');

	if (counter === '') {
		throw new NodeOperationError(this.getNode(), 'No counter selected', {
			description:
				'Every Metrica call names a counter. Pick one from the list, or set the field to an expression that yields its number — the digits shown in Метрика → Настройки.',
			itemIndex,
		});
	}

	return counter;
}

/** Reads a JSON field, failing with the field's own name rather than a parser message. */
export function jsonParameter(
	this: IExecuteFunctions,
	name: string,
	label: string,
	itemIndex: number,
): unknown {
	const raw = this.getNodeParameter(name, itemIndex, '') as unknown;

	if (raw === undefined || raw === null || raw === '') return undefined;
	if (typeof raw === 'object') return raw;

	try {
		return JSON.parse(String(raw));
	} catch {
		throw new NodeOperationError(this.getNode(), `${label} is not valid JSON`, {
			description: `Check the ${label} field. A trailing comma, a single-quoted key or an unquoted value is enough to make Metrica reject the whole request.`,
			itemIndex,
		});
	}
}

/** Drops keys whose value would be sent as nothing, so an untouched field is not sent at all. */
export function omitEmpty(source: IDataObject): IDataObject {
	const out: IDataObject = {};

	for (const [key, value] of Object.entries(source)) {
		if (value === undefined || value === null || value === '') continue;
		if (Array.isArray(value) && value.length === 0) continue;
		out[key] = value;
	}

	return out;
}

/**
 * Splits a field that takes several values into a list.
 *
 * Metrica's dimension and metric fields are comma-separated strings, and people
 * paste them from the documentation with spaces and newlines in between. Both
 * are accepted here and normalised away.
 */
export function toList(value: unknown): string[] {
	if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);

	return String(value ?? '')
		.split(/[\s,]+/)
		.map((entry) => entry.trim())
		.filter(Boolean);
}

/** Reads a Name/Value `fixedCollection` into a plain object. */
export function pairsFromCollection(value: unknown, entryKey = 'parameter'): IDataObject {
	const out: IDataObject = {};
	const entries = (value as IDataObject)?.[entryKey];

	if (!Array.isArray(entries)) return out;

	for (const entry of entries as IDataObject[]) {
		const name = String(entry.name ?? '').trim();
		if (name === '') continue;
		out[name] = entry.value;
	}

	return out;
}

/**
 * A date the way Metrica writes them.
 *
 * The API takes `YYYY-MM-DD` and its own words (`today`, `yesterday`,
 * `7daysAgo`), and n8n date pickers hand over full ISO instants. A word is
 * passed through untouched; an instant keeps its date part only, since sending
 * the time makes Metrica reject the parameter rather than ignore it.
 */
export function toMetricaDate(value: unknown): string {
	const raw = String(value ?? '').trim();
	if (raw === '') return '';

	if (/^(today|yesterday|\d+daysAgo)$/i.test(raw)) return raw;

	const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
	return match !== null ? match[1] : raw;
}

/**
 * Turns whatever an endpoint answered into output items.
 *
 * Several management methods answer `{"success": true}` or with an empty body,
 * and a node that emitted nothing for them would break the chain — the next node
 * would see no item and not run. `fallback` is what stands in for those.
 */
export function toItems(payload: unknown, fallback: IDataObject): INodeExecutionData[] {
	if (Array.isArray(payload)) {
		return (payload as IDataObject[]).map((row) => ({ json: row }));
	}

	if (payload !== null && typeof payload === 'object' && Object.keys(payload).length > 0) {
		return [{ json: payload as IDataObject }];
	}

	return [{ json: fallback }];
}
