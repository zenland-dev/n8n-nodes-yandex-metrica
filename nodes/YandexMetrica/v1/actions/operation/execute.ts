import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { omitEmpty } from '../../helpers/request';
import { crudExecute } from '../shared/crud';

function buildBody(this: IExecuteFunctions, itemIndex: number): IDataObject {
	return omitEmpty({
		action: this.getNodeParameter('operationAction', itemIndex, ''),
		attr: this.getNodeParameter('attr', itemIndex, ''),
		value: this.getNodeParameter('value', itemIndex, ''),
		status: this.getNodeParameter('status', itemIndex, ''),
	});
}

export const execute = crudExecute({
	resource: 'operation',
	label: 'Operation',
	idName: 'operationId',
	listPath: 'operations',
	itemPath: 'operation',
	listKey: 'operations',
	itemKey: 'operation',
	buildBody,
});
