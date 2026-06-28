// src/infrastructure/db/repositories/syncQueueRepository.ts

import type {
  SyncEntityType,
  SyncOperation,
  SyncQueueItem,
  SyncQueueStatus,
} from '@/domain/sync/sync.types';
import { getDatabase } from '../database';

type SyncQueueRow = {
  id: string;

  entity_type: SyncEntityType;
  entity_id: string;
  operation: SyncOperation;

  payload: string;

  status: SyncQueueStatus;
  priority: number;

  attempt_count: number;
  max_attempts: number;

  next_attempt_at: string | null;
  locked_at: string | null;
  locked_by: string | null;

  last_error: string | null;
  last_error_code: string | null;

  created_at: string;
  updated_at: string;
};

function mapRowToSyncQueueItem(row: SyncQueueRow): SyncQueueItem {
  return {
    id: row.id,

    entityType: row.entity_type,
    entityId: row.entity_id,
    operation: row.operation,

    payload: JSON.parse(row.payload),

    status: row.status,
    priority: row.priority,

    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,

    nextAttemptAt: row.next_attempt_at ?? undefined,
    lockedAt: row.locked_at ?? undefined,
    lockedBy: row.locked_by ?? undefined,

    lastError: row.last_error ?? undefined,
    lastErrorCode: row.last_error_code ?? undefined,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeStringify(payload: Record<string, unknown>): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({
      serializationError: true,
      message: 'Payload could not be serialized',
    });
  }
}

export async function enqueueSyncItem(item: SyncQueueItem): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO sync_queue (
        id,
        entity_type,
        entity_id,
        operation,
        payload,
        status,
        priority,
        attempt_count,
        max_attempts,
        next_attempt_at,
        locked_at,
        locked_by,
        last_error,
        last_error_code,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      item.id,
      item.entityType,
      item.entityId,
      item.operation,
      safeStringify(item.payload),
      item.status,
      item.priority,
      item.attemptCount,
      item.maxAttempts,
      item.nextAttemptAt ?? null,
      item.lockedAt ?? null,
      item.lockedBy ?? null,
      item.lastError ?? null,
      item.lastErrorCode ?? null,
      item.createdAt,
      item.updatedAt,
    ]
  );
}

export async function getSyncItemById(
  id: string
): Promise<SyncQueueItem | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<SyncQueueRow>(
    `
      SELECT *
      FROM sync_queue
      WHERE id = ?
      LIMIT 1;
    `,
    [id]
  );

  return row ? mapRowToSyncQueueItem(row) : null;
}

export async function listPendingSyncItems(
  limit = 25
): Promise<SyncQueueItem[]> {
  const db = await getDatabase();

  const now = nowIso();

  const rows = await db.getAllAsync<SyncQueueRow>(
    `
      SELECT *
      FROM sync_queue
      WHERE status IN ('pending', 'failed')
        AND attempt_count < max_attempts
        AND (
          next_attempt_at IS NULL
          OR next_attempt_at <= ?
        )
      ORDER BY priority ASC, created_at ASC
      LIMIT ?;
    `,
    [now, limit]
  );

  return rows.map(mapRowToSyncQueueItem);
}

export async function markSyncItemAsSyncing(params: {
  id: string;
  workerId: string;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'syncing',
        locked_at = ?,
        locked_by = ?,
        updated_at = ?
      WHERE id = ?;
    `,
    [now, params.workerId, now, params.id]
  );
}

export async function markSyncItemAsSuccess(id: string): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'success',
        locked_at = NULL,
        locked_by = NULL,
        updated_at = ?
      WHERE id = ?;
    `,
    [now, id]
  );
}

export async function markSyncItemAsFailed(params: {
  id: string;
  error: string;
  errorCode?: string;
  nextAttemptAt?: string;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'failed',
        attempt_count = attempt_count + 1,
        locked_at = NULL,
        locked_by = NULL,
        last_error = ?,
        last_error_code = ?,
        next_attempt_at = ?,
        updated_at = ?
      WHERE id = ?;
    `,
    [
      params.error,
      params.errorCode ?? null,
      params.nextAttemptAt ?? null,
      now,
      params.id,
    ]
  );
}

export async function markSyncItemAsConflict(params: {
  id: string;
  error: string;
  errorCode?: string;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'conflict',
        locked_at = NULL,
        locked_by = NULL,
        last_error = ?,
        last_error_code = ?,
        updated_at = ?
      WHERE id = ?;
    `,
    [params.error, params.errorCode ?? null, now, params.id]
  );
}

export async function countPendingSyncItems(): Promise<number> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ total: number }>(
    `
      SELECT COUNT(*) as total
      FROM sync_queue
      WHERE status IN ('pending', 'failed', 'syncing', 'conflict');
    `
  );

  return row?.total ?? 0;
}

export async function countEligibleSyncItems(): Promise<number> {
  const db = await getDatabase();

  const now = nowIso();

  const row = await db.getFirstAsync<{ total: number }>(
    `
      SELECT COUNT(*) as total
      FROM sync_queue
      WHERE status IN ('pending', 'failed')
        AND attempt_count < max_attempts
        AND (
          next_attempt_at IS NULL
          OR next_attempt_at <= ?
        );
    `,
    [now]
  );

  return row?.total ?? 0;
}

export async function countWaitingRetrySyncItems(): Promise<number> {
  const db = await getDatabase();

  const now = nowIso();

  const row = await db.getFirstAsync<{ total: number }>(
    `
      SELECT COUNT(*) as total
      FROM sync_queue
      WHERE status = 'failed'
        AND attempt_count < max_attempts
        AND next_attempt_at IS NOT NULL
        AND next_attempt_at > ?;
    `,
    [now]
  );

  return row?.total ?? 0;
}

export async function countConflictSyncItems(): Promise<number> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ total: number }>(
    `
      SELECT COUNT(*) as total
      FROM sync_queue
      WHERE status = 'conflict';
    `
  );

  return row?.total ?? 0;
}

export async function getSyncQueueCounters(): Promise<{
  totalPending: number;
  eligible: number;
  waitingRetry: number;
  conflicts: number;
}> {
  const [totalPending, eligible, waitingRetry, conflicts] = await Promise.all([
    countPendingSyncItems(),
    countEligibleSyncItems(),
    countWaitingRetrySyncItems(),
    countConflictSyncItems(),
  ]);

  return {
    totalPending,
    eligible,
    waitingRetry,
    conflicts,
  };
}

export async function listRecentSyncProblems(limit = 3): Promise<
  Array<{
    entityType: string;
    entityId: string;
    errorCode?: string;
    error?: string;
  }>
> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    entity_type: string;
    entity_id: string;
    last_error_code: string | null;
    last_error: string | null;
  }>(
    `
      SELECT entity_type, entity_id, last_error_code, last_error
      FROM sync_queue
      WHERE status IN ('failed', 'conflict')
        AND (
          last_error IS NOT NULL
          OR last_error_code IS NOT NULL
        )
      ORDER BY updated_at DESC
      LIMIT ?;
    `,
    [limit]
  );

  return rows.map((row) => ({
    entityType: row.entity_type,
    entityId: row.entity_id,
    errorCode: row.last_error_code ?? undefined,
    error: row.last_error ?? undefined,
  }));
}

export async function clearSuccessfulSyncItems(): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      DELETE FROM sync_queue
      WHERE status = 'success';
    `
  );
}

export async function releaseWaitingRetrySyncItems(): Promise<number> {
  const db = await getDatabase();
  const now = nowIso();

  const result = await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'pending',
        next_attempt_at = NULL,
        locked_at = NULL,
        locked_by = NULL,
        updated_at = ?
      WHERE status = 'failed'
        AND next_attempt_at IS NOT NULL;
    `,
    [now]
  );

  return result.changes ?? 0;
}

export async function releaseBlockedSyncItems(): Promise<number> {
  const db = await getDatabase();
  const now = nowIso();

  const result = await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'pending',
        attempt_count = 0,
        next_attempt_at = NULL,
        locked_at = NULL,
        locked_by = NULL,
        last_error = NULL,
        last_error_code = NULL,
        updated_at = ?
      WHERE status IN ('syncing', 'conflict')
        OR (
          status IN ('pending', 'failed')
          AND attempt_count >= max_attempts
        );
    `,
    [now]
  );

  return result.changes ?? 0;
}

export async function markGpsPointSyncItemsAsSuccess(): Promise<number> {
  const db = await getDatabase();
  const now = nowIso();

  const result = await db.runAsync(
    `
      UPDATE sync_queue
      SET
        status = 'success',
        locked_at = NULL,
        locked_by = NULL,
        last_error = NULL,
        last_error_code = NULL,
        next_attempt_at = NULL,
        updated_at = ?
      WHERE entity_type = 'gps_point'
        AND status IN ('pending', 'failed', 'syncing', 'conflict');
    `,
    [now]
  );

  return result.changes ?? 0;
}
