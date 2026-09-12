import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { jsonParameter, omitEmpty } from '../../helpers/request';
import { crudExecute } from '../shared/crud';

/**
 * The goal object, assembled from the fields the node offers.
 *
 * `depth` carries two different meanings because Metrica does: a page-depth goal
 * counts pages in `depth`, and a duration goal counts seconds in the same field.
 * Only one of the two is ever visible at a time, so the field is written for
 * whichever type is selected and left out otherwise.
 */
function buildBody(this: IExecuteFunctions, itemIndex: number): IDataObject {
	const type = this.getNodeParameter('type', itemIndex, 'action') as string;

	const conditions = (
		(this.getNodeParameter('conditions', itemIndex, {}) as IDataObject).condition ?? []
	) as IDataObject[];

	const goal: IDataObject = omitEmpty({
		name: this.getNodeParameter('name', itemIndex, ''),
		type,
		default_price: this.getNodeParameter('defaultPrice', itemIndex, 0) || undefined,
		is_favorite: this.getNodeParameter('isFavorite', itemIndex, false) ? 1 : undefined,
	});

	if (type === 'number' || type === 'time') {
		goal.depth = this.getNodeParameter('depth', itemIndex, 2);
	} else if (conditions.length > 0) {
		goal.conditions = conditions.map((condition) => ({
			type: condition.type,
			url: condition.url,
		}));
	}

	const raw = jsonParameter.call(this, 'goalJson', 'Raw Goal JSON', itemIndex);
	if (raw !== undefined && typeof raw === 'object') Object.assign(goal, raw as IDataObject);

	return goal;
}

export const execute = crudExecute({
	resource: 'goal',
	label: 'Goal',
	idName: 'goalId',
	listPath: 'goals',
	itemPath: 'goal',
	listKey: 'goals',
	itemKey: 'goal',
	buildBody,
});
