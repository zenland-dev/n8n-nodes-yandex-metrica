import type { INodeProperties } from 'n8n-workflow';

import type { ResourceModule } from '../../../../utils/router';
import * as annotation from './annotation';
import * as call from './call';
import * as chat from './chat';
import * as counter from './counter';
import * as crmContact from './crmContact';
import * as crmOrder from './crmOrder';
import * as event from './event';
import * as expense from './expense';
import * as filter from './filter';
import * as goal from './goal';
import * as grant from './grant';
import * as log from './log';
import * as offlineConversion from './offlineConversion';
import * as operation from './operation';
import * as report from './report';
import * as segment from './segment';
import * as userParam from './userParam';

/** Keyed by the `resource` value, which is part of every saved workflow. */
export const resources: Record<string, ResourceModule> = {
	annotation,
	call,
	chat,
	counter,
	crmContact,
	crmOrder,
	event,
	expense,
	filter,
	goal,
	grant,
	log,
	offlineConversion,
	operation,
	report,
	segment,
	userParam,
};

/**
 * Kept alphabetical: the linter enforces it, and so does finding things.
 *
 * The list divides into four groups that have nothing to do with each other, and
 * the descriptions are written to make which is which obvious at a glance.
 * Report and Log read numbers out. Counter, Goal, Segment, Filter, Operation,
 * Annotation and Access are settings. The six import resources push facts in
 * that the browser never saw. Event is its own thing: a hit sent live to a
 * different host under a different secret.
 */
export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	default: 'report',
	options: [
		{
			name: 'Access',
			value: 'grant',
			description:
				'Кому открыт счётчик: выдача и отзыв доступа логинам, публичный доступ по ссылке',
		},
		{
			name: 'Advertising Cost',
			value: 'expense',
			description:
				'Расходы по каналам, у которых нет своей интеграции. The half of ROI Metrica cannot collect on its own.',
		},
		{
			name: 'Annotation',
			value: 'annotation',
			description: 'Примечания на графиках — релизы, запуски кампаний, аварии',
		},
		{
			name: 'Call',
			value: 'call',
			description: 'Загрузка звонков из своей телефонии, с длительностью и исходом',
		},
		{
			name: 'Chat',
			value: 'chat',
			description: 'Загрузка переписок из мессенджеров, привязанных к визиту',
		},
		{
			name: 'Counter',
			value: 'counter',
			description: 'Счётчики и метки: создать, настроить, разложить по клиентам',
		},
		{
			name: 'CRM Contact',
			value: 'crmContact',
			description:
				'Клиенты из CRM и справочник их полей. Upload these before the orders that point at them.',
		},
		{
			name: 'CRM Order',
			value: 'crmOrder',
			description:
				'Сделки из CRM, сопоставление статусов и справочник товаров. The status mapping is what makes a funnel possible.',
		},
		{
			name: 'Event',
			value: 'event',
			description:
				'Серверная отправка события в счётчик через Measurement Protocol. Only reaches visits that ended less than 12 hours ago.',
		},
		{
			name: 'Filter',
			value: 'filter',
			description:
				'Что счётчик не записывает. Excluded traffic is never stored, so a filter cannot be undone after the fact.',
		},
		{
			name: 'Goal',
			value: 'goal',
			description: 'Цели, по которым считаются конверсии',
		},
		{
			name: 'Log',
			value: 'log',
			description:
				'Сырые визиты и просмотры через Logs API: заказать выгрузку, дождаться, скачать, очистить. The cleanup is not optional — the storage quota is 10 GB per counter.',
		},
		{
			name: 'Offline Conversion',
			value: 'offlineConversion',
			description:
				'Конверсии, случившиеся вне сайта. The way anything older than 12 hours gets into Metrica.',
		},
		{
			name: 'Operation',
			value: 'operation',
			description: 'Правки адресов при сборе: отрезать метки, склеить http и https',
		},
		{
			name: 'Report',
			value: 'report',
			description:
				'Агрегированные отчёты: таблица, ряд по времени, drill down, сравнение периодов, сводная таблица',
		},
		{
			name: 'Segment',
			value: 'segment',
			description:
				'Сегменты, созданные через API. Ones saved in the Metrica interface are not visible here.',
		},
		{
			name: 'Visitor Parameter',
			value: 'userParam',
			description:
				'Параметры посетителей из своих систем. An upload does nothing until it is confirmed.',
		},
	],
};

export const resourceProperties: INodeProperties[] = Object.values(resources).flatMap(
	(module) => module.description,
);
