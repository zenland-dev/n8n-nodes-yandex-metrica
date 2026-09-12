import type { Icon, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

import { API_BASE_URL } from './YandexMetricaApi.credentials';

/**
 * Every scope this node can need, asked for once.
 *
 * `metrika:write` already covers expenses, visitor parameters and offline data,
 * so the three narrow scopes are not requested — asking for them as well only
 * lengthens the consent screen. Read is asked for explicitly because write does
 * not imply it.
 *
 * Yandex separates scopes with spaces in the authorize URL.
 */
const SCOPES = 'metrika:read metrika:write';

/**
 * The full OAuth2 flow, and the reason to prefer it.
 *
 * A token pasted in by hand expires after about a year and takes the workflow
 * down with it at an hour nobody chose. Yandex hands out a refresh token with
 * this flow and n8n renews on its own, which is the whole difference — the API,
 * the host and the permissions are identical either way.
 *
 * The cost is setup: a Yandex application with a client secret, and n8n's OAuth
 * Redirect URL registered on it, which needs n8n to be reachable over HTTPS.
 * A self-hosted instance behind NAT cannot do that, and for it the token
 * credential in this package stays the right answer.
 */
export class YandexMetricaOAuth2Api implements ICredentialType {
	name = 'yandexMetricaOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'Yandex Metrica OAuth2 API';

	documentationUrl = 'https://yandex.ru/dev/metrika/ru/intro/authorization';

	icon: Icon = {
		light: 'file:../icons/yandex-metrica.svg',
		dark: 'file:../icons/yandex-metrica.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName:
				'Create an application at oauth.yandex.ru — pick "Веб-сервисы", tick metrika:read and metrika:write, and paste n8n\'s OAuth Redirect URL into the application\'s Redirect URI before connecting.',
			name: 'setupNotice',
			type: 'notice',
			default: '',
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
				'The daily budget this credential may spend. Yandex allows 5000 per account per day, resets at 00:00 UTC, and counts every integration signed in as that account.',
		},
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: 'https://oauth.yandex.ru/authorize',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: 'https://oauth.yandex.ru/token',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: SCOPES,
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: '',
		},
		{
			// Yandex accepts the client secret either in the body or as a Basic header.
			// Body, because that is the form its own documentation writes out in full;
			// the header is shown there as an optional alternative.
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
		{
			// Without this, n8n injects the same setting with "All" selected, and any
			// user who can pick this credential in an HTTP Request node could have the
			// token attached to a request going anywhere. Declaring it skips the
			// injection; the node's own calls never read it.
			displayName: 'Allowed HTTP Request Domains',
			name: 'allowedHttpRequestDomains',
			type: 'hidden',
			default: 'none',
		},
	];

	/**
	 * The token has to be spelled out here.
	 *
	 * n8n attaches `Bearer` to a credential test on an OAuth2 type, and Metrica
	 * answers 401 to `Bearer` — it wants `Authorization: OAuth <token>` and
	 * nothing else. So the header is written by hand from the stored token data,
	 * the same prefix the node's transport asks for at run time.
	 */
	test: ICredentialTestRequest = {
		request: {
			baseURL: API_BASE_URL,
			url: '/management/v1/counters',
			qs: { per_page: 1, field: '' },
			headers: {
				Authorization: '=OAuth {{ $credentials.oauthTokenData.access_token }}',
			},
		},
		rules: [
			{
				type: 'responseCode',
				properties: {
					value: 403,
					message:
						'Связь установлена, но у приложения нет прав на Метрику. Open the application at oauth.yandex.ru, tick metrika:read and metrika:write, then reconnect — an application changed after the fact does not upgrade tokens it has already issued.',
				},
			},
		] as ICredentialTestRequest['rules'],
	};
}
