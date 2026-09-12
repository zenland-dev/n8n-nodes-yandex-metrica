import type { Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * The one host Yandex Metrica serves its API on.
 *
 * Reports, raw logs, counter management and every kind of data import live here;
 * only the Measurement Protocol is elsewhere, on `mc.yandex.ru`. CRM data is not
 * a separate service either — it sits on this host under `/cdp/api/v1/` instead
 * of `/management/v1/`. So there is no address field in this credential at all,
 * and therefore nothing a user could point somewhere unintended.
 */
export const API_BASE_URL = 'https://api-metrika.yandex.net';

/** Where Measurement Protocol events go. The only call that leaves the host above. */
export const COLLECT_URL = 'https://mc.yandex.ru/collect';

/**
 * The scopes a Yandex OAuth application can be given, and what each unlocks.
 *
 * These are fixed when the token is issued, not when this credential is filled
 * in, which is the trap worth knowing about: a token minted with `metrika:read`
 * alone saves without complaint, tests green, and then fails on the first upload
 * with a bare "Access is denied" that names no scope. The transport turns that
 * 403 into a message naming the one that is missing; this table is what it names.
 */
export const SCOPE_FOR = {
	read: 'metrika:read',
	write: 'metrika:write',
	expenses: 'metrika:expenses',
	userParams: 'metrika:user_params',
	offlineData: 'metrika:offline_data',
} as const;

/**
 * What the Test button asks.
 *
 * `GET /management/v1/counters?per_page=1` is the cheapest call in the API that
 * still proves the token is real: it needs only `metrika:read`, answers in well
 * under a kilobyte, and exists for every account including one with no counters
 * at all. Nothing that needs `metrika:write` is used here on purpose — testing
 * with a write method would fail a read-only token that is perfectly good for
 * the reports half of this node.
 */
const TEST_URL = `${API_BASE_URL}/management/v1/counters?per_page=1&field=`;

const TEST_RULES: ICredentialTestRequest['rules'] = [
	{
		type: 'responseCode',
		properties: {
			value: 401,
			message:
				'Яндекс не принял токен. Either it was mistyped, or it has expired — a token issued through the OAuth link lives about a year and then stops without warning. Issue a new one, or switch this node to the OAuth2 credential, which n8n refreshes by itself.',
		},
	},
	{
		type: 'responseCode',
		properties: {
			value: 403,
			message:
				'Токен есть, но прав нет. The application it was issued for has no access to Metrica: it needs at least metrika:read, and metrika:write for anything this node uploads. Check the application at oauth.yandex.ru, then reissue the token — changing the application does not change tokens already handed out.',
		},
	},
	{
		type: 'responseCode',
		properties: {
			value: 429,
			message:
				'Проверка упёрлась в квоту. Yandex allows 5000 requests a day per account and 30 a second per address, counted across every integration using this login. Wait and test again.',
		},
	},
] as ICredentialTestRequest['rules'];

/**
 * A ready-made OAuth token, pasted in.
 *
 * This is the five-minute path the Metrica documentation itself describes: create
 * an application at oauth.yandex.ru, open one URL, copy the token out of the
 * address bar. It needs no public HTTPS callback, which matters for a self-hosted
 * n8n behind NAT, and it is the only option when somebody has been handed a token
 * without being given the application behind it.
 *
 * Its cost is the expiry. A token minted this way lasts roughly a year and then
 * simply stops; nothing refreshes it. For anything long-lived prefer the OAuth2
 * credential in this package.
 *
 * There is deliberately no `authenticate` block. Declaring one would make n8n
 * offer this credential inside an HTTP Request node, where anyone who can edit a
 * workflow could point it at any address and have n8n attach the token. The node
 * builds the `Authorization` header itself instead.
 */
export class YandexMetricaApi implements ICredentialType {
	name = 'yandexMetricaApi';

	displayName = 'Yandex Metrica API';

	documentationUrl = 'https://yandex.ru/dev/metrika/ru/intro/authorization';

	icon: Icon = {
		light: 'file:../icons/yandex-metrica.svg',
		dark: 'file:../icons/yandex-metrica.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'OAuth-токен Яндекса. Create an application at oauth.yandex.ru with the metrika:read and metrika:write permissions, then open https://oauth.yandex.ru/authorize?response_type=token&client_id=<ID> and copy the token from the address bar. The token belongs to the account that was signed in at that moment, not to whoever owns the application.',
		},
		{
			displayName: 'Requests per Second',
			name: 'requestsPerSecond',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 30 },
			default: 8,
			description:
				'How fast this credential may call Metrica. Yandex allows 30 a second from one address for the API and only 10 for Logs API, and answers 429 above that, so the default leaves room for whatever else runs on the same server.',
		},
		{
			displayName: 'Requests per Day',
			name: 'requestsPerDay',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 5000 },
			default: 4000,
			description:
				'The daily budget this credential may spend. Yandex allows 5000 per account per day, resets at 00:00 UTC, and counts every integration signed in as that account — so the default keeps one busy workflow from locking the account out until midnight.',
		},
	];

	test: ICredentialTestRequest = {
		request: {
			url: TEST_URL,
			method: 'GET',
			headers: {
				Authorization: '=OAuth {{ $credentials.accessToken }}',
			},
		},
		rules: TEST_RULES,
	};
}
