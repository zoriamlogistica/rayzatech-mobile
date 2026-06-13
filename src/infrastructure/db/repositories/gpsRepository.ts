// src/infrastructure/db/repositories/gpsRepository.ts

import type { GpsPoint } from '@/domain/gps/gps.types';
import type { SyncStatus } from '@/domain/tasks/task.types';
import { getDatabase } from '../database';

type GpsPointRow = {
  id: string;

  task_id: string | null;
  task_event_id: string | null;

  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;

  provider: string | null;
  mocked: number;

  captured_at: string;
  sync_status: SyncStatus;

  created_at: string;
};

function mapRowToGpsPoint(row: GpsPointRow): GpsPoint {
  return {
    id: row.id,

    taskId: row.task_id ?? undefined,
    taskEventId: row.task_event_id ?? undefined,

    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy ?? undefined,
    altitude: row.altitude ?? undefined,
    speed: row.speed ?? undefined,
    heading: row.heading ?? undefined,

    provider: row.provider ?? undefined,
    mocked: row.mocked === 1,

    capturedAt: row.captured_at,
    syncStatus: row.sync_status,

    createdAt: row.created_at,
  };
}

export async function insertGpsPoint(gpsPoint: GpsPoint): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO gps_points (
        id,
        task_id,
        task_event_id,
        latitude,
        longitude,
        accuracy,
        altitude,
        speed,
        heading,
        provider,
        mocked,
        captured_at,
        sync_status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      gpsPoint.id,
      gpsPoint.taskId ?? null,
      gpsPoint.taskEventId ?? null,
      gpsPoint.latitude,
      gpsPoint.longitude,
      gpsPoint.accuracy ?? null,
      gpsPoint.altitude ?? null,
      gpsPoint.speed ?? null,
      gpsPoint.heading ?? null,
      gpsPoint.provider ?? null,
      gpsPoint.mocked ? 1 : 0,
      gpsPoint.capturedAt,
      gpsPoint.syncStatus,
      gpsPoint.createdAt,
    ]
  );
}

export async function getGpsPointById(id: string): Promise<GpsPoint | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<GpsPointRow>(
    `
      SELECT *
      FROM gps_points
      WHERE id = ?
      LIMIT 1;
    `,
    [id]
  );

  return row ? mapRowToGpsPoint(row) : null;
}

export async function listGpsPointsByTask(taskId: string): Promise<GpsPoint[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<GpsPointRow>(
    `
      SELECT *
      FROM gps_points
      WHERE task_id = ?
      ORDER BY captured_at ASC;
    `,
    [taskId]
  );

  return rows.map(mapRowToGpsPoint);
}

export async function listPendingGpsPoints(): Promise<GpsPoint[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<GpsPointRow>(
    `
      SELECT *
      FROM gps_points
      WHERE sync_status IN ('pending_sync', 'sync_failed')
      ORDER BY captured_at ASC;
    `
  );

  return rows.map(mapRowToGpsPoint);
}

export async function markGpsPointAsSynced(gpsPointId: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      UPDATE gps_points
      SET sync_status = 'synced'
      WHERE id = ?;
    `,
    [gpsPointId]
  );
}

export async function markGpsPointAsFailed(gpsPointId: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      UPDATE gps_points
      SET sync_status = 'sync_failed'
      WHERE id = ?;
    `,
    [gpsPointId]
  );
}

export async function countGpsPointsByTask(taskId: string): Promise<{
  total: number;
  pendingSync: number;
  mocked: number;
}> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    total: number;
    pendingSync: number;
    mocked: number;
  }>(
    `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN sync_status IN ('pending_sync', 'sync_failed') THEN 1 ELSE 0 END) as pendingSync,
        SUM(CASE WHEN mocked = 1 THEN 1 ELSE 0 END) as mocked
      FROM gps_points
      WHERE task_id = ?;
    `,
    [taskId]
  );

  return {
    total: row?.total ?? 0,
    pendingSync: row?.pendingSync ?? 0,
    mocked: row?.mocked ?? 0,
  };
}