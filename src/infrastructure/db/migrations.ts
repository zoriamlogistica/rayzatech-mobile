// src/infrastructure/db/migrations.ts

import type { SQLiteDatabase } from 'expo-sqlite';
import { migrations } from './schema';

const MIGRATIONS_TABLE = 'schema_migrations';

async function ensureMigrationsTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

async function getAppliedVersions(db: SQLiteDatabase): Promise<number[]> {
  const rows = await db.getAllAsync<{ version: number }>(
    `SELECT version FROM ${MIGRATIONS_TABLE} ORDER BY version ASC;`
  );

  return rows.map((row) => row.version);
}

async function markMigrationAsApplied(
  db: SQLiteDatabase,
  version: number,
  name: string
): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `
      INSERT INTO ${MIGRATIONS_TABLE} (version, name, applied_at)
      VALUES (?, ?, ?);
    `,
    [version, name, now]
  );
}

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await ensureMigrationsTable(db);

  const appliedVersions = await getAppliedVersions(db);
  const appliedSet = new Set(appliedVersions);

  const pendingMigrations = migrations
    .filter((migration) => !appliedSet.has(migration.version))
    .sort((a, b) => a.version - b.version);

  for (const migration of pendingMigrations) {
    try {
      await db.execAsync('BEGIN TRANSACTION;');
      await db.execAsync(migration.sql);
      await markMigrationAsApplied(db, migration.version, migration.name);
      await db.execAsync('COMMIT;');
    } catch (error) {
      await db.execAsync('ROLLBACK;');

      console.error(
        `[DB] Error applying migration ${migration.version} - ${migration.name}`,
        error
      );

      throw error;
    }
  }
}

export async function getCurrentSchemaVersion(
  db: SQLiteDatabase
): Promise<number> {
  await ensureMigrationsTable(db);

  const row = await db.getFirstAsync<{ version: number }>(
    `
      SELECT version
      FROM ${MIGRATIONS_TABLE}
      ORDER BY version DESC
      LIMIT 1;
    `
  );

  return row?.version ?? 0;
}