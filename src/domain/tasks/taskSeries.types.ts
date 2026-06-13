// src/domain/tasks/taskSeries.types.ts

import type { SyncStatus } from './task.types';

export type RecoveryStatus =
  | 'pending'
  | 'recovered'
  | 'not_recovered'
  | 'damaged'
  | 'not_found'
  | 'extra';

export type EquipmentCondition =
  | 'good'
  | 'damaged'
  | 'incomplete'
  | 'unknown';

export type TaskSeries = {
  id: string;
  taskId: string;
  remoteId?: string;

  serialNumber: string;
  equipmentType?: string;
  brand?: string;
  model?: string;

  expected: boolean;
  recovered: boolean;
  recoveryStatus: RecoveryStatus;

  condition?: EquipmentCondition;
  observation?: string;

  version: number;
  syncStatus: SyncStatus;
  isDirty: boolean;

  createdAt: string;
  updatedAt: string;
  localUpdatedAt: string;
  remoteUpdatedAt?: string;
};