import type { IDataObject, INode, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

/**
 * What a refused Metrica request looks like.
 *
 * Documented at yandex.ru/dev/metrika/ru/intro/errors: a list of `errors`, each
 * with a machine-readable `error_type`, plus the HTTP status repeated in `code`
 * and a human sentence in `message`. Every API in the service uses this shape,
 * Logs and reports included.
 */
export interface MetricaErrorBody {
	errors?: Array<{ error_type?: string; message?: string; location?: string }>;
	code?: number;
	message?: string;
}

/**
 * The advice that is worth more than Yandex's own sentence.
 *
 * Only the types where the API's wording leaves the user guessing are listed.
 * `invalid_parameter` and `not_found` already say which parameter and which
 * object, so repeating them here would bury the detail under a generic line.
 *
 * The 403s are the ones that matter most. Yandex answers a token with the wrong
 * scope and a token with no access to the counter identically — "Access is
 * denied" and nothing else — and those two need completely different fixes.
 */
const ADVICE: Record<string, string> = {
	invalid_token:
		'Токен недействителен. A token pasted by hand lives about a year and then stops; the OAuth2 credential in this package renews itself instead. Reissue it at oauth.yandex.ru and paste the new one.',
	unauthorized:
		'Запрос ушёл без токена или с нечитаемым токеном. Check that the credential is selected on this node and that the token field is not empty.',
	access_denied:
		'Метрика отказала в доступе, и одинаково отвечает на две разные причины. Either the token was issued without the permission this operation needs — metrika:read for reading, metrika:write for anything that changes or uploads — or the account that owns the token has no access to this counter. Check the application at oauth.yandex.ru first, since reissuing the token is what applies a changed permission; then check Настройки счётчика → Доступ.',
	counter_in_connect:
		'Счётчик принадлежит организации в Яндекс Коннекте, и права на него раздаются только в интерфейсе Коннекта. The API cannot change access for this counter at all.',
	quota_requests_by_uid:
		'Исчерпан суточный лимит: 5000 запросов на аккаунт, сбрасывается в 00:00 UTC. It is counted across every integration signed in as this account, so another workflow may have spent it. Lower Requests per Day on the credential to keep one workflow from taking the whole budget.',
	quota_requests_by_ip:
		'Слишком много запросов в секунду с этого адреса: 30 для API и 10 для Logs API. Lower Requests per Second on the credential.',
	quota_parallel_requests:
		'Больше трёх одновременных запросов от одного аккаунта Метрика не принимает. Reduce the node concurrency, or split the workflow so fewer branches call Metrica at once.',
	quota_requests_by_counter_id:
		'Исчерпан суточный лимит запросов по этому счётчику. Unlike the account quota this one follows the counter, so every integration reading it shares the budget.',
	quota_delegate_requests:
		'Представителей можно добавлять не чаще трёх в час. The window clears at the top of each hour.',
	quota_grants_requests:
		'Доступы к счётчику выдаются не чаще трёх в час. The window clears at the top of each hour.',
	too_much_rows:
		'Запрос читает слишком много данных. Narrow the date range, add a filter, or ask for fewer dimensions at once — a report grouped by several high-cardinality dimensions grows faster than the limit allows.',
	query_error:
		'Запрос слишком сложный для Метрики. Usually too many dimensions, metrics or filter conditions in one call. Split it into several.',
	filter_limits:
		'Фильтр сложнее, чем Метрика принимает. Reduce the number of conditions.',
	invalid_json:
		'Метрика не разобрала переданный JSON. Check the field this operation sends as raw JSON — a trailing comma or a single-quoted key is enough.',
	invalid_uploading:
		'Загруженный файл отвергнут. Check the column names against the documentation for this upload type: Metrica matches them by name and ignores order, but a misspelled one makes the whole upload invalid.',
	limit_exceeded:
		'Достигнут потолок целей, операций или фильтров на счётчике. Delete something before adding more; the limits are per counter and Metrica does not raise them by request.',
	backend_error: 'Метрика ответила внутренней ошибкой. This one is worth retrying later.',
	timeout:
		'Метрика не уложилась в отведённое время. For a report, narrow the range or the grouping; for Logs API, ask for fewer fields.',
	conflict:
		'Нарушение целостности: объект с такими данными уже есть или изменился между чтением и записью.',
};

/** Pulls Metrica's own error envelope out of whatever shape it arrived in. */
export function metricaErrorBody(candidate: unknown): MetricaErrorBody | undefined {
	if (candidate === null || typeof candidate !== 'object') return undefined;

	const body = candidate as MetricaErrorBody;
	if (Array.isArray(body.errors) || typeof body.message === 'string') return body;

	return undefined;
}

/** The first `error_type` the body names, which is the one that caused the refusal. */
export function errorTypeOf(body: MetricaErrorBody | undefined): string | undefined {
	const first = body?.errors?.[0]?.error_type;
	return typeof first === 'string' ? first : undefined;
}

/**
 * Turns a refusal into an error a user can act on.
 *
 * Metrica's own `message` is kept as the headline — it names the parameter or
 * the object, which no generic sentence can — and the advice above is attached
 * underneath only where the service's wording is genuinely ambiguous.
 */
export function toMetricaError(node: INode, error: unknown, status?: number): NodeApiError {
	const body = metricaErrorBody(error) ?? metricaErrorBody((error as IDataObject)?.body);
	const type = errorTypeOf(body);

	const detail = body?.errors?.[0]?.message ?? body?.message;
	const message = typeof detail === 'string' && detail !== '' ? detail : undefined;

	const description = type !== undefined ? ADVICE[type] : undefined;

	return new NodeApiError(node, (error ?? {}) as JsonObject, {
		message,
		description,
		httpCode: status !== undefined ? String(status) : undefined,
	});
}
