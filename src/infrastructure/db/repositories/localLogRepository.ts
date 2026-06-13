// src/infrastructure/db/repositories/localLogRepository.ts

import { getDatabase } from '../database';

export type LocalLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LocalLog = {
  id: string;
  level: LocalLogLevel;
  scope: string;
  message: string;
  payload?: Record<string, unknown>;
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
  taskId?: string;
  userId?: string;
  createdAt: string;
};

type LocalLogRow = {
  id: string;
  level: LocalLogLevel;
  scope: string;
  message: string;
  payload: string | null;
  error_name: string | null;
  error_message: string | null;
  error_stack: string | null;
  task_id: string | null;
  user_id: string | null;
  created_at: string;
};

function mapRowToLocalLog(row: LocalLogRow): LocalLog {
  return {
    id: row.id,
    level: row.level,
    scope: row.scope,
    message: row.message,
    payload: row.payload ? JSON.parse(row.payload) : undefined,
    errorName: row.error_name ?? undefined,
    errorMessage: row.error_message ?? undefined,
    errorStack: row.error_stack ?? undefined,
    taskId: row.task_id ?? undefined,
    userId: row.user_id ?? undefined,
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

export async function insertLocalLog(log: LocalLog): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO local_logs (
        id,
        level,
        scope,
        message,
        payload,
        error_name,
        error_message,
        error_stack,
        task_id,
        user_id,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      log.id,
      log.level,
      log.scope,
      log.message,
      safeStringify(log.payload),
      log.errorName ?? null,
      log.errorMessage ?? null,
      log.errorStack ?? null,
      log.taskId ?? null,
      log.userId ?? null,
      log.createdAt,
    ]
  );
}

export async function listLocalLogs(limit = 100): Promise<LocalLog[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<LocalLogRow>(
    `
      SELECT *
      FROM local_logs
      ORDER BY created_at DESC
      LIMIT ?;
    `,
    [limit]
  );

  return rows.map(mapRowToLocalLog);
}

export async function listLocalLogsByLevel(
  level: LocalLogLevel,
  limit = 100
): Promise<LocalLog[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<LocalLogRow>(
    `
      SELECT *
      FROM local_logs
      WHERE level = ?
      ORDER BY created_at DESC
      LIMIT ?;
    `,
    [level, limit]
  );

  return rows.map(mapRowToLocalLog);
}

export async function countLocalLogs(): Promise<{
  total: number;
  debug: number;
  info: number;
  warn: number;
  error: number;
}> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    total: number;
    debug: number;
    info: number;
    warn: number;
    error: number;
  }>(
    `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN level = 'debug' THEN 1 ELSE 0 END) as debug,
        SUM(CASE WHEN level = 'info' THEN 1 ELSE 0 END) as info,
        SUM(CASE WHEN level = 'warn' THEN 1 ELSE 0 END) as warn,
        SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) as error
      FROM local_logs;
    `
  );

  return {
    total: row?.total ?? 0,
    debug: row?.debug ?? 0,
    info: row?.info ?? 0,
    warn: row?.warn ?? 0,
    error: row?.error ?? 0,
  };
}

export async function clearLocalLogs(): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      DELETE FROM local_logs;
    `
  );
}