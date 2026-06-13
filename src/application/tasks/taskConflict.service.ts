// src/application/tasks/taskConflict.service.ts

import type { SyncQueueItem } from '@/domain/sync/sync.types';
import type { TaskEvent } from '@/domain/tasks/taskEvent.types';

import { enqueueSyncItem } from '@/infrastructure/db/repositories/syncQueueRepository';
import { insertTaskEvent } from '@/infrastructure/db/repositories/taskEventRepository';
import {
    getTaskById,
    markTaskAsConflict,
    updateTaskStatus,
} from '@/infrastructure/db/repositories/taskRepository';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

export type TaskConflictReason =
  | 'REMOTE_DOWNLOAD_SKIPPED_LOCAL_DIRTY'
  | 'REMOTE_DOWNLOAD_SKIPPED_PENDING_SYNC'
  | 'REMOTE_DOWNLOAD_SKIPPED_SYNC_FAILED'
  | 'REMOTE_DOWNLOAD_SKIPPED_CONFLICT'
  | 'REMOTE_DOWNLOAD_SKIPPED_LOCKED';

export type RegisterTaskConflictParams = {
  taskId: string;
  remoteId?: string;
  reason: TaskConflictReason;
  detail: string;
  remoteVersion?: number;
  remoteUpdatedAt?: string;
};

export async function registerTaskDownloadConflict(
  params: RegisterTaskConflictParams
): Promise<TaskEvent> {
  const now = nowIso();

  await markTaskAsConflict({
    taskId: params.taskId,
    reason: params.detail,
  });

  const event: TaskEvent = {
    id: makeId('event'),
    taskId: params.taskId,
    eventType: 'CONFLICT_DETECTED',
    description: 'Conflicto detectado durante descarga remota.',
    payload: {
      reason: params.reason,
      detail: params.detail,
      remoteId: params.remoteId,
      remoteVersion: params.remoteVersion,
      remoteUpdatedAt: params.remoteUpdatedAt,
    },
    occurredAt: now,
    syncStatus: 'pending_sync',
    createdAt: now,
  };

  await insertTaskEvent(event);

  return event;
}

export async function resolveTaskConflictKeepLocal(taskId: string): Promise<{
  taskId: string;
  event: TaskEvent;
  syncItem: SyncQueueItem;
}> {
  const task = await getTaskById(taskId);

  if (!task) {
    throw new Error(`TASK_NOT_FOUND:${taskId}`);
  }

  if (task.syncStatus !== 'conflict') {
    throw new Error(`TASK_NOT_IN_CONFLICT:${task.syncStatus}`);
  }

  await updateTaskStatus({
    taskId,
    nextStatus: task.status,
    syncStatus: 'pending_sync',
  });

  const now = nowIso();

  const event: TaskEvent = {
    id: makeId('event'),
    taskId,
    eventType: 'CONFLICT_DETECTED',
    description: 'Conflicto resuelto conservando cambios locales.',
    payload: {
      resolution: 'KEEP_LOCAL',
      previousSyncStatus: 'conflict',
      nextSyncStatus: 'pending_sync',
      preservedStatus: task.status,
      previousLockReason: task.lockReason,
    },
    occurredAt: now,
    syncStatus: 'pending_sync',
    createdAt: now,
  };

  await insertTaskEvent(event);

  const syncItem: SyncQueueItem = {
    id: makeId('sync'),
    entityType: 'task',
    entityId: taskId,
    operation: 'UPDATE',
    payload: {
      taskId,
      resolution: 'KEEP_LOCAL',
      status: task.status,
      previousLockReason: task.lockReason,
      eventId: event.id,
    },
    status: 'pending',
    priority: 1,
    attemptCount: 0,
    maxAttempts: 10,
    createdAt: now,
    updatedAt: now,
  };

  await enqueueSyncItem(syncItem);

  return {
    taskId,
    event,
    syncItem,
  };
}