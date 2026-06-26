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

async function getTableColumns(
  db: SQLiteDatabase,
  tableName: string
): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${tableName});`
  );

  return new Set(rows.map((row) => row.name));
}

async function addColumnIfMissing(params: {
  db: SQLiteDatabase;
  tableName: string;
  columnName: string;
  definition: string;
  existingColumns: Set<string>;
}): Promise<void> {
  if (params.existingColumns.has(params.columnName)) {
    return;
  }

  await params.db.execAsync(
    `ALTER TABLE ${params.tableName} ADD COLUMN ${params.columnName} ${params.definition};`
  );

  params.existingColumns.add(params.columnName);
}

async function applyLastMileTaskFieldsMigration(
  db: SQLiteDatabase
): Promise<void> {
  const existingColumns = await getTableColumns(db, 'tasks');
  const columns: { columnName: string; definition: string }[] = [
    { columnName: 'route_number', definition: 'TEXT' },
    { columnName: 'guide_number', definition: 'TEXT' },
    {
      columnName: 'field_operation_type',
      definition: "TEXT DEFAULT 'inverse'",
    },
    { columnName: 'last_mile_task_type', definition: 'TEXT' },
    { columnName: 'service_area', definition: 'TEXT' },
    { columnName: 'contact_data', definition: 'TEXT' },
    { columnName: 'package_count', definition: 'INTEGER' },
    { columnName: 'delivery_instructions', definition: 'TEXT' },
    { columnName: 'merchandise_condition', definition: 'TEXT' },
    {
      columnName: 'liquidation_status',
      definition: "TEXT DEFAULT 'none'",
    },
    {
      columnName: 'has_pending_liquidation',
      definition: 'INTEGER DEFAULT 0',
    },
  ];

  for (const column of columns) {
    await addColumnIfMissing({
      db,
      tableName: 'tasks',
      columnName: column.columnName,
      definition: column.definition,
      existingColumns,
    });
  }
}

async function applyCustomMigrationIfNeeded(
  db: SQLiteDatabase,
  version: number
): Promise<boolean> {
  if (version === 8) {
    await applyLastMileTaskFieldsMigration(db);
    return true;
  }

  return false;
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
      const customApplied = await applyCustomMigrationIfNeeded(
        db,
        migration.version
      );

      if (!customApplied && migration.sql.trim()) {
        await db.execAsync(migration.sql);
      }

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
