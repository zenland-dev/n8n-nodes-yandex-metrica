import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { omitEmpty } from '../../helpers/request';
import { crudExecute } from '../shared/crud';

/**
 * The filter object.
 *
 * `with_subdomains` is sent as a real boolean rather than dropped when false:
 * Metrica keeps the previous value for a field left out of an update, so an
 * untouched switch would quietly stay on.
 */
function buildBody(this: IExecuteFunctions, itemIndex: number): IDataObject {
	const type = this.getNodeParameter('type', itemIndex, 'equal') as string;

	const filter: IDataObject = omitEmpty({
		attr: this.getNodeParameter('attr', itemIndex, ''),
		type,
		value: this.getNodeParameter('value', itemIndex, ''),
		action: this.getNodeParameter('filterAction', itemIndex, ''),
		status: this.getNodeParameter('status', itemIndex, ''),
	});

	filter.with_subdomains = this.getNodeParameter('withSubdomains', itemIndex, false);

	if (type === 'interval') {
		filter.start_ip = this.getNodeParameter('startIp', itemIndex, '');
		filter.end_ip = this.getNodeParameter('endIp', itemIndex, '');
	}

	return filter;
}

export const execute = crudExecute({
	resource: 'filter',
	label: 'Filter',
	idName: 'filterId',
	listPath: 'filters',
	itemPath: 'filter',
	listKey: 'filters',
	itemKey: 'filter',
	buildBody,
});
