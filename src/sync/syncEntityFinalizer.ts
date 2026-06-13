// src/sync/syncEntityFinalizer.ts

import type { SyncQueueItem } from '@/domain/sync/sync.types';
import { getDatabase } from '@/infrastructure/db/database';
import { markRecoveredDeviceAsSynced } from '@/infrastructure/db/repositories/recoveredDeviceRepository';
import { markTaskManagementAsSynced } from '@/infrastructure/db/repositories/taskManagementRepository';

export type SyncEntityFinalizationResult = {
  entityType: string;
  entityId: string;
  finalized: boolean;
  message: string;
};

async function finalizeTask(entityId: string): Promise<SyncEntityFinalizationResult> {
  const db = await getDatabase();

  await db.runAsync(
    `
      UPDATE tasks
      SET
        sync_status = 'synced',
        is_dirty = 0,
        is_locked = 0,
        lock_reason = NULL,
        updated_at = ?
      WHERE id = ?;
    `,
    [new Date().toISOString(), entityId]
  );

  return {
    entityType: 'task',
    entityId,
    finalized: true,
    message: 'Task marked as synced and clean.',
  };
}

async function finalizeTaskSeries(entityId: string): Promise<SyncEntityFinalizationResult> {
  const db = await getDatabase();

  await db.runAsync(
    `
      UPDATE task_series
      SET
        sync_status = 'synced',
        is_dirty = 0,
        updated_at = ?
      WHERE id = ?;
    `,
    [new Date().toISOString(), entityId]
  );

  return {
    entityType: 'task_series',
    entityId,
    finalized: true,
    message: 'Task series marked as synced and clean.',
  };
}

async function finalizeTaskManagement(
  entityId: string
): Promise<SyncEntityFinalizationResult> {
  await markTaskManagementAsSynced(entityId);

  return {
    entityType: 'task_management',
    entityId,
    finalized: true,
    message: 'Task management marked as synced and clean.',
  };
}

async function finalizeRecoveredDevice(
  entityId: string
): Promise<SyncEntityFinalizationResult> {
  await markRecoveredDeviceAsSynced(entityId);

  return {
    entityType: 'recovered_device',
    entityId,
    finalized: true,
    message: 'Recovered device marked as synced and clean.',
  };
}

async function finalizeTaskEvent(entityId: string): Promise<SyncEntityFinalizationResult> {
  const db = await getDatabase();

  await db.runAsync(
    `
      UPDATE task_events
      SET
        sync_status = 'synced'
      WHERE id = ?;
    `,
    [entityId]
  );

  return {
    entityType: 'task_event',
    entityId,
    finalized: true,
    message: 'Task event marked as synced.',
  };
}

async function finalizeGpsPoint(entityId: string): Promise<SyncEntityFinalizationResult> {
  const db = await getDatabase();

  await db.runAsync(
    `
      UPDATE gps_points
      SET
        sync_status = 'synced'
      WHERE id = ?;
    `,
    [entityId]
  );

  return {
    entityType: 'gps_point',
    entityId,
    finalized: true,
    message: 'GPS point marked as synced.',
  };
}

async function finalizeEvidence(entityId: string): Promise<SyncEntityFinalizationResult> {
  const db = await getDatabase();

  await db.runAsync(
    `
      UPDATE evidences
      SET
        sync_status = 'synced',
        updated_at = ?
      WHERE id = ?;
    `,
    [new Date().toISOString(), entityId]
  );

  return {
    entityType: 'evidence',
    entityId,
    finalized: true,
    message: 'Evidence marked as synced.',
  };
}

export async function finalizeSyncedEntity(
  item: SyncQueueItem
): Promise<SyncEntityFinalizationResult> {
  if (item.entityType === 'task') {
    return finalizeTask(item.entityId);
  }

  if (item.entityType === 'task_series') {
    return finalizeTaskSeries(item.entityId);
  }

  if (item.entityType === 'recovered_device') {
    return finalizeRecoveredDevice(item.entityId);
  }

  if (item.entityType === 'task_management') {
  return finalizeTaskManagement(item.entityId);
}

  if (item.entityType === 'task_event') {
    return finalizeTaskEvent(item.entityId);
  }

  if (item.entityType === 'gps_point') {
    return finalizeGpsPoint(item.entityId);
  }

  if (item.entityType === 'evidence') {
    return finalizeEvidence(item.entityId);
  }

  return {
    entityType: item.entityType,
    entityId: item.entityId,
    finalized: false,
    message: `No finalizer implemented for entity type: ${item.entityType}`,
  };
}