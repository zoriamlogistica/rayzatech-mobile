// src/infrastructure/db/database.ts

import * as SQLite from 'expo-sqlite';
import type { DatabaseInfo } from './db.types';
import { getCurrentSchemaVersion, runMigrations } from './migrations';
import { migrations } from './schema';

const DATABASE_NAME = 'rayzatech_recovery.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await db.execAsync('PRAGMA foreign_keys = ON;');

  await runMigrations(db);

  dbInstance = db;

  return dbInstance;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    return openDatabase();
  }

  return dbInstance;
}

export async function getDatabaseInfo(): Promise<DatabaseInfo> {
  const db = await getDatabase();

  const currentVersion = await getCurrentSchemaVersion(db);
  const latestVersion = Math.max(...migrations.map((m) => m.version));

  return {
    name: DATABASE_NAME,
    currentVersion,
    latestVersion,
    status: 'ready',
  };
}

export async function closeDatabase(): Promise<void> {
  if (!dbInstance) {
    return;
  }

  await dbInstance.closeAsync();
  dbInstance = null;
}

export async function resetDatabaseDangerously(): Promise<void> {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA foreign_keys = OFF;

    DROP TABLE IF EXISTS sync_attempts;
    DROP TABLE IF EXISTS sync_queue;
    DROP TABLE IF EXISTS local_logs;
    DROP TABLE IF EXISTS catalogs;
    DROP TABLE IF EXISTS gps_points;
    DROP TABLE IF EXISTS evidences;
    DROP TABLE IF EXISTS task_events;
    DROP TABLE IF EXISTS task_series;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS app_metadata;
    DROP TABLE IF EXISTS schema_migrations;

    PRAGMA foreign_keys = ON;
  `);

  await runMigrations(db);
}