// src/domain/gps/gps.types.ts

import type { SyncStatus } from '../tasks/task.types';

export type GpsPoint = {
  id: string;

  taskId?: string;
  taskEventId?: string;

  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;

  provider?: string;
  mocked: boolean;

  capturedAt: string;
  syncStatus: SyncStatus;

  createdAt: string;
};