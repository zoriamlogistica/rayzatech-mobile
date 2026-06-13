// src/infrastructure/db/repositories/taskEventRepository.ts

import type { SyncStatus, TaskStatus } from '@/domain/tasks/task.types';
import type { TaskEvent, TaskEventType } from '@/domain/tasks/taskEvent.types';
import { getDatabase } from '../database';

type TaskEventRow = {
  id: string;
  task_id: string;
  remote_id: string | null;

  event_type: TaskEventType;
  from_status: TaskStatus | null;
  to_status: TaskStatus | null;

  description: string | null;
  payload: string | null;

  user_id: string | null;
  device_id: string | null;

  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;

  occurred_at: string;

  sync_status: SyncStatus;
  created_at: string;
};

function mapRowToTaskEvent(row: TaskEventRow): TaskEvent {
  return {
    id: row.id,
    taskId: row.task_id,
    remoteId: row.remote_id ?? undefined,

    eventType: row.event_type,

    fromStatus: row.from_status ?? undefined,
    toStatus: row.to_status ?? undefined,

    description: row.description ?? undefined,
    payload: row.payload ? JSON.parse(row.payload) : undefined,

    userId: row.user_id ?? undefined,
    deviceId: row.device_id ?? undefined,

    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    accuracy: row.accuracy ?? undefined,

    occurredAt: row.occurred_at,

    syncStatus: row.sync_status,
    createdAt: row.created_at,
  };
}

function safeStringify(value?: Record<string, unknown>): string | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({
      serializationError: true,
      message: 'Payload could not be serialized',
    });
  }
}

export async function insertTaskEvent(event: TaskEvent): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO task_events (
        id,
        task_id,
        remote_id,
        event_type,
        from_status,
        to_status,
        description,
        payload,
        user_id,
        device_id,
        latitude,
        longitude,
        accuracy,
        occurred_at,
        sync_status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      event.id,
      event.taskId,
      event.remoteId ?? null,
      event.eventType,
      event.fromStatus ?? null,
      event.toStatus ?? null,
      event.description ?? null,
      safeStringify(event.payload),
      event.userId ?? null,
      event.deviceId ?? null,
      event.latitude ?? null,
      event.longitude ?? null,
      event.accuracy ?? null,
      event.occurredAt,
      event.syncStatus,
      event.createdAt,
    ]
  );
}

export async function getTaskEventById(id: string): Promise<TaskEvent | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<TaskEventRow>(
    `
      SELECT *
      FROM task_events
      WHERE id = ?
      LIMIT 1;
    `,
    [id]
  );

  return row ? mapRowToTaskEvent(row) : null;
}

export async function listTaskEvents(taskId: string): Promise<TaskEvent[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<TaskEventRow>(
    `
      SELECT *
      FROM task_events
      WHERE task_id = ?
      ORDER BY occurred_at ASC;
    `,
    [taskId]
  );

  return rows.map(mapRowToTaskEvent);
}

export async function listPendingTaskEvents(): Promise<TaskEvent[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<TaskEventRow>(
    `
      SELECT *
      FROM task_events
      WHERE sync_status IN ('pending_sync', 'sync_failed')
      ORDER BY occurred_at ASC;
    `
  );

  return rows.map(mapRowToTaskEvent);
}

export async function markTaskEventAsSynced(params: {
  eventId: string;
  remoteId?: string;
}): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      UPDATE task_events
      SET
        remote_id = COALESCE(?, remote_id),
        sync_status = 'synced'
      WHERE id = ?;
    `,
    [params.remoteId ?? null, params.eventId]
  );
}

export async function markTaskEventAsFailed(params: {
  eventId: string;
}): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      UPDATE task_events
      SET sync_status = 'sync_failed'
      WHERE id = ?;
    `,
    [params.eventId]
  );
}