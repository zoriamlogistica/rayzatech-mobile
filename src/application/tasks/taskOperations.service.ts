// src/application/tasks/taskOperations.service.ts

import type { Evidence } from '@/domain/evidence/evidence.types';
import type { GpsPoint } from '@/domain/gps/gps.types';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import type { TaskStatus } from '@/domain/tasks/task.types';
import type { TaskEvent } from '@/domain/tasks/taskEvent.types';
import {
  assertOperationalValidation,
  canCompleteTask,
  canMarkTaskUnsuccessful,
  canRecoverSeries,
  canStartTask,
} from '@/domain/tasks/taskOperationalRules';
import type {
  EquipmentCondition,
  RecoveryStatus,
} from '@/domain/tasks/taskSeries.types';

import {
  countEvidencesByTask,
  insertEvidence,
} from '@/infrastructure/db/repositories/evidenceRepository';
import {
  countGpsPointsByTask,
  insertGpsPoint,
} from '@/infrastructure/db/repositories/gpsRepository';
import { countRecoveredDevicesByTask } from '@/infrastructure/db/repositories/recoveredDeviceRepository';
import { enqueueSyncItem } from '@/infrastructure/db/repositories/syncQueueRepository';
import { insertTaskEvent } from '@/infrastructure/db/repositories/taskEventRepository';
import {
  getTaskById,
  updateTaskStatus,
} from '@/infrastructure/db/repositories/taskRepository';
import {
  markSeriesNotRecovered,
  markSeriesRecovered
} from '@/infrastructure/db/repositories/taskSeriesRepository';
import {
  captureCurrentLocation,
  getLocationQualityLabel,
  shouldRequireLocationRetry,
  shouldWarnAboutLowAccuracy,
} from '@/infrastructure/gps/locationService';
import { createFakeEvidenceFile } from '@/infrastructure/storage/evidenceStorage';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function createTaskEvent(params: {
  taskId: string;
  eventType: TaskEvent['eventType'];
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
  description: string;
  payload?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  occurredAt?: string;
}): Promise<TaskEvent> {
  const now = nowIso();

  const event: TaskEvent = {
    id: makeId('event'),
    taskId: params.taskId,
    eventType: params.eventType,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    description: params.description,
    payload: params.payload,
    latitude: params.latitude,
    longitude: params.longitude,
    accuracy: params.accuracy,
    occurredAt: params.occurredAt ?? now,
    syncStatus: 'pending_sync',
    createdAt: now,
  };

  await insertTaskEvent(event);

  return event;
}

async function enqueueTaskUpdate(params: {
  taskId: string;
  operation?: SyncQueueItem['operation'];
  payload: Record<string, unknown>;
  priority?: number;
}): Promise<SyncQueueItem> {
  const now = nowIso();

  const item: SyncQueueItem = {
    id: makeId('sync'),
    entityType: 'task',
    entityId: params.taskId,
    operation: params.operation ?? 'UPDATE',
    payload: params.payload,
    status: 'pending',
    priority: params.priority ?? 1,
    attemptCount: 0,
    maxAttempts: 10,
    createdAt: now,
    updatedAt: now,
  };

  await enqueueSyncItem(item);

  return item;
}

async function enqueueSeriesUpdate(params: {
  seriesId: string;
  payload: Record<string, unknown>;
}): Promise<SyncQueueItem> {
  const now = nowIso();

  const item: SyncQueueItem = {
    id: makeId('sync'),
    entityType: 'task_series',
    entityId: params.seriesId,
    operation: 'UPDATE',
    payload: params.payload,
    status: 'pending',
    priority: 2,
    attemptCount: 0,
    maxAttempts: 10,
    createdAt: now,
    updatedAt: now,
  };

  await enqueueSyncItem(item);

  return item;
}

async function enqueueEvidenceUpload(params: {
  evidenceId: string;
  taskId: string;
  localUri: string;
  evidenceType: Evidence['evidenceType'];
}): Promise<SyncQueueItem> {
  const now = nowIso();

  const item: SyncQueueItem = {
    id: makeId('sync'),
    entityType: 'evidence',
    entityId: params.evidenceId,
    operation: 'UPLOAD',
    payload: {
      evidenceId: params.evidenceId,
      taskId: params.taskId,
      localUri: params.localUri,
      evidenceType: params.evidenceType,
    },
    status: 'pending',
    priority: 3,
    attemptCount: 0,
    maxAttempts: 10,
    createdAt: now,
    updatedAt: now,
  };

  await enqueueSyncItem(item);

  return item;
}

async function captureAndStoreGpsForTask(params: {
  taskId: string;
  taskEventId?: string;
}): Promise<GpsPoint> {
  const capturedLocation = await captureCurrentLocation();
  const now = nowIso();

  const gpsPoint: GpsPoint = {
    id: makeId('gps'),
    taskId: params.taskId,
    taskEventId: params.taskEventId,
    latitude: capturedLocation.latitude,
    longitude: capturedLocation.longitude,
    accuracy: capturedLocation.accuracy,
    altitude: capturedLocation.altitude,
    speed: capturedLocation.speed,
    heading: capturedLocation.heading,
    provider: capturedLocation.provider,
    mocked: capturedLocation.mocked,
    capturedAt: capturedLocation.capturedAt,
    syncStatus: 'pending_sync',
    createdAt: now,
  };

  await insertGpsPoint(gpsPoint);

  const syncItem: SyncQueueItem = {
    id: makeId('sync'),
    entityType: 'gps_point',
    entityId: gpsPoint.id,
    operation: 'CREATE',
    payload: {
      gpsPointId: gpsPoint.id,
      taskId: params.taskId,
      taskEventId: params.taskEventId,
      latitude: gpsPoint.latitude,
      longitude: gpsPoint.longitude,
      accuracy: gpsPoint.accuracy,
      mocked: gpsPoint.mocked,
    },
    status: 'pending',
    priority: 4,
    attemptCount: 0,
    maxAttempts: 10,
    createdAt: now,
    updatedAt: now,
  };

  await enqueueSyncItem(syncItem);

  return gpsPoint;
}

export async function startTaskOffline(taskId: string): Promise<{
  taskId: string;
  event: TaskEvent;
  gpsPoint: GpsPoint;
}> {
  const task = await getTaskById(taskId);

  assertOperationalValidation(canStartTask(task));

  await updateTaskStatus({
    taskId,
    nextStatus: 'in_progress',
    syncStatus: 'pending_sync',
  });

  const gpsPoint = await captureAndStoreGpsForTask({
    taskId,
  });

  const event = await createTaskEvent({
    taskId,
    eventType: 'TASK_STARTED',
    fromStatus: 'pending',
    toStatus: 'in_progress',
    description: 'Tarea iniciada offline por el agente.',
    latitude: gpsPoint.latitude,
    longitude: gpsPoint.longitude,
    accuracy: gpsPoint.accuracy,
    occurredAt: gpsPoint.capturedAt,
    payload: {
      offlineAction: true,
      gpsPointId: gpsPoint.id,
      gpsQuality: getLocationQualityLabel(gpsPoint.accuracy),
      warnLowAccuracy: shouldWarnAboutLowAccuracy(gpsPoint.accuracy),
      requireRetry: shouldRequireLocationRetry(gpsPoint.accuracy),
    },
  });

  await enqueueTaskUpdate({
    taskId,
    payload: {
      taskId,
      status: 'in_progress',
      eventId: event.id,
      gpsPointId: gpsPoint.id,
    },
  });

  return {
    taskId,
    event,
    gpsPoint,
  };
}

export async function completeTaskOffline(taskId: string): Promise<{
  taskId: string;
  event: TaskEvent;
  gpsPoint: GpsPoint;
  warnings: string[];
}> {
    const task = await getTaskById(taskId);
  const recoveredDeviceCounters = await countRecoveredDevicesByTask(taskId);
  const gpsCounters = await countGpsPointsByTask(taskId);
  const evidenceCounters = await countEvidencesByTask(taskId);

  const validation = canCompleteTask({
    task,
    recoveredDeviceCounters,
    gpsCounters,
    evidenceCounters,
  });

  assertOperationalValidation(validation);

  await updateTaskStatus({
    taskId,
    nextStatus: 'completed',
    syncStatus: 'pending_sync',
  });

  const gpsPoint = await captureAndStoreGpsForTask({
    taskId,
  });

  const event = await createTaskEvent({
    taskId,
    eventType: 'TASK_COMPLETED',
    fromStatus: 'in_progress',
    toStatus: 'completed',
    description: 'Tarea completada offline por el agente.',
    latitude: gpsPoint.latitude,
    longitude: gpsPoint.longitude,
    accuracy: gpsPoint.accuracy,
    occurredAt: gpsPoint.capturedAt,
    payload: {
      offlineAction: true,
      gpsPointId: gpsPoint.id,
      gpsQuality: getLocationQualityLabel(gpsPoint.accuracy),
      warnLowAccuracy: shouldWarnAboutLowAccuracy(gpsPoint.accuracy),
      requireRetry: shouldRequireLocationRetry(gpsPoint.accuracy),
      operationalWarnings: validation.warnings,
    },
  });

  await enqueueTaskUpdate({
    taskId,
    payload: {
      taskId,
      status: 'completed',
      eventId: event.id,
      gpsPointId: gpsPoint.id,
      warnings: validation.warnings,
    },
  });

  return {
    taskId,
    event,
    gpsPoint,
    warnings: validation.warnings,
  };
}

export async function markTaskUnsuccessfulOffline(params: {
  taskId: string;
  reason: string;
  observation?: string;
}): Promise<{
  taskId: string;
  event: TaskEvent;
  gpsPoint: GpsPoint;
}> {
  const task = await getTaskById(params.taskId);

  assertOperationalValidation(canMarkTaskUnsuccessful(task));

  const fromStatus = task?.status ?? 'pending';

  await updateTaskStatus({
    taskId: params.taskId,
    nextStatus: 'unsuccessful',
    syncStatus: 'pending_sync',
  });

  const gpsPoint = await captureAndStoreGpsForTask({
    taskId: params.taskId,
  });

  const event = await createTaskEvent({
    taskId: params.taskId,
    eventType: 'TASK_UNSUCCESSFUL',
    fromStatus,
    toStatus: 'unsuccessful',
    description: 'Tarea marcada como no exitosa offline por el agente.',
    latitude: gpsPoint.latitude,
    longitude: gpsPoint.longitude,
    accuracy: gpsPoint.accuracy,
    occurredAt: gpsPoint.capturedAt,
    payload: {
      offlineAction: true,
      reason: params.reason,
      observation: params.observation,
      gpsPointId: gpsPoint.id,
      gpsQuality: getLocationQualityLabel(gpsPoint.accuracy),
      warnLowAccuracy: shouldWarnAboutLowAccuracy(gpsPoint.accuracy),
      requireRetry: shouldRequireLocationRetry(gpsPoint.accuracy),
    },
  });

  await enqueueTaskUpdate({
    taskId: params.taskId,
    payload: {
      taskId: params.taskId,
      status: 'unsuccessful',
      reason: params.reason,
      observation: params.observation,
      eventId: event.id,
      gpsPointId: gpsPoint.id,
    },
  });

  return {
    taskId: params.taskId,
    event,
    gpsPoint,
  };
}

export async function recoverSeriesOffline(params: {
  taskId: string;
  seriesId: string;
  serialNumber: string;
  condition?: EquipmentCondition;
  observation?: string;
}): Promise<{
  taskId: string;
  seriesId: string;
  event: TaskEvent;
}> {
  const task = await getTaskById(params.taskId);

  assertOperationalValidation(
    canRecoverSeries({
      task,
      seriesId: params.seriesId,
    })
  );

  await markSeriesRecovered({
    seriesId: params.seriesId,
    condition: params.condition,
    observation: params.observation,
  });

  const event = await createTaskEvent({
    taskId: params.taskId,
    eventType: 'SERIAL_RECOVERED',
    description: `Serie ${params.serialNumber} recuperada offline.`,
    payload: {
      seriesId: params.seriesId,
      serialNumber: params.serialNumber,
      condition: params.condition,
      observation: params.observation,
    },
  });

  await enqueueSeriesUpdate({
    seriesId: params.seriesId,
    payload: {
      taskId: params.taskId,
      seriesId: params.seriesId,
      serialNumber: params.serialNumber,
      recoveryStatus: 'recovered',
      condition: params.condition,
      observation: params.observation,
      eventId: event.id,
    },
  });

  return {
    taskId: params.taskId,
    seriesId: params.seriesId,
    event,
  };
}

export async function markSeriesNotRecoveredOffline(params: {
  taskId: string;
  seriesId: string;
  serialNumber: string;
  reason: Exclude<RecoveryStatus, 'recovered'>;
  observation?: string;
}): Promise<{
  taskId: string;
  seriesId: string;
  event: TaskEvent;
}> {
  const task = await getTaskById(params.taskId);

  assertOperationalValidation(
    canRecoverSeries({
      task,
      seriesId: params.seriesId,
    })
  );

  await markSeriesNotRecovered({
    seriesId: params.seriesId,
    reason: params.reason,
    observation: params.observation,
  });

  const event = await createTaskEvent({
    taskId: params.taskId,
    eventType: 'SERIAL_NOT_RECOVERED',
    description: `Serie ${params.serialNumber} no recuperada offline.`,
    payload: {
      seriesId: params.seriesId,
      serialNumber: params.serialNumber,
      reason: params.reason,
      observation: params.observation,
    },
  });

  await enqueueSeriesUpdate({
    seriesId: params.seriesId,
    payload: {
      taskId: params.taskId,
      seriesId: params.seriesId,
      serialNumber: params.serialNumber,
      recoveryStatus: params.reason,
      observation: params.observation,
      eventId: event.id,
    },
  });

  return {
    taskId: params.taskId,
    seriesId: params.seriesId,
    event,
  };
}

export async function captureGpsForTaskOffline(taskId: string): Promise<{
  taskId: string;
  event: TaskEvent;
  gpsPoint: GpsPoint;
}> {
  const gpsPoint = await captureAndStoreGpsForTask({
    taskId,
  });

  const event = await createTaskEvent({
    taskId,
    eventType: 'GPS_CAPTURED',
    description: 'GPS capturado offline para tarea.',
    latitude: gpsPoint.latitude,
    longitude: gpsPoint.longitude,
    accuracy: gpsPoint.accuracy,
    occurredAt: gpsPoint.capturedAt,
    payload: {
      gpsPointId: gpsPoint.id,
      gpsQuality: getLocationQualityLabel(gpsPoint.accuracy),
      warnLowAccuracy: shouldWarnAboutLowAccuracy(gpsPoint.accuracy),
      requireRetry: shouldRequireLocationRetry(gpsPoint.accuracy),
    },
  });

  return {
    taskId,
    event,
    gpsPoint,
  };
}

export async function captureFakeEvidenceForTaskOffline(params: {
  taskId: string;
  evidenceType?: Evidence['evidenceType'];
}): Promise<{
  taskId: string;
  evidence: Evidence;
  event: TaskEvent;
}> {
  const now = nowIso();
  const evidenceId = makeId('evidence');
  const evidenceType = params.evidenceType ?? 'recovery_proof';

  const fakeFile = await createFakeEvidenceFile({
    taskId: params.taskId,
    evidenceId,
  });

  const gpsPoint = await captureAndStoreGpsForTask({
    taskId: params.taskId,
  });

  const evidence: Evidence = {
    id: evidenceId,
    taskId: params.taskId,
    evidenceType,
    localUri: fakeFile.localUri,
    fileName: fakeFile.fileName,
    mimeType: fakeFile.mimeType,
    sizeBytes: fakeFile.sizeBytes,
    latitude: gpsPoint.latitude,
    longitude: gpsPoint.longitude,
    accuracy: gpsPoint.accuracy,
    capturedAt: now,
    uploadStatus: 'local_only',
    syncStatus: 'pending_sync',
    createdAt: now,
    updatedAt: now,
  };

  await insertEvidence(evidence);

  const event = await createTaskEvent({
    taskId: params.taskId,
    eventType: 'EVIDENCE_CAPTURED',
    description: 'Evidencia capturada offline para tarea.',
    latitude: gpsPoint.latitude,
    longitude: gpsPoint.longitude,
    accuracy: gpsPoint.accuracy,
    occurredAt: now,
    payload: {
      evidenceId,
      evidenceType,
      localUri: fakeFile.localUri,
      fileName: fakeFile.fileName,
      sizeBytes: fakeFile.sizeBytes,
      gpsPointId: gpsPoint.id,
    },
  });

  await enqueueEvidenceUpload({
    evidenceId,
    taskId: params.taskId,
    localUri: fakeFile.localUri,
    evidenceType,
  });

  return {
    taskId: params.taskId,
    evidence,
    event,
  };
}