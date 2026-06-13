// src/application/tasks/taskManagement.service.ts

import { appLogger } from '@/application/logging/appLogger.service';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import type {
    CreateRescheduledManagementInput,
    CreateSuccessfulManagementInput,
    CreateUnsuccessfulManagementInput,
    TaskManagement,
    TaskManagementCounters,
} from '@/domain/tasks/taskManagement.types';
import { enqueueSyncItem } from '@/infrastructure/db/repositories/syncQueueRepository';
import {
    countTaskManagementsByTask,
    getNextManagementNumber,
    hasTaskManagementToday,
    listTaskManagementsByTask,
    upsertTaskManagement,
} from '@/infrastructure/db/repositories/taskManagementRepository';
import {
    getTaskById,
    updateTaskStatus,
} from '@/infrastructure/db/repositories/taskRepository';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function normalizeOptionalText(value?: string): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

async function enqueueTaskManagementSync(
  management: TaskManagement
): Promise<SyncQueueItem> {
  const now = nowIso();

  const syncItem: SyncQueueItem = {
    id: makeId('sync'),
    entityType: 'task_management',
    entityId: management.id,
    operation: 'CREATE',
    payload: {
      managementId: management.id,
      taskId: management.taskId,
      managementNumber: management.managementNumber,
      resultStatus: management.resultStatus,
      reason: management.reason,
      observation: management.observation,
      latitude: management.latitude,
      longitude: management.longitude,
      accuracy: management.accuracy,
      mocked: management.mocked,
      generalEvidenceId: management.generalEvidenceId,
      rescheduleDate: management.rescheduleDate,
      rescheduleTimeRange: management.rescheduleTimeRange,
      managedAt: management.managedAt,
      managedBy: management.managedBy,
    },
    status: 'pending',
    priority: 1,
    attemptCount: 0,
    maxAttempts: 10,
    createdAt: now,
    updatedAt: now,
  };

  await enqueueSyncItem(syncItem);

  return syncItem;
}

async function assertTaskExists(taskId: string): Promise<void> {
  const task = await getTaskById(taskId);

  if (!task) {
    throw new Error(`TASK_MANAGEMENT_VALIDATION:TASK_NOT_FOUND:${taskId}`);
  }
}

function assertCoordinatesIfProvided(params: {
  latitude?: number;
  longitude?: number;
}): void {
  const hasLatitude = params.latitude !== undefined;
  const hasLongitude = params.longitude !== undefined;

  if (hasLatitude !== hasLongitude) {
    throw new Error('TASK_MANAGEMENT_VALIDATION:INCOMPLETE_COORDINATES');
  }
}

function assertSuccessfulInput(input: CreateSuccessfulManagementInput): void {
  if (!input.taskId.trim()) {
    throw new Error('TASK_MANAGEMENT_VALIDATION:TASK_REQUIRED');
  }

  assertCoordinatesIfProvided(input);
}

function assertUnsuccessfulInput(input: CreateUnsuccessfulManagementInput): void {
  if (!input.taskId.trim()) {
    throw new Error('TASK_MANAGEMENT_VALIDATION:TASK_REQUIRED');
  }

  if (!input.reason) {
    throw new Error('TASK_MANAGEMENT_VALIDATION:UNSUCCESSFUL_REASON_REQUIRED');
  }

  assertCoordinatesIfProvided(input);
}

function assertRescheduledInput(input: CreateRescheduledManagementInput): void {
  if (!input.taskId.trim()) {
    throw new Error('TASK_MANAGEMENT_VALIDATION:TASK_REQUIRED');
  }

  if (!input.reason) {
    throw new Error('TASK_MANAGEMENT_VALIDATION:RESCHEDULE_REASON_REQUIRED');
  }

  if (!input.rescheduleDate.trim()) {
    throw new Error('TASK_MANAGEMENT_VALIDATION:RESCHEDULE_DATE_REQUIRED');
  }

  if (!input.rescheduleTimeRange.trim()) {
    throw new Error('TASK_MANAGEMENT_VALIDATION:RESCHEDULE_TIME_RANGE_REQUIRED');
  }

  assertCoordinatesIfProvided(input);
}

async function buildBaseManagement(params: {
  taskId: string;
  resultStatus: TaskManagement['resultStatus'];
  reason?: TaskManagement['reason'];
  observation?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  mocked?: boolean;
  generalEvidenceId?: string;
  rescheduleDate?: string;
  rescheduleTimeRange?: string;
  managedBy?: string;
}): Promise<TaskManagement> {
  await assertTaskExists(params.taskId);

  const now = nowIso();
  const nextManagementNumber = await getNextManagementNumber(params.taskId);

  return {
    id: makeId('management'),
    taskId: params.taskId,

    managementNumber: nextManagementNumber,
    resultStatus: params.resultStatus,

    reason: params.reason,
    observation: normalizeOptionalText(params.observation),

    latitude: params.latitude,
    longitude: params.longitude,
    accuracy: params.accuracy,
    mocked: params.mocked ?? false,

    generalEvidenceId: params.generalEvidenceId,

    rescheduleDate: normalizeOptionalText(params.rescheduleDate),
    rescheduleTimeRange: normalizeOptionalText(params.rescheduleTimeRange),

    managedAt: now,
    managedBy: params.managedBy,

    syncStatus: 'pending_sync',
    isDirty: true,

    createdAt: now,
    updatedAt: now,
    localUpdatedAt: now,
  };
}

export async function createSuccessfulManagementOffline(
  input: CreateSuccessfulManagementInput
): Promise<{
  management: TaskManagement;
  counters: TaskManagementCounters;
  syncItem: SyncQueueItem;
  alreadyManagedToday: boolean;
}> {
  assertSuccessfulInput(input);

  const alreadyManagedToday = await hasTaskManagementToday(input.taskId);

  const management = await buildBaseManagement({
    taskId: input.taskId,
    resultStatus: 'successful',
    observation: input.observation,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    mocked: input.mocked,
    generalEvidenceId: input.generalEvidenceId,
    managedBy: input.managedBy,
  });

  await upsertTaskManagement(management);

  await updateTaskStatus({
    taskId: input.taskId,
    nextStatus: 'completed',
    syncStatus: 'pending_sync',
  });

  const syncItem = await enqueueTaskManagementSync(management);
  const counters = await countTaskManagementsByTask(input.taskId);

  await appLogger.info({
    scope: 'TASK_MANAGEMENT',
    message: 'Successful management created offline.',
    taskId: input.taskId,
    payload: {
      managementId: management.id,
      managementNumber: management.managementNumber,
      alreadyManagedToday,
      counters,
    },
  });

  return {
    management,
    counters,
    syncItem,
    alreadyManagedToday,
  };
}

export async function createUnsuccessfulManagementOffline(
  input: CreateUnsuccessfulManagementInput
): Promise<{
  management: TaskManagement;
  counters: TaskManagementCounters;
  syncItem: SyncQueueItem;
  alreadyManagedToday: boolean;
}> {
  assertUnsuccessfulInput(input);

  const alreadyManagedToday = await hasTaskManagementToday(input.taskId);

  const management = await buildBaseManagement({
    taskId: input.taskId,
    resultStatus: 'unsuccessful',
    reason: input.reason,
    observation: input.observation,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    mocked: input.mocked,
    generalEvidenceId: input.generalEvidenceId,
    managedBy: input.managedBy,
  });

  await upsertTaskManagement(management);

  await updateTaskStatus({
    taskId: input.taskId,
    nextStatus: 'unsuccessful',
    syncStatus: 'pending_sync',
  });

  const syncItem = await enqueueTaskManagementSync(management);
  const counters = await countTaskManagementsByTask(input.taskId);

  await appLogger.warn({
    scope: 'TASK_MANAGEMENT',
    message: 'Unsuccessful management created offline.',
    taskId: input.taskId,
    payload: {
      managementId: management.id,
      managementNumber: management.managementNumber,
      reason: input.reason,
      alreadyManagedToday,
      counters,
    },
  });

  return {
    management,
    counters,
    syncItem,
    alreadyManagedToday,
  };
}

export async function createRescheduledManagementOffline(
  input: CreateRescheduledManagementInput
): Promise<{
  management: TaskManagement;
  counters: TaskManagementCounters;
  syncItem: SyncQueueItem;
  alreadyManagedToday: boolean;
}> {
  assertRescheduledInput(input);

  const alreadyManagedToday = await hasTaskManagementToday(input.taskId);

  const management = await buildBaseManagement({
    taskId: input.taskId,
    resultStatus: 'rescheduled',
    reason: input.reason,
    observation: input.observation,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    mocked: input.mocked,
    generalEvidenceId: input.generalEvidenceId,
    rescheduleDate: input.rescheduleDate,
    rescheduleTimeRange: input.rescheduleTimeRange,
    managedBy: input.managedBy,
  });

  await upsertTaskManagement(management);

  await updateTaskStatus({
    taskId: input.taskId,
    nextStatus: 'rescheduled',
    syncStatus: 'pending_sync',
  });

  const syncItem = await enqueueTaskManagementSync(management);
  const counters = await countTaskManagementsByTask(input.taskId);

  await appLogger.warn({
    scope: 'TASK_MANAGEMENT',
    message: 'Rescheduled management created offline.',
    taskId: input.taskId,
    payload: {
      managementId: management.id,
      managementNumber: management.managementNumber,
      reason: input.reason,
      rescheduleDate: input.rescheduleDate,
      rescheduleTimeRange: input.rescheduleTimeRange,
      alreadyManagedToday,
      counters,
    },
  });

  return {
    management,
    counters,
    syncItem,
    alreadyManagedToday,
  };
}

export async function listManagementHistoryForTask(
  taskId: string
): Promise<TaskManagement[]> {
  return listTaskManagementsByTask(taskId);
}

export async function getTaskManagementCountersForTask(
  taskId: string
): Promise<TaskManagementCounters> {
  return countTaskManagementsByTask(taskId);
}

export async function checkTaskAlreadyManagedToday(
  taskId: string
): Promise<boolean> {
  return hasTaskManagementToday(taskId);
}