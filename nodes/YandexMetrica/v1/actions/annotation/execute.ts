import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { omitEmpty, toMetricaDate } from '../../helpers/request';
import { crudExecute } from '../shared/crud';

function buildBody(this: IExecuteFunctions, itemIndex: number): IDataObject {
	return omitEmpty({
		date: toMetricaDate(this.getNodeParameter('date', itemIndex, '')),
		time: this.getNodeParameter('time', itemIndex, ''),
		title: this.getNodeParameter('title', itemIndex, ''),
		message: this.getNodeParameter('message', itemIndex, ''),
		group: this.getNodeParameter('group', itemIndex, ''),
	});
}

export const execute = crudExecute({
	resource: 'annotation',
	label: 'Annotation',
	idName: 'annotationId',
	listPath: 'chart_annotations',
	itemPath: 'chart_annotation',
	listKey: 'chart_annotations',
	itemKey: 'chart_annotation',
	buildBody,
});
