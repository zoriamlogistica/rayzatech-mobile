// src/domain/tasks/taskEvent.types.ts

import type { SyncStatus, TaskStatus } from './task.types';

export type TaskEventType =
  | 'TASK_DOWNLOADED'
  | 'TASK_STARTED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_COMPLETED'
  | 'TASK_UNSUCCESSFUL'
  | 'TASK_RESCHEDULED'
  | 'SERIAL_RECOVERED'
  | 'SERIAL_NOT_RECOVERED'
  | 'EVIDENCE_CAPTURED'
  | 'GPS_CAPTURED'
  | 'OBSERVATION_ADDED'
  | 'SYNC_COMPLETED'
  | 'SYNC_FAILED'
  | 'CONFLICT_DETECTED';

export type TaskEvent = {
  id: string;
  taskId: string;
  remoteId?: string;

  eventType: TaskEventType;

  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;

  description?: string;
  payload?: Record<string, unknown>;

  userId?: string;
  deviceId?: string;

  latitude?: number;
  longitude?: number;
  accuracy?: number;

  occurredAt: string;

  syncStatus: SyncStatus;
  createdAt: string;
};