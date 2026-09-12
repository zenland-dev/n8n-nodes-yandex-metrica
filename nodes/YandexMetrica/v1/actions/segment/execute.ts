import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { omitEmpty } from '../../helpers/request';
import { crudExecute } from '../shared/crud';

function buildBody(this: IExecuteFunctions, itemIndex: number): IDataObject {
	return omitEmpty({
		name: this.getNodeParameter('name', itemIndex, ''),
		expression: this.getNodeParameter('expression', itemIndex, ''),
	});
}

export const execute = crudExecute({
	resource: 'segment',
	label: 'Segment',
	idName: 'segmentId',
	listPath: 'apisegment/segments',
	itemPath: 'apisegment/segment',
	listKey: 'segments',
	itemKey: 'segment',
	buildBody,
});
