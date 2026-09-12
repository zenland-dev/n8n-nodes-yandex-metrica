import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { unknownOperation } from '../../../../../utils/router';
import { counterIdProperty, returnAllProperties } from '../../descriptions/common';
import { counterFor, toItems } from '../../helpers/request';
import { listFrom, metricaApiRequest } from '../../transport';

/**
 * Five of Metrica's resources are the same resource with different nouns.
 *
 * Goals, filters, operations, segments and annotations all hang off a counter,
 * all answer `{"<plural>": [...]}` for a list and `{"<singular>": {...}}` for
 * one, and all take create, read, update and delete at the same two URLs. What
 * differs is the noun in the path, the noun in the envelope, and the fields the
 * body carries — so those are the arguments here and everything else is written
 * once.
 *
 * None of the five is paginated by the API: a counter holds tens of goals, not
 * thousands, and Metrica returns the lot. Return All and Limit are still offered
 * because a workflow that wants five rows should not have to add a node to trim
 * them, but the trimming happens here rather than in the request.
 */
export interface CrudConfig {
	/** The `resource` value, which is part of every saved workflow. */
	resource: string;
	/** How the resource is named in error messages. */
	label: string;
	/** The node parameter holding the object's id. */
	idName: string;
	/** Path segment for the collection, after `/management/v1/counter/{id}/`. */
	listPath: string;
	/** Path segment for one object, which the id is appended to. */
	itemPath: string;
	/** Key the API lists rows under. */
	listKey: string;
	/** Key the API returns one object under, and wraps a request body in. */
	itemKey: string;
	/** Builds the body for create and update from this item's fields. */
	buildBody(this: IExecuteFunctions, itemIndex: number, operation: string): IDataObject;
}

/** The operation selector, with the wording each resource supplies. */
export function crudOperations(
	resource: string,
	defaultOperation: string,
	descriptions: Record<'create' | 'delete' | 'get' | 'getMany' | 'update', string>,
	actions: Record<'create' | 'delete' | 'get' | 'getMany' | 'update', string>,
): INodeProperties {
	return {
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: defaultOperation,
		displayOptions: { show: { resource: [resource] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: actions.create,
				description: descriptions.create,
			},
			{
				name: 'Delete',
				value: 'delete',
				action: actions.delete,
				description: descriptions.delete,
			},
			{ name: 'Get', value: 'get', action: actions.get, description: descriptions.get },
			{
				name: 'Get Many',
				value: 'getMany',
				action: actions.getMany,
				description: descriptions.getMany,
			},
			{
				name: 'Update',
				value: 'update',
				action: actions.update,
				description: descriptions.update,
			},
		],
	};
}

/** The counter, the id and the paging fields every one of the five needs. */
export function crudCommonProperties(
	resource: string,
	idName: string,
	idLabel: string,
	idDescription: string,
	loadOptionsMethod?: string,
): INodeProperties[] {
	const idProperty: INodeProperties = {
		displayName: loadOptionsMethod === undefined ? idLabel : `${idLabel} Name or ID`,
		name: idName,
		type: loadOptionsMethod === undefined ? 'string' : 'options',
		default: '',
		required: true,
		displayOptions: { show: { resource: [resource], operation: ['get', 'update', 'delete'] } },
		description: idDescription,
	};

	if (loadOptionsMethod !== undefined) {
		idProperty.typeOptions = { loadOptionsMethod };
	}

	return [
		{ ...counterIdProperty, displayOptions: { show: { resource: [resource] } } },
		idProperty,
		...returnAllProperties(resource, ['getMany']),
	];
}

/** The object's id for this item, as a bare number. */
function idFor(this: IExecuteFunctions, config: CrudConfig, itemIndex: number): string {
	const id = String(this.getNodeParameter(config.idName, itemIndex, '') ?? '').replace(
		/[^0-9]/g,
		'',
	);

	if (id === '') {
		throw new NodeOperationError(this.getNode(), `This operation needs a ${config.label} ID`, {
			description: `Fill in the id field, or set it to an expression. Get Many lists what the counter has.`,
			itemIndex,
		});
	}

	return id;
}

/** Builds the execute function for one of the five. */
export function crudExecute(config: CrudConfig) {
	return async function execute(
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
					`${base}/${config.listPath}`,
					undefined,
					undefined,
					{ readOnly: true },
				);

				const rows = listFrom(payload, config.listKey);
				const kept = returnAll ? rows : rows.slice(0, Math.max(1, limit));

				return kept.map((row) => ({ json: row }));
			}

			case 'get': {
				const id = idFor.call(this, config, itemIndex);

				const payload = (await metricaApiRequest.call(
					this,
					'GET',
					`${base}/${config.itemPath}/${id}`,
					undefined,
					undefined,
					{ readOnly: true },
				)) as IDataObject;

				return toItems(payload[config.itemKey] ?? payload, { id: Number(id) });
			}

			case 'create': {
				const body = config.buildBody.call(this, itemIndex, operation);

				const payload = (await metricaApiRequest.call(this, 'POST', `${base}/${config.listPath}`, {
					[config.itemKey]: body,
				})) as IDataObject;

				return toItems(payload[config.itemKey] ?? payload, { created: true });
			}

			case 'update': {
				const id = idFor.call(this, config, itemIndex);
				const body = config.buildBody.call(this, itemIndex, operation);

				if (Object.keys(body).length === 0) {
					throw new NodeOperationError(this.getNode(), 'Nothing to update', {
						description: 'Set at least one field before running this operation.',
						itemIndex,
					});
				}

				const payload = (await metricaApiRequest.call(
					this,
					'PUT',
					`${base}/${config.itemPath}/${id}`,
					{ [config.itemKey]: body },
				)) as IDataObject;

				return toItems(payload[config.itemKey] ?? payload, { id: Number(id), updated: true });
			}

			case 'delete': {
				const id = idFor.call(this, config, itemIndex);

				const payload = await metricaApiRequest.call(
					this,
					'DELETE',
					`${base}/${config.itemPath}/${id}`,
				);

				return toItems(payload, { id: Number(id), deleted: true });
			}

			default:
				throw unknownOperation.call(this, config.label, operation, itemIndex);
		}
	};
}
