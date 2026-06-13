// src/application/tasks/taskDownload.service.ts

import type { Task } from '@/domain/tasks/task.types';
import type { TaskEvent } from '@/domain/tasks/taskEvent.types';
import type { TaskSeries } from '@/domain/tasks/taskSeries.types';

import { insertTaskEvent } from '@/infrastructure/db/repositories/taskEventRepository';
import {
  getTaskById,
  markMissingRemoteTasksAsLocallyDeletedForDate,
  updateTaskRemoteMasterData,
  upsertTask,
} from '@/infrastructure/db/repositories/taskRepository';
import { upsertTaskSeries } from '@/infrastructure/db/repositories/taskSeriesRepository';
import { fetchMobileRemoteTasks } from '@/infrastructure/remote/mobileTaskSource';
import type {
  RemoteTaskDto,
  RemoteTaskSeriesDto,
} from '@/infrastructure/remote/remoteTask.types';
import {
  registerTaskDownloadConflict,
  type TaskConflictReason,
} from './taskConflict.service';
import {
  decideTaskDownloadAction,
  type TaskDownloadDecision,
} from './taskDownloadConflictPolicy';

function nowIso(): string {
  return new Date().toISOString();
}

function getTodayLimaDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function localTaskId(remoteId: string): string {
  return `task_${remoteId}`;
}

function localSeriesId(remoteId: string): string {
  return `series_${remoteId}`;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function mapRemoteTaskToLocalTask(remoteTask: RemoteTaskDto): Task {
  const now = nowIso();

  return {
    id: localTaskId(remoteTask.remoteId),
    remoteId: remoteTask.remoteId,

    taskNumber: remoteTask.taskNumber,
    orderCode: remoteTask.orderCode,
    project: remoteTask.project,
    sot: remoteTask.sot,

    assignedUserId: remoteTask.assignedUserId,

    customerName: remoteTask.customerName,
    customerDocument: remoteTask.customerDocument,
    customerPhone: remoteTask.customerPhone,
    customerEmail: remoteTask.customerEmail,

    department: remoteTask.department,
    province: remoteTask.province,
    district: remoteTask.district,
    address: remoteTask.address,
    reference: remoteTask.reference,

    latitude: remoteTask.latitude,
    longitude: remoteTask.longitude,

    scheduledDate: remoteTask.scheduledDate,
    scheduledStart: remoteTask.scheduledStart,
    scheduledEnd: remoteTask.scheduledEnd,
    timeRange: remoteTask.timeRange,

    taskType: remoteTask.taskType,
    priority: remoteTask.priority ?? 'normal',

    status: remoteTask.status ?? 'pending',

    observations: remoteTask.observations,
    operatorNotes: remoteTask.operatorNotes,
    internalNotes: remoteTask.internalNotes,

    version: remoteTask.version,
    remoteUpdatedAt: remoteTask.remoteUpdatedAt,
    localUpdatedAt: now,

    syncStatus: 'synced',
    isDirty: false,
    isLocked: false,

    createdAt: now,
    updatedAt: now,
  };
}

function mapRemoteSeriesToLocalSeries(params: {
  taskId: string;
  remoteSeries: RemoteTaskSeriesDto;
}): TaskSeries {
  const now = nowIso();

  return {
    id: localSeriesId(params.remoteSeries.remoteId),
    taskId: params.taskId,
    remoteId: params.remoteSeries.remoteId,

    serialNumber: params.remoteSeries.serialNumber,
    equipmentType: params.remoteSeries.equipmentType,
    brand: params.remoteSeries.brand,
    model: params.remoteSeries.model,

    expected: true,
    recovered: false,
    recoveryStatus: 'pending',

    version: 1,
    syncStatus: 'synced',
    isDirty: false,

    createdAt: now,
    updatedAt: now,
    localUpdatedAt: now,
    remoteUpdatedAt: now,
  };
}

function mapDownloadSkipReasonToConflictReason(
  reason: TaskDownloadDecision['reason']
): TaskConflictReason {
  switch (reason) {
    case 'LOCAL_TASK_DIRTY':
      return 'REMOTE_DOWNLOAD_SKIPPED_LOCAL_DIRTY';

    case 'LOCAL_TASK_PENDING_SYNC':
      return 'REMOTE_DOWNLOAD_SKIPPED_PENDING_SYNC';

    case 'LOCAL_TASK_SYNC_FAILED':
      return 'REMOTE_DOWNLOAD_SKIPPED_SYNC_FAILED';

    case 'LOCAL_TASK_CONFLICT':
      return 'REMOTE_DOWNLOAD_SKIPPED_CONFLICT';

    case 'LOCAL_TASK_LOCKED':
      return 'REMOTE_DOWNLOAD_SKIPPED_LOCKED';

    case 'LOCAL_TASK_NOT_FOUND':
    case 'LOCAL_TASK_CLEAN':
    default:
      return 'REMOTE_DOWNLOAD_SKIPPED_LOCAL_DIRTY';
  }
}

async function insertDownloadedTaskEvent(params: {
  taskId: string;
  action: 'insert' | 'update';
  reason: string;
}): Promise<void> {
  const now = nowIso();

  const event: TaskEvent = {
    id: makeId('event'),
    taskId: params.taskId,
    eventType: 'TASK_DOWNLOADED',
    description: 'Tarea descargada y guardada localmente.',
    payload: {
      source: 'mobileTaskSource',
      downloadAction: params.action,
      reason: params.reason,
    },
    occurredAt: now,
    syncStatus: 'synced',
    createdAt: now,
  };

  await insertTaskEvent(event);
}

export type TaskDownloadItemResult = {
  taskId: string;
  remoteId: string;
  action: TaskDownloadDecision['action'];
  reason: TaskDownloadDecision['reason'];
};

export type TaskDownloadResult = {
  downloadedAt: string;
  remoteTasksReceived: number;
  inserted: number;
  updated: number;
  skippedDirty: number;
  conflictsRegistered: number;
  seriesDownloaded: number;
  taskIds: string[];
  details: TaskDownloadItemResult[];
};

export async function downloadDevTasksToLocalCache(): Promise<TaskDownloadResult> {
  const response = await fetchMobileRemoteTasks();

  const todayLima = getTodayLimaDate();

const remoteIdsReceived = response.tasks
  .map((task) => task.remoteId)
  .filter(Boolean);

  let inserted = 0;
  let updated = 0;
  let skippedDirty = 0;
  let conflictsRegistered = 0;
  let seriesDownloaded = 0;

  const taskIds: string[] = [];
  const details: TaskDownloadItemResult[] = [];

  for (const remoteTask of response.tasks) {
    const taskId = localTaskId(remoteTask.remoteId);
const localTask = await getTaskById(taskId);
const decision = decideTaskDownloadAction(localTask);

const isRemoteReopenedForNewVisit =
  localTask !== null &&
  remoteTask.status === 'pending' &&
  [
    'completed',
    'unsuccessful',
    'rescheduled',
    'cancelled',
  ].includes(localTask.status);

const effectiveAction = isRemoteReopenedForNewVisit
  ? 'update'
  : decision.action;

details.push({
  taskId,
  remoteId: remoteTask.remoteId,
  action: effectiveAction,
  reason: decision.reason,
});

taskIds.push(taskId);

if (decision.action === 'skip_dirty' && !isRemoteReopenedForNewVisit) {
  skippedDirty += 1;

  const task = mapRemoteTaskToLocalTask(remoteTask);

  await updateTaskRemoteMasterData(task);

  await registerTaskDownloadConflict({
    taskId,
    remoteId: remoteTask.remoteId,
    reason: mapDownloadSkipReasonToConflictReason(decision.reason),
    detail: `Download skipped because local task is protected: ${decision.reason}. Safe remote master data was updated locally.`,
    remoteVersion: remoteTask.version,
    remoteUpdatedAt: remoteTask.remoteUpdatedAt,
  });

  conflictsRegistered += 1;

  continue;
}

    const task = mapRemoteTaskToLocalTask(remoteTask);

    await upsertTask(task);

    if (effectiveAction === 'skip_dirty') {
  continue;
}

await insertDownloadedTaskEvent({
  taskId: task.id,
  action: effectiveAction,
  reason: isRemoteReopenedForNewVisit
    ? 'REMOTE_REOPENED_FOR_NEW_VISIT'
    : decision.reason,
});

    if (effectiveAction === 'insert') {
  inserted += 1;
}

if (effectiveAction === 'update') {
  updated += 1;
}

    for (const remoteSeries of remoteTask.series) {
      const series = mapRemoteSeriesToLocalSeries({
        taskId: task.id,
        remoteSeries,
      });

      await upsertTaskSeries(series);
      seriesDownloaded += 1;
    }
  }

  await markMissingRemoteTasksAsLocallyDeletedForDate({
  scheduledDate: todayLima,
  remoteIds: remoteIdsReceived,
});
  
  return {
    downloadedAt: response.downloadedAt,
    remoteTasksReceived: response.tasks.length,
    inserted,
    updated,
    skippedDirty,
    conflictsRegistered,
    seriesDownloaded,
    taskIds,
    details,
  };
}