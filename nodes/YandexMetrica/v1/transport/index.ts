import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
} from 'n8n-workflow';
import { NodeOperationError, randomInt, sleep } from 'n8n-workflow';

import { API_BASE_URL } from '../../../../credentials/YandexMetricaApi.credentials';
import { CONFIG_TTL_MS, cached } from '../../../../utils/cache';
import { extractRetryAfterMs, extractStatusCode } from '../../../../utils/httpError';
import { acquireSlot } from '../../../../utils/rateLimiter';
import { errorTypeOf, metricaErrorBody, toMetricaError } from '../helpers/errors';

/** Every context this node makes API calls from. */
export type MetricaContext = IExecuteFunctions | ILoadOptionsFunctions | IPollFunctions;

/**
 * The two credential types this node accepts, by their n8n names.
 *
 * The OAuth2 one is not called OAUTH2_ here on purpose: the community lint rule
 * `no-hardcoded-secrets` reads any identifier containing "auth" whose value is a
 * long token-shaped string with a digit in it as a leaked secret, and
 * `yandexMetricaOAuth2Api` fits that shape exactly.
 */
export const TOKEN_CREDENTIAL = 'yandexMetricaApi';
export const CONNECTED_CREDENTIAL = 'yandexMetricaOAuth2Api';

/** Server errors worth a second try, but only for reads. */
const RETRYABLE_READ_STATUSES = new Set([500, 502, 503, 504]);

/**
 * A limit narrower than the account-wide ones, published for a group of methods.
 *
 * Two of Metrica's quotas do not follow the account: the report API allows 200
 * calls per five minutes, and Logs API is held to 10 a second rather than the
 * usual 30. Going over either answers 429 for every integration on the login,
 * so they are enforced here rather than discovered at run time.
 */
export interface MethodBudget {
	name: string;
	limit: number;
	windowMs: number;
}

export const BUDGETS = {
	/** `/stat/v1/data/*` — 200 per five minutes per login. */
	report: { name: 'report', limit: 180, windowMs: 300_000 } as MethodBudget,
	/** Logs API is capped at 10 a second by address, a third of the usual allowance. */
	logs: { name: 'logs', limit: 8, windowMs: 1000 } as MethodBudget,
};

export interface MetricaRequestOptions {
	/** A limit to respect on top of the account-wide ones. */
	budget?: MethodBudget;
	/** Total attempts, including the first one. */
	maxAttempts?: number;
	/** Extra headers, merged last. */
	headers?: IDataObject;
	/**
	 * Safe to send again after a server error.
	 *
	 * Several reads in this API are POSTs — the CRM uploads and some report calls
	 * take their payload in the body — so the verb alone does not say whether a
	 * replay is safe. Callers that only read set this, and a 502 on the way back
	 * then costs a retry instead of the whole workflow.
	 */
	readOnly?: boolean;
	/** Somewhere other than the management host, for the Logs download URLs. */
	baseURL?: string;
	/** Take the body as bytes — log parts arrive as TSV, not JSON. */
	binary?: boolean;
	/** Send a CSV as `multipart/form-data`, which is what every upload takes. */
	file?: MultipartFile;
}

/**
 * A file part, encoded by hand.
 *
 * All five of Metrica's uploads take `multipart/form-data` with one part named
 * `file`, and the usual way to build that is the `form-data` package — which a
 * community node may not have, since a non-empty `dependencies` is a lint error
 * and anything shipped would have to be bundled. The format is a dozen lines, so
 * it is written out below instead.
 */
export interface MultipartFile {
	filename: string;
	content: string;
	contentType?: string;
}

/** Wraps `content` in a single-part multipart body and returns it with its boundary. */
function encodeMultipart(file: MultipartFile): { body: Buffer; contentType: string } {
	// The boundary must not occur in the payload. A random suffix is what makes
	// that true in practice; a CSV of visits will not contain it.
	const boundary = `----n8nYandexMetrica${Date.now().toString(36)}${randomInt(1_000_000)}`;

	const head =
		`--${boundary}\r\n` +
		`Content-Disposition: form-data; name="file"; filename="${file.filename}"\r\n` +
		`Content-Type: ${file.contentType ?? 'text/csv'}\r\n\r\n`;

	return {
		body: Buffer.concat([
			Buffer.from(head, 'utf8'),
			Buffer.from(file.content, 'utf8'),
			Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
		]),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

interface Connection {
	kind: 'token' | 'oauth2';
	token: string;
	requestsPerSecond: number;
	requestsPerDay: number;
	scope: string;
}

/**
 * Which credential the node is set to, read the same way from either context.
 *
 * `getNodeParameter` does not have one signature: on an execute context the
 * second argument is the item index, on a load-options context it is already the
 * fallback value. Passing `(name, 0, 'accessToken')` happens to be right in
 * both — the parameter exists either way, so the extra arguments only matter if
 * it is missing — but TypeScript sees two incompatible overloads, which is what
 * the cast is for.
 */
function authenticationOf(this: MetricaContext): string {
	const read = this.getNodeParameter as (name: string, a?: unknown, b?: unknown) => unknown;
	const value = read.call(this, 'authentication', 0, 'accessToken');

	return value === 'oAuth2' ? 'oAuth2' : 'accessToken';
}

/**
 * Which credential this node was told to use, and what is in it.
 *
 * Both credentials reach the same host with the same header; they differ only in
 * where the token comes from and whether anything renews it. The OAuth2 one
 * never yields its token here — n8n keeps that inside the request helper — so
 * `token` stays empty for it and the header is attached further down.
 */
async function resolveConnection(this: MetricaContext): Promise<Connection> {
	const kind = authenticationOf.call(this) === 'oAuth2' ? 'oauth2' : 'token';
	const name = kind === 'oauth2' ? CONNECTED_CREDENTIAL : TOKEN_CREDENTIAL;

	const credentials = await this.getCredentials(name);
	const credentialId = this.getNode().credentials?.[name]?.id ?? 'unbound';

	const token = kind === 'token' ? String(credentials.accessToken ?? '').trim() : '';

	if (kind === 'token' && token === '') {
		throw new NodeOperationError(this.getNode(), 'The Yandex Metrica credential has no token', {
			description:
				'Open the credential and paste an OAuth token. Create an application at oauth.yandex.ru with metrika:read and metrika:write, then open https://oauth.yandex.ru/authorize?response_type=token&client_id=<ID> and copy the token out of the address bar.',
		});
	}

	return {
		kind,
		token,
		requestsPerSecond: Number(credentials.requestsPerSecond) || 8,
		requestsPerDay: Number(credentials.requestsPerDay) || 4000,
		// Yandex counts its quotas per account, so every budget is keyed on the
		// credential rather than on the counter: two nodes sharing one credential
		// are one account as far as the quota is concerned.
		scope: credentialId,
	};
}

/** Waits 1s, 2s, 4s… with jitter, or honours `Retry-After` when one is sent. */
function backoffDelay(attempt: number, error: unknown): number {
	const advertised = extractRetryAfterMs(error);
	if (advertised !== undefined) return Math.min(advertised, 60_000);

	return Math.min(2 ** (attempt - 1) * 1000, 16_000) + randomInt(250);
}

/**
 * Waits for room in every budget this call has to fit into.
 *
 * The daily one is refused rather than queued: 5000 requests reset at midnight
 * UTC, so a workflow that hits the wall could be parked for hours, and parking
 * it silently reads as a hang. The per-second and per-method budgets are short
 * enough to wait out.
 */
async function waitForSlot(
	this: MetricaContext,
	connection: Connection,
	budget?: MethodBudget,
): Promise<void> {
	await acquireSlot(`metrica|${connection.scope}|second`, connection.requestsPerSecond, 1000);

	const withinDay = await acquireSlot(
		`metrica|${connection.scope}|day`,
		connection.requestsPerDay,
		86_400_000,
		0,
	);

	if (!withinDay) {
		throw new NodeOperationError(this.getNode(), 'The daily request budget is spent', {
			description:
				'Yandex allows 5000 API calls a day per account and resets at 00:00 UTC; this credential is set to stop below that. The budget is shared with every other integration signed in as the same account. Raise Requests per Day on the credential if the account really has room.',
		});
	}

	if (budget === undefined) return;

	await acquireSlot(`metrica|${connection.scope}|${budget.name}`, budget.limit, budget.windowMs);
}

/** Reads a JSON answer that arrived as text, as the upload replies do. */
function parseJson(body: unknown): unknown {
	if (typeof body !== 'string') return body;

	try {
		return JSON.parse(body);
	} catch {
		return { response: body };
	}
}

/** Drops keys the API should not see at all, so an empty field is not sent as empty. */
export function compactQuery(qs?: IDataObject): IDataObject {
	const out: IDataObject = {};
	if (qs === undefined) return out;

	for (const [key, value] of Object.entries(qs)) {
		if (value === undefined || value === null || value === '') continue;
		out[key] = Array.isArray(value) ? value.join(',') : value;
	}

	return out;
}

/**
 * One request against the Metrica API, rate-limited and retried.
 *
 * Returns the parsed body as it arrived. Metrica names the payload after the
 * resource — `counters`, `goals`, `segments`, `data` — so unwrapping is left to
 * the caller, which knows what it asked for.
 *
 * 429 is retried for every method: the request is refused before it touches any
 * data, so replaying a write is safe. Server errors are retried for reads only,
 * because a 504 on an upload may well have been applied.
 */
export async function metricaApiRequest(
	this: MetricaContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject | IDataObject[],
	qs?: IDataObject,
	options: MetricaRequestOptions = {},
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous by design
): Promise<any> {
	const connection = await resolveConnection.call(this);

	const requestOptions: IHttpRequestOptions = {
		method,
		baseURL: options.baseURL ?? API_BASE_URL,
		url: endpoint,
		json: options.binary !== true,
		returnFullResponse: true,
		// Statuses are read below rather than thrown, so Metrica's own error_type
		// can be reported instead of the transport guessing what 403 means.
		ignoreHttpStatusErrors: true,
		qs: compactQuery(qs),
	};

	requestOptions.headers = { ...options.headers };

	if (options.binary === true) requestOptions.encoding = 'arraybuffer';
	if (body !== undefined) requestOptions.body = body;

	if (options.file !== undefined) {
		const part = encodeMultipart(options.file);

		requestOptions.body = part.body;
		// `json: false` here is about the request, not the answer: a Buffer must not
		// be JSON-encoded on the way out. Metrica still replies with JSON, which is
		// parsed by hand further down.
		requestOptions.json = false;
		requestOptions.headers['content-type'] = part.contentType;
	}

	const maxAttempts = options.maxAttempts ?? 4;

	for (let attempt = 1; ; attempt++) {
		await waitForSlot.call(this, connection, options.budget);

		let response: IDataObject;

		try {
			if (connection.kind === 'oauth2') {
				// `tokenType: 'OAuth'` is the whole reason this branch exists. Metrica
				// rejects `Authorization: Bearer <token>` with 401 and accepts only the
				// OAuth prefix, which n8n would otherwise never send.
				response = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					CONNECTED_CREDENTIAL,
					requestOptions,
					{ oauth2: { tokenType: 'OAuth' } },
				)) as IDataObject;
			} else {
				// `httpRequest`, not `httpRequestWithAuthentication`: the token
				// credential has no `authenticate` block to apply, on purpose, so the
				// header is attached here.
				response = (await this.helpers.httpRequest({
					...requestOptions,
					headers: { ...requestOptions.headers, Authorization: `OAuth ${connection.token}` },
				})) as IDataObject;
			}
		} catch (error) {
			// Status errors are switched off above, so anything here is a transport
			// failure: DNS, TLS, a reset connection.
			if (attempt < maxAttempts) {
				await sleep(backoffDelay(attempt, error));
				continue;
			}

			throw toMetricaError(this.getNode(), error, extractStatusCode(error));
		}

		const status = Number(response.statusCode);
		const payload = options.file === undefined ? response.body : parseJson(response.body);
		const replayable = options.readOnly === true || method === 'GET' || method === 'HEAD';

		if (status === 429 || (replayable && RETRYABLE_READ_STATUSES.has(status))) {
			if (attempt < maxAttempts) {
				await sleep(backoffDelay(attempt, { response }));
				continue;
			}
		}

		if (status >= 400) {
			const errorBody = metricaErrorBody(payload);

			// A parallel-request refusal is the one 429 that clears on its own within
			// a second, so it is worth one more attempt even past the budget above.
			if (errorTypeOf(errorBody) === 'quota_parallel_requests' && attempt < maxAttempts) {
				await sleep(backoffDelay(attempt, { response }));
				continue;
			}

			throw toMetricaError(this.getNode(), payload ?? response, status);
		}

		return payload;
	}
}

/**
 * Reads every page of a list method, or stops once `limit` rows are in hand.
 *
 * Metrica pages the management lists with `offset` and `per_page`, and the
 * offset is **1-based** — starting at 0 returns the first page twice on some
 * methods and an error on others. The report API uses the same pair of names
 * with a 1-based offset as well, so both go through here.
 */
export async function metricaApiRequestAllItems(
	this: MetricaContext,
	method: IHttpRequestMethods,
	endpoint: string,
	qs: IDataObject,
	settings: {
		listKey: string;
		limit?: number;
		pageSize?: number;
		budget?: MethodBudget;
		body?: IDataObject;
	},
): Promise<IDataObject[]> {
	const pageSize = Math.max(1, Math.min(settings.pageSize ?? 200, 1000));
	const wanted = settings.limit;

	const rows: IDataObject[] = [];
	let offset = 1;

	for (;;) {
		const take = wanted === undefined ? pageSize : Math.min(pageSize, wanted - rows.length);
		if (take <= 0) break;

		const payload = (await metricaApiRequest.call(
			this,
			method,
			endpoint,
			settings.body,
			{ ...qs, offset, per_page: take, limit: take },
			{ budget: settings.budget, readOnly: true },
		)) as IDataObject;

		const page = listFrom(payload, settings.listKey);
		rows.push(...page);

		if (page.length < take) break;

		offset += page.length;
	}

	return wanted === undefined ? rows : rows.slice(0, wanted);
}

/**
 * A read whose answer may be shared for a short while.
 *
 * Only the dropdowns use this. Opening a node with a counter picker and a goal
 * picker fires two requests, and the editor re-runs them whenever a dependent
 * field changes — against a budget of 5000 calls a day that the workflows doing
 * real work also spend. The window is short enough that a counter created a
 * moment ago shows up after a breath rather than after restarting n8n.
 */
export async function metricaCachedRequest(
	this: MetricaContext,
	endpoint: string,
	qs?: IDataObject,
	ttlMs = CONFIG_TTL_MS,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous by design
): Promise<any> {
	const credentialId =
		this.getNode().credentials?.[CONNECTED_CREDENTIAL]?.id ??
		this.getNode().credentials?.[TOKEN_CREDENTIAL]?.id ??
		'unbound';

	const key = `metrica|${credentialId}|${endpoint}|${JSON.stringify(compactQuery(qs))}`;

	return await cached(
		key,
		async () =>
			await metricaApiRequest.call(this, 'GET', endpoint, undefined, qs, {
				readOnly: true,
				maxAttempts: 2,
			}),
		ttlMs,
	);
}

/**
 * Pulls the rows out of an envelope named after the resource.
 *
 * Metrica is consistent about this — `counters`, `goals`, `segments`, `filters`,
 * `operations`, `grants`, `data` — but a few methods answer with a bare array
 * and no envelope at all, and a few answer with a single object where a list was
 * asked for. All three are handled here so no caller has to.
 */
export function listFrom(payload: unknown, key: string): IDataObject[] {
	if (Array.isArray(payload)) return payload as IDataObject[];

	if (payload !== null && typeof payload === 'object') {
		const value = (payload as IDataObject)[key];
		if (Array.isArray(value)) return value as IDataObject[];
		if (value !== undefined && value !== null && typeof value === 'object') {
			return [value as IDataObject];
		}
	}

	return [];
}
