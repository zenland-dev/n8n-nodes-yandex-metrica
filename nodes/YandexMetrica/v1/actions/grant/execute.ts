import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { unknownOperation } from '../../../../../utils/router';
import { counterFor, omitEmpty, toItems } from '../../helpers/request';
import { listFrom, metricaApiRequest } from '../../transport';

/**
 * The login this operation acts on.
 *
 * Metrica addresses a grant by login in the query string rather than by an id in
 * the path, which is why there is no grant id anywhere in this resource.
 */
function loginFor(this: IExecuteFunctions, itemIndex: number): string {
	const login = String(this.getNodeParameter('userLogin', itemIndex, '') ?? '').trim();

	if (login === '') {
		throw new NodeOperationError(this.getNode(), 'This operation needs a Yandex login', {
			description:
				'Fill in User Login. It is the login rather than the email address, unless the account is on a domain, in which case the whole address is the login.',
			itemIndex,
		});
	}

	return login;
}

function grantBody(this: IExecuteFunctions, itemIndex: number): IDataObject {
	return omitEmpty({
		user_login: this.getNodeParameter('userLogin', itemIndex, ''),
		perm: this.getNodeParameter('perm', itemIndex, ''),
		comment: this.getNodeParameter('comment', itemIndex, ''),
		partner_data_access: this.getNodeParameter('partnerDataAccess', itemIndex, false) || undefined,
	});
}

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const counter = counterFor.call(this, itemIndex);
	const base = `/management/v1/counter/${counter}`;

	switch (operation) {
		case 'getMany': {
			const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
			const limit = this.getNodeParameter('limit', itemIndex, 50) as number;

			const payload = await metricaApiRequest.call(
				this,
				'GET',
				`${base}/grants`,
				undefined,
				undefined,
				{ readOnly: true },
			);

			const rows = listFrom(payload, 'grants');

			return (returnAll ? rows : rows.slice(0, Math.max(1, limit))).map((row) => ({ json: row }));
		}

		case 'get': {
			const login = loginFor.call(this, itemIndex);

			const payload = (await metricaApiRequest.call(
				this,
				'GET',
				`${base}/grant`,
				undefined,
				{ user_login: login },
				{ readOnly: true },
			)) as IDataObject;

			return toItems(payload.grant ?? payload, { user_login: login });
		}

		case 'getMine': {
			const payload = (await metricaApiRequest.call(
				this,
				'GET',
				`${base}/my_grant`,
				undefined,
				undefined,
				{ readOnly: true },
			)) as IDataObject;

			return toItems(payload.grant ?? payload, { counter_id: Number(counter) });
		}

		case 'create': {
			const payload = (await metricaApiRequest.call(this, 'POST', `${base}/grants`, {
				grant: grantBody.call(this, itemIndex),
			})) as IDataObject;

			return toItems(payload.grant ?? payload, { created: true });
		}

		case 'update': {
			const login = loginFor.call(this, itemIndex);

			const payload = (await metricaApiRequest.call(
				this,
				'PUT',
				`${base}/grant`,
				{ grant: grantBody.call(this, itemIndex) },
				{ user_login: login },
			)) as IDataObject;

			return toItems(payload.grant ?? payload, { user_login: login, updated: true });
		}

		case 'delete': {
			const login = loginFor.call(this, itemIndex);

			const payload = await metricaApiRequest.call(this, 'DELETE', `${base}/grant`, undefined, {
				user_login: login,
			});

			return toItems(payload, { user_login: login, deleted: true });
		}

		case 'createPublic': {
			const payload = (await metricaApiRequest.call(this, 'POST', `${base}/public_grant`, {
				grant: omitEmpty({ perm: this.getNodeParameter('perm', itemIndex, 'public_stat') }),
			})) as IDataObject;

			return toItems(payload.grant ?? payload, { counter_id: Number(counter), public: true });
		}

		case 'deletePublic': {
			const payload = await metricaApiRequest.call(this, 'DELETE', `${base}/public_grant`);

			return toItems(payload, { counter_id: Number(counter), public: false });
		}

		default:
			throw unknownOperation.call(this, 'Access', operation, itemIndex);
	}
}
