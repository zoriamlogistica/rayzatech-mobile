// src/domain/sync/sync.types.ts

export type SyncEntityType =
  | 'task'
  | 'task_series'
  | 'task_event'
  | 'task_management'
  | 'recovered_device'
  | 'evidence'
  | 'gps_point'
  | 'local_log'
  | 'catalog';

export type SyncOperation =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'UPLOAD'
  | 'LINK';

export type SyncQueueStatus =
  | 'pending'
  | 'syncing'
  | 'success'
  | 'failed'
  | 'conflict'
  | 'cancelled';

export type SyncQueueItem = {
  id: string;

  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;

  payload: Record<string, unknown>;

  status: SyncQueueStatus;
  priority: number;

  attemptCount: number;
  maxAttempts: number;

  nextAttemptAt?: string;
  lockedAt?: string;
  lockedBy?: string;

  lastError?: string;
  lastErrorCode?: string;

  createdAt: string;
  updatedAt: string;
};

export type SyncAttempt = {
  id: string;

  syncQueueId: string;

  attemptNumber: number;
  status: 'started' | 'success' | 'failed';

  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;

  errorMessage?: string;
  errorCode?: string;

  startedAt: string;
  finishedAt?: string;
};