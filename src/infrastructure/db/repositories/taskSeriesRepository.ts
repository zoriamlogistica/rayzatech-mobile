// src/infrastructure/db/repositories/taskSeriesRepository.ts

import type { SyncStatus } from '@/domain/tasks/task.types';
import type {
    EquipmentCondition,
    RecoveryStatus,
    TaskSeries,
} from '@/domain/tasks/taskSeries.types';
import { getDatabase } from '../database';

type TaskSeriesRow = {
  id: string;
  task_id: string;
  remote_id: string | null;

  serial_number: string;
  equipment_type: string | null;
  brand: string | null;
  model: string | null;

  expected: number;
  recovered: number;
  recovery_status: RecoveryStatus;

  condition: EquipmentCondition | null;
  observation: string | null;

  version: number;
  sync_status: SyncStatus;
  is_dirty: number;

  created_at: string;
  updated_at: string;
  local_updated_at: string;
  remote_updated_at: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function mapRowToTaskSeries(row: TaskSeriesRow): TaskSeries {
  return {
    id: row.id,
    taskId: row.task_id,
    remoteId: row.remote_id ?? undefined,

    serialNumber: row.serial_number,
    equipmentType: row.equipment_type ?? undefined,
    brand: row.brand ?? undefined,
    model: row.model ?? undefined,

    expected: row.expected === 1,
    recovered: row.recovered === 1,
    recoveryStatus: row.recovery_status,

    condition: row.condition ?? undefined,
    observation: row.observation ?? undefined,

    version: row.version,
    syncStatus: row.sync_status,
    isDirty: row.is_dirty === 1,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
    localUpdatedAt: row.local_updated_at,
    remoteUpdatedAt: row.remote_updated_at ?? undefined,
  };
}

export async function upsertTaskSeries(series: TaskSeries): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO task_series (
        id,
        task_id,
        remote_id,
        serial_number,
        equipment_type,
        brand,
        model,
        expected,
        recovered,
        recovery_status,
        condition,
        observation,
        version,
        sync_status,
        is_dirty,
        created_at,
        updated_at,
        local_updated_at,
        remote_updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id,
        remote_id = excluded.remote_id,
        serial_number = excluded.serial_number,
        equipment_type = excluded.equipment_type,
        brand = excluded.brand,
        model = excluded.model,
        expected = excluded.expected,
        recovered = excluded.recovered,
        recovery_status = excluded.recovery_status,
        condition = excluded.condition,
        observation = excluded.observation,
        version = excluded.version,
        sync_status = excluded.sync_status,
        is_dirty = excluded.is_dirty,
        updated_at = excluded.updated_at,
        local_updated_at = excluded.local_updated_at,
        remote_updated_at = excluded.remote_updated_at;
    `,
    [
      series.id,
      series.taskId,
      series.remoteId ?? null,
      series.serialNumber,
      series.equipmentType ?? null,
      series.brand ?? null,
      series.model ?? null,
      series.expected ? 1 : 0,
      series.recovered ? 1 : 0,
      series.recoveryStatus,
      series.condition ?? null,
      series.observation ?? null,
      series.version,
      series.syncStatus,
      series.isDirty ? 1 : 0,
      series.createdAt,
      series.updatedAt,
      series.localUpdatedAt,
      series.remoteUpdatedAt ?? null,
    ]
  );
}

export async function getTaskSeriesById(
  id: string
): Promise<TaskSeries | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<TaskSeriesRow>(
    `
      SELECT *
      FROM task_series
      WHERE id = ?
      LIMIT 1;
    `,
    [id]
  );

  return row ? mapRowToTaskSeries(row) : null;
}

export async function listTaskSeries(taskId: string): Promise<TaskSeries[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<TaskSeriesRow>(
    `
      SELECT *
      FROM task_series
      WHERE task_id = ?
      ORDER BY serial_number ASC;
    `,
    [taskId]
  );

  return rows.map(mapRowToTaskSeries);
}

export async function listPendingTaskSeries(): Promise<TaskSeries[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<TaskSeriesRow>(
    `
      SELECT *
      FROM task_series
      WHERE sync_status IN ('pending_sync', 'sync_failed')
      ORDER BY updated_at ASC;
    `
  );

  return rows.map(mapRowToTaskSeries);
}

export async function markSeriesRecovered(params: {
  seriesId: string;
  condition?: EquipmentCondition;
  observation?: string;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE task_series
      SET
        recovered = 1,
        recovery_status = 'recovered',
        condition = COALESCE(?, condition),
        observation = COALESCE(?, observation),
        sync_status = 'pending_sync',
        is_dirty = 1,
        local_updated_at = ?,
        updated_at = ?
      WHERE id = ?;
    `,
    [
      params.condition ?? null,
      params.observation ?? null,
      now,
      now,
      params.seriesId,
    ]
  );
}

export async function markSeriesNotRecovered(params: {
  seriesId: string;
  reason: RecoveryStatus;
  observation?: string;
}): Promise<void> {
  if (params.reason === 'recovered') {
    throw new Error('Use markSeriesRecovered for recovered series.');
  }

  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE task_series
      SET
        recovered = 0,
        recovery_status = ?,
        observation = COALESCE(?, observation),
        sync_status = 'pending_sync',
        is_dirty = 1,
        local_updated_at = ?,
        updated_at = ?
      WHERE id = ?;
    `,
    [params.reason, params.observation ?? null, now, now, params.seriesId]
  );
}

export async function markSeriesAsSynced(params: {
  seriesId: string;
  remoteId?: string;
  remoteUpdatedAt?: string;
  version?: number;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE task_series
      SET
        remote_id = COALESCE(?, remote_id),
        remote_updated_at = COALESCE(?, remote_updated_at),
        version = COALESCE(?, version),
        sync_status = 'synced',
        is_dirty = 0,
        updated_at = ?
      WHERE id = ?;
    `,
    [
      params.remoteId ?? null,
      params.remoteUpdatedAt ?? null,
      params.version ?? null,
      now,
      params.seriesId,
    ]
  );
}

export async function countSeriesByTask(taskId: string): Promise<{
  total: number;
  recovered: number;
  pending: number;
}> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    total: number;
    recovered: number;
    pending: number;
  }>(
    `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN recovered = 1 THEN 1 ELSE 0 END) as recovered,
        SUM(CASE WHEN recovery_status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM task_series
      WHERE task_id = ?;
    `,
    [taskId]
  );

  return {
    total: row?.total ?? 0,
    recovered: row?.recovered ?? 0,
    pending: row?.pending ?? 0,
  };
}