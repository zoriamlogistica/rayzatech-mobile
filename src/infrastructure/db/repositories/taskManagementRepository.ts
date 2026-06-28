// src/infrastructure/db/repositories/taskManagementRepository.ts

import type {
  TaskManagement,
  TaskManagementCounters,
  TaskManagementStatus,
} from '@/domain/tasks/taskManagement.types';

import { getLimaDateKey } from '@/shared/time/limaTime';
import { getDatabase } from '../database';

type TaskManagementRow = {
  id: string;
  task_id: string;
  remote_id: string | null;

  management_number: number;
  result_status: TaskManagementStatus;

  reason: string | null;
  observation: string | null;

  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  mocked: number | null;

  general_evidence_id: string | null;

  reschedule_date: string | null;
  reschedule_time_range: string | null;

  managed_at: string;
  managed_by: string | null;

  sync_status: TaskManagement['syncStatus'];
  is_dirty: number;

  created_at: string;
  updated_at: string;
  local_updated_at: string;
  remote_updated_at: string | null;
};

function mapRowToTaskManagement(row: TaskManagementRow): TaskManagement {
  return {
    id: row.id,
    taskId: row.task_id,
    remoteId: row.remote_id ?? undefined,

    managementNumber: row.management_number,
    resultStatus: row.result_status,

    reason: row.reason as TaskManagement['reason'],
    observation: row.observation ?? undefined,

    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    accuracy: row.accuracy ?? undefined,
    mocked: row.mocked === 1,

    generalEvidenceId: row.general_evidence_id ?? undefined,

    rescheduleDate: row.reschedule_date ?? undefined,
    rescheduleTimeRange: row.reschedule_time_range ?? undefined,

    managedAt: row.managed_at,
    managedBy: row.managed_by ?? undefined,

    syncStatus: row.sync_status,
    isDirty: row.is_dirty === 1,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
    localUpdatedAt: row.local_updated_at,
    remoteUpdatedAt: row.remote_updated_at ?? undefined,
  };
}

function todayPrefix(): string {
  return getLimaDateKey();
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function upsertTaskManagement(
  management: TaskManagement
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO task_managements (
        id,
        task_id,
        remote_id,
        management_number,
        result_status,
        reason,
        observation,
        latitude,
        longitude,
        accuracy,
        mocked,
        general_evidence_id,
        reschedule_date,
        reschedule_time_range,
        managed_at,
        managed_by,
        sync_status,
        is_dirty,
        created_at,
        updated_at,
        local_updated_at,
        remote_updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id,
        remote_id = excluded.remote_id,
        management_number = excluded.management_number,
        result_status = excluded.result_status,
        reason = excluded.reason,
        observation = excluded.observation,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        accuracy = excluded.accuracy,
        mocked = excluded.mocked,
        general_evidence_id = excluded.general_evidence_id,
        reschedule_date = excluded.reschedule_date,
        reschedule_time_range = excluded.reschedule_time_range,
        managed_at = excluded.managed_at,
        managed_by = excluded.managed_by,
        sync_status = excluded.sync_status,
        is_dirty = excluded.is_dirty,
        updated_at = excluded.updated_at,
        local_updated_at = excluded.local_updated_at,
        remote_updated_at = excluded.remote_updated_at;
    `,
    [
      management.id,
      management.taskId,
      management.remoteId ?? null,
      management.managementNumber,
      management.resultStatus,
      management.reason ?? null,
      management.observation ?? null,
      management.latitude ?? null,
      management.longitude ?? null,
      management.accuracy ?? null,
      management.mocked ? 1 : 0,
      management.generalEvidenceId ?? null,
      management.rescheduleDate ?? null,
      management.rescheduleTimeRange ?? null,
      management.managedAt,
      management.managedBy ?? null,
      management.syncStatus,
      management.isDirty ? 1 : 0,
      management.createdAt,
      management.updatedAt,
      management.localUpdatedAt,
      management.remoteUpdatedAt ?? null,
    ]
  );
}

export async function getTaskManagementById(
  id: string
): Promise<TaskManagement | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<TaskManagementRow>(
    `
      SELECT *
      FROM task_managements
      WHERE id = ?
      LIMIT 1;
    `,
    [id]
  );

  return row ? mapRowToTaskManagement(row) : null;
}

export async function getTaskManagementByGeneralEvidenceId(
  evidenceId: string
): Promise<TaskManagement | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<TaskManagementRow>(
    `
      SELECT *
      FROM task_managements
      WHERE general_evidence_id = ?
      ORDER BY managed_at DESC
      LIMIT 1;
    `,
    [evidenceId]
  );

  return row ? mapRowToTaskManagement(row) : null;
}

export async function listTaskManagementsByTask(
  taskId: string
): Promise<TaskManagement[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<TaskManagementRow>(
    `
      SELECT *
      FROM task_managements
      WHERE task_id = ?
      ORDER BY managed_at DESC, management_number DESC;
    `,
    [taskId]
  );

  return rows.map(mapRowToTaskManagement);
}

export async function listRecentTaskManagements(
  limit = 50
): Promise<TaskManagement[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<TaskManagementRow>(
    `
      SELECT *
      FROM task_managements
      WHERE sync_status <> 'synced'
        OR remote_id IS NULL
        OR is_dirty = 1
      ORDER BY managed_at DESC, management_number DESC
      LIMIT ?;
    `,
    [limit]
  );

  return rows.map(mapRowToTaskManagement);
}

export async function countTaskManagementsByTask(
  taskId: string
): Promise<TaskManagementCounters> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    total: number;
    successful: number;
    unsuccessful: number;
    rescheduled: number;
    today: number;
    dirty: number;
    pending_sync: number;
  }>(
    `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN result_status = 'successful' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN result_status = 'unsuccessful' THEN 1 ELSE 0 END) as unsuccessful,
        SUM(CASE WHEN result_status = 'rescheduled' THEN 1 ELSE 0 END) as rescheduled,
        SUM(CASE WHEN managed_at LIKE ? THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN is_dirty = 1 THEN 1 ELSE 0 END) as dirty,
        SUM(CASE WHEN sync_status IN ('pending_sync', 'sync_failed', 'conflict') THEN 1 ELSE 0 END) as pending_sync
      FROM task_managements
      WHERE task_id = ?;
    `,
    [`${todayPrefix()}%`, taskId]
  );

  return {
    total: row?.total ?? 0,
    successful: row?.successful ?? 0,
    unsuccessful: row?.unsuccessful ?? 0,
    rescheduled: row?.rescheduled ?? 0,
    today: row?.today ?? 0,
    dirty: row?.dirty ?? 0,
    pendingSync: row?.pending_sync ?? 0,
  };
}

export async function getNextManagementNumber(taskId: string): Promise<number> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ max_number: number | null }>(
    `
      SELECT MAX(management_number) as max_number
      FROM task_managements
      WHERE task_id = ?;
    `,
    [taskId]
  );

  return (row?.max_number ?? 0) + 1;
}

export async function hasTaskManagementToday(taskId: string): Promise<boolean> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ total: number }>(
    `
      SELECT COUNT(*) as total
      FROM task_managements
      WHERE task_id = ?
        AND managed_at LIKE ?;
    `,
    [taskId, `${todayPrefix()}%`]
  );

  return (row?.total ?? 0) > 0;
}
export async function markTaskManagementAsSyncedWithRemoteId(params: {
  id: string;
  remoteId: string;
  remoteUpdatedAt?: string;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE task_managements
      SET
        remote_id = ?,
        sync_status = 'synced',
        is_dirty = 0,
        remote_updated_at = ?,
        updated_at = ?
      WHERE id = ?;
    `,
    [
      params.remoteId,
      params.remoteUpdatedAt ?? now,
      now,
      params.id,
    ]
  );
}
export async function markTaskManagementAsSynced(id: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      UPDATE task_managements
      SET
        sync_status = 'synced',
        is_dirty = 0,
        updated_at = ?
      WHERE id = ?;
    `,
    [nowIso(), id]
  );
}

export async function markUnsyncedTaskManagementsAsObsoleteForMissingRemoteTasks(
  remoteIds: string[]
): Promise<number> {
  const db = await getDatabase();
  const now = nowIso();

  if (remoteIds.length === 0) {
    return 0;
  }

  const placeholders = remoteIds.map(() => '?').join(', ');

  const result = await db.runAsync(
    `
      UPDATE task_managements
      SET
        sync_status = 'conflict',
        is_dirty = 0,
        updated_at = ?,
        local_updated_at = ?
      WHERE remote_id IS NULL
        AND task_id IN (
          SELECT id
          FROM tasks
          WHERE remote_id IS NOT NULL
            AND remote_id NOT IN (${placeholders})
        );
    `,
    [now, now, ...remoteIds]
  );

  return result.changes ?? 0;
}

export async function deleteTaskManagement(id: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      DELETE FROM task_managements
      WHERE id = ?;
    `,
    [id]
  );
}

export async function clearTaskManagementsByTask(taskId: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      DELETE FROM task_managements
      WHERE task_id = ?;
    `,
    [taskId]
  );
}
