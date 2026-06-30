// src/application/tasks/taskQuery.service.ts

import type { Task } from '@/domain/tasks/task.types';

import {
  countEvidencesByTask,
  getEvidenceById,
  listEvidencesByTask,
} from '@/infrastructure/db/repositories/evidenceRepository';
import { countGpsPointsByTask } from '@/infrastructure/db/repositories/gpsRepository';
import {
  countRecoveredDevicesByTask,
  listRecoveredDevicesByManagement,
  listRecoveredDevicesByTask,
} from '@/infrastructure/db/repositories/recoveredDeviceRepository';
import { countPendingSyncItems } from '@/infrastructure/db/repositories/syncQueueRepository';
import { listTaskEvents } from '@/infrastructure/db/repositories/taskEventRepository';
import {
  countTaskManagementsByTask,
  listTaskManagementsByTask,
} from '@/infrastructure/db/repositories/taskManagementRepository';
import {
  getTaskById,
  listTasks,
} from '@/infrastructure/db/repositories/taskRepository';

import { getActiveLocalSession } from '@/infrastructure/db/repositories/sessionRepository';
import {
  countSeriesByTask,
  listTaskSeries,
} from '@/infrastructure/db/repositories/taskSeriesRepository';
import { getDisplayZone } from '@/shared/zones';

export type TaskListFilter = {
  status?: Task['status'];
  scheduledDate?: string;
  search?: string;
  fieldOperationType?: Task['fieldOperationType'];
};

export type TaskListItem = {
  id: string;
  remoteId?: string;
  taskNumber?: string;
  orderCode?: string;
  project?: string;
  routeNumber?: string;
  guideNumber?: string;
  fieldOperationType?: Task['fieldOperationType'];
  lastMileTaskType?: Task['lastMileTaskType'];
  packageCount?: number;
  liquidationStatus?: Task['liquidationStatus'];
  hasPendingLiquidation?: boolean;
  customerName?: string;
  customerDocument?: string;
  customerPhone?: string;
  department?: string;
  province?: string;
  district?: string;
  address?: string;
  latitude?: Task['latitude'];
  longitude?: Task['longitude'];
  zone?: string;
  scheduledDate?: string;
  timeRange?: string;
  taskType?: string;
  priority?: Task['priority'];
  status: Task['status'];
  syncStatus: Task['syncStatus'];
  isDirty: boolean;
  isLocked: boolean;
  lockReason?: string;
};

export type TaskManagementRecoveredDeviceSnapshot = {
  device: Awaited<ReturnType<typeof listRecoveredDevicesByManagement>>[number];
  labelEvidence: Awaited<ReturnType<typeof getEvidenceById>>;
};

export type TaskManagementHistoryItem = {
  management: Awaited<ReturnType<typeof listTaskManagementsByTask>>[number];
  generalEvidence: Awaited<ReturnType<typeof getEvidenceById>>;
  recoveredDevices: TaskManagementRecoveredDeviceSnapshot[];
};

export type TaskDetailSnapshot = {
  task: Task | null;
  series: Awaited<ReturnType<typeof listTaskSeries>>;
  recoveredDevices: Awaited<ReturnType<typeof listRecoveredDevicesByTask>>;
  evidences: Awaited<ReturnType<typeof listEvidencesByTask>>;
  managementHistory: TaskManagementHistoryItem[];
  events: Awaited<ReturnType<typeof listTaskEvents>>;
  seriesCounters: Awaited<ReturnType<typeof countSeriesByTask>>;
  recoveredDeviceCounters: Awaited<ReturnType<typeof countRecoveredDevicesByTask>>;
  managementCounters: Awaited<ReturnType<typeof countTaskManagementsByTask>>;
  gpsCounters: Awaited<ReturnType<typeof countGpsPointsByTask>>;
  evidenceCounters: Awaited<ReturnType<typeof countEvidencesByTask>>;
};

export type AgentTaskSummary = {
  totalTasks: number;
  byStatus: {
    pending: number;
    inProgress: number;
    completed: number;
    unsuccessful: number;
    rescheduled: number;
    cancelled: number;
  };
  partialTasks: number;
  pendingLiquidationTasks: number;
  effectivenessGeneral: number;
  pendingSyncItems: number;
  dirtyTasks: number;
  conflictedTasks: number;
  lockedTasks: number;
};

export type AgentOperationAvailability = {
  inverse: number;
  lastMile: number;
};

function normalize(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function getTodayLimaDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function matchesSearch(task: Task, search?: string): boolean {
  const normalizedSearch = normalize(search);

  if (!normalizedSearch) {
    return true;
  }

  const searchableText = [
    task.taskNumber,
    task.orderCode,
    task.project,
    task.sot,
    task.routeNumber,
    task.guideNumber,
    task.customerName,
    task.customerDocument,
    task.customerPhone,
    task.department,
    task.province,
    task.district,
    task.address,
    task.reference,
    task.observations,
  ]
    .map((value) => normalize(value))
    .join(' ');

  return searchableText.includes(normalizedSearch);
}

function mapTaskToListItem(
  task: Task,
  effectiveStatus: Task['status'] = task.status
): TaskListItem {
  return {
    id: task.id,
    remoteId: task.remoteId,
    taskNumber: task.taskNumber,
    orderCode: task.orderCode,
    project: task.project,
    routeNumber: task.routeNumber,
    guideNumber: task.guideNumber,
    fieldOperationType: task.fieldOperationType,
    lastMileTaskType: task.lastMileTaskType,
    packageCount: task.packageCount,
    liquidationStatus: task.liquidationStatus,
    hasPendingLiquidation: task.hasPendingLiquidation,
    customerName: task.customerName,
    customerDocument: task.customerDocument,
    customerPhone: task.customerPhone,
    department: task.department,
    province: task.province,
    district: task.district,
    address: task.address,
    latitude: task.latitude,
    longitude: task.longitude,
    zone: getDisplayZone({
  zone: undefined,
  department: task.department,
  province: task.province,
  district: task.district,
}),
    scheduledDate: task.scheduledDate,
    timeRange: task.timeRange,
    taskType: task.taskType,
    priority: task.priority,
    status: effectiveStatus,
    syncStatus: task.syncStatus,
    isDirty: task.isDirty,
    isLocked: task.isLocked,
    lockReason: task.lockReason,
  };
}

export async function listCachedTasks(
  filter?: TaskListFilter
): Promise<TaskListItem[]> {
  const tasks = await listTasks();
  const activeSession = await getActiveLocalSession();
  const activeAgentId = activeSession?.agentId ?? activeSession?.userId;

  const visibleTasks = tasks.filter((task) => {
      const assignedToAnotherLocalAgent =
        activeAgentId &&
        task.assignedUserId &&
        task.assignedUserId !== activeAgentId &&
        !task.remoteId;

      if (assignedToAnotherLocalAgent) {
        return false;
      }

      if (
        filter?.fieldOperationType &&
        (task.fieldOperationType ?? 'inverse') !== filter.fieldOperationType
      ) {
        return false;
      }

      const scheduledDate = filter?.scheduledDate ?? getTodayLimaDate();

      if (task.scheduledDate !== scheduledDate && !task.hasPendingLiquidation) {
        return false;
      }

      if (!matchesSearch(task, filter?.search)) {
        return false;
      }

      return true;
    });

  const enrichedTasks = await Promise.all(
    visibleTasks.map(async (task) => {
      const managements = await listTaskManagementsByTask(task.id);

      return {
        task,
        effectiveStatus: getEffectiveTaskStatus(task, managements[0] ?? null),
      };
    })
  );

  return enrichedTasks
    .filter(({ effectiveStatus }) =>
      filter?.status ? effectiveStatus === filter.status : true
    )
    .map(({ task, effectiveStatus }) =>
      mapTaskToListItem(task, effectiveStatus)
    );
}

export async function listTodayCachedTasks(): Promise<TaskListItem[]> {
  return listCachedTasks({
    scheduledDate: getTodayLimaDate(),
  });
}

export async function listPendingCachedTasks(): Promise<TaskListItem[]> {
  return listCachedTasks({
    status: 'pending',
  });
}

export async function listInProgressCachedTasks(): Promise<TaskListItem[]> {
  return listCachedTasks({
    status: 'in_progress',
  });
}

export async function searchCachedTasks(search: string): Promise<TaskListItem[]> {
  return listCachedTasks({
    search,
  });
}

export async function getTaskDetailSnapshot(
  taskId: string
): Promise<TaskDetailSnapshot> {
  const task = await getTaskById(taskId);
const series = await listTaskSeries(taskId);
const recoveredDevices = await listRecoveredDevicesByTask(taskId);
const evidences = await listEvidencesByTask(taskId);
const managements = await listTaskManagementsByTask(taskId);
const effectiveTask = task
  ? {
      ...task,
      status: getEffectiveTaskStatus(task, managements[0] ?? null),
    }
  : null;

const managementHistory = await Promise.all(
  managements.map(async (management) => {
    const recoveredDevices = await listRecoveredDevicesByManagement(
      management.id
    );

    const recoveredDeviceSnapshots = await Promise.all(
      recoveredDevices.map(async (device) => ({
        device,
        labelEvidence: device.seriesLabelEvidenceId
          ? await getEvidenceById(device.seriesLabelEvidenceId)
          : null,
      }))
    );

    return {
      management,
      generalEvidence: management.generalEvidenceId
        ? await getEvidenceById(management.generalEvidenceId)
        : null,
      recoveredDevices: recoveredDeviceSnapshots,
    };
  })
);

const events = await listTaskEvents(taskId);
const seriesCounters = await countSeriesByTask(taskId);
const recoveredDeviceCounters = await countRecoveredDevicesByTask(taskId);
const managementCounters = await countTaskManagementsByTask(taskId);
const gpsCounters = await countGpsPointsByTask(taskId);
const evidenceCounters = await countEvidencesByTask(taskId);

  return {
    task: effectiveTask,
    series,
    recoveredDevices,
    evidences,
    managementHistory,
    events,
    seriesCounters,
    recoveredDeviceCounters,
    managementCounters,
    gpsCounters,
    evidenceCounters,
  };
}

export async function getAgentTaskSummary(filter?: {
  fieldOperationType?: Task['fieldOperationType'];
}): Promise<AgentTaskSummary> {
  const tasks = await listTasks();
  const activeSession = await getActiveLocalSession();
  const activeAgentId = activeSession?.agentId ?? activeSession?.userId;
  const todayLima = getTodayLimaDate();

  const visibleTasks = tasks.filter((task) => {
    const assignedToAnotherLocalAgent =
      activeAgentId &&
      task.assignedUserId &&
      task.assignedUserId !== activeAgentId &&
      !task.remoteId;

    if (assignedToAnotherLocalAgent) {
      return false;
    }

    if (task.scheduledDate !== todayLima && !task.hasPendingLiquidation) {
      return false;
    }

    if (
      filter?.fieldOperationType &&
      (task.fieldOperationType ?? 'inverse') !== filter.fieldOperationType
    ) {
      return false;
    }

    return true;
  });

  const pendingLiquidationTasks = visibleTasks.filter(
    (task) => task.hasPendingLiquidation
  ).length;

  const latestManagements = await Promise.all(
    visibleTasks.map(async (task) => {
      const managements = await listTaskManagementsByTask(task.id);
      return managements[0] ?? null;
    })
  );

  const effectiveStatuses = visibleTasks.map((task, index) =>
    getEffectiveTaskStatus(task, latestManagements[index])
  );

  const byStatus = {
    pending: effectiveStatuses.filter((status) => status === 'pending').length,
    inProgress: effectiveStatuses.filter((status) => status === 'in_progress')
      .length,
    completed: effectiveStatuses.filter((status) => status === 'completed')
      .length,
    unsuccessful: effectiveStatuses.filter((status) => status === 'unsuccessful')
      .length,
    rescheduled: effectiveStatuses.filter((status) => status === 'rescheduled')
      .length,
    cancelled: effectiveStatuses.filter((status) => status === 'cancelled')
      .length,
  };

  const partialTasks = latestManagements.filter((management) =>
    [
      management?.reason,
      management?.observation,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes('parcial')
  ).length;

  const effectiveTasks = byStatus.completed;
  const effectivenessGeneral =
    visibleTasks.length > 0
      ? Math.round((effectiveTasks / visibleTasks.length) * 100)
      : 0;

  const pendingQueueItems = await countPendingSyncItems();
  const unsyncedLocalManagements = latestManagements.filter(
    (management) =>
      management &&
      (!management.remoteId || management.syncStatus !== 'synced')
  ).length;
  const pendingSyncItems = pendingQueueItems + unsyncedLocalManagements;

  return {
    totalTasks: visibleTasks.length,
    byStatus,
    partialTasks,
    pendingLiquidationTasks,
    effectivenessGeneral,
    pendingSyncItems,
    dirtyTasks: visibleTasks.filter((task) => task.isDirty).length,
    conflictedTasks: visibleTasks.filter((task) => task.syncStatus === 'conflict')
      .length,
    lockedTasks: visibleTasks.filter((task) => task.isLocked).length,
  };
}

function getEffectiveTaskStatus(
  task: Task,
  latestManagement?: Awaited<ReturnType<typeof listTaskManagementsByTask>>[number] | null
): Task['status'] {
  if (!latestManagement) {
    return task.status;
  }

  if (latestManagement.resultStatus === 'successful') {
    return 'completed';
  }

  if (latestManagement.resultStatus === 'unsuccessful') {
    return 'unsuccessful';
  }

  if (latestManagement.resultStatus === 'rescheduled') {
    return 'rescheduled';
  }

  return task.status;
}

export async function getAgentOperationAvailability(): Promise<AgentOperationAvailability> {
  const tasks = await listTasks();
  const activeSession = await getActiveLocalSession();
  const activeAgentId = activeSession?.agentId ?? activeSession?.userId;
  const todayLima = getTodayLimaDate();

  const visibleTasks = tasks.filter((task) => {
    const hasRemoteAuthenticatedTask = Boolean(task.remoteId);
    const assignedToAnotherLocalAgent =
      activeAgentId &&
      task.assignedUserId &&
      task.assignedUserId !== activeAgentId &&
      !hasRemoteAuthenticatedTask;

    if (assignedToAnotherLocalAgent) {
      return false;
    }

    if (task.scheduledDate !== todayLima && !task.hasPendingLiquidation) {
      return false;
    }

    return true;
  });

  return {
    inverse: visibleTasks.filter(
      (task) => (task.fieldOperationType ?? 'inverse') === 'inverse'
    ).length,
    lastMile: visibleTasks.filter(
      (task) => task.fieldOperationType === 'last_mile'
    ).length,
  };
}
