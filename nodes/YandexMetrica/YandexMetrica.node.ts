import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { routeItems } from '../../utils/router';
import { resourceProperties, resourceProperty, resources } from './v1/actions';
import { loadOptions } from './v1/methods';

export class YandexMetrica implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Yandex Metrica',
		name: 'yandexMetrica',
		icon: {
			light: 'file:../../icons/yandex-metrica.svg',
			dark: 'file:../../icons/yandex-metrica.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description:
			'Read Yandex Metrica reports and raw visit logs, manage counters, goals and segments, and feed offline conversions, calls, costs and CRM data back into a counter',
		defaults: { name: 'Yandex Metrica' },
		usableAsTool: true,
		// Read by n8n's node catalog (@n8n/ai-utilities): searchHint is printed
		// verbatim to a model choosing a node, and it is the only place to say what
		// no single operation description can.
		builderHint: {
			searchHint:
				"Yandex Metrica is the web analytics service most Russian-language sites run, the local counterpart to Google Analytics, and this node covers its whole API through one credential. Everything names a COUNTER — the number in the site's tag — and one OAuth token opens every counter the account can see, so an agency keeps one credential and picks the counter per operation. Four different things live here and they are easy to confuse. The Report resource returns aggregated numbers the way the Metrica interface draws them: pick dimensions to group by and metrics to count, both written with a namespace prefix such as ym:s: for visits or ym:pv: for pageviews. The Log resource returns RAW rows, one per visit or per pageview, and it is asynchronous — create a request, wait for it to be processed, download it in parts, then clean it up, because a counter has only 10 GB of log storage and a node that never cleans will eventually wedge. Counter, Goal, Segment, Filter, Operation, Annotation and Access are configuration rather than data. The import resources go the other way, feeding Metrica facts the browser never saw: Offline Conversion for a deal closed by phone, Call, Chat, Expense for advertising spend a channel has no integration for, Visitor Parameter, and CRM Contact with CRM Order for end-to-end sales analytics. Event is different again: it sends a hit straight to Metrica through the Measurement Protocol on a different host, and it can only attach to a visit that ended less than 12 hours ago — anything older has to go through Offline Conversion instead. Quotas are per ACCOUNT, not per workflow: 5000 calls a day resetting at midnight UTC, 30 a second, 200 report calls per five minutes, 10 a second for logs. This node paces itself against all of those and refuses rather than queues when the daily budget is gone.",
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'yandexMetricaApi',
				required: true,
				displayOptions: { show: { authentication: ['accessToken'] } },
			},
			{
				name: 'yandexMetricaOAuth2Api',
				required: true,
				displayOptions: { show: { authentication: ['oAuth2'] } },
			},
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				noDataExpression: true,
				default: 'accessToken',
				options: [
					{
						name: 'Access Token',
						value: 'accessToken',
						description:
							'Токен, скопированный из адресной строки. Set up in five minutes and works on an n8n that nothing can reach from outside, but it expires after about a year and stops without warning.',
					},
					{
						name: 'OAuth2',
						value: 'oAuth2',
						description:
							'Полный вход через Яндекс OAuth. Needs an application with a client secret and an n8n reachable over HTTPS, and in exchange n8n renews the token by itself.',
					},
				],
			},
			resourceProperty,
			...resourceProperties,
		],
	};

	methods = { loadOptions };

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await routeItems.call(this, resources);
	}
}
