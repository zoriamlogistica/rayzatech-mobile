// src/infrastructure/db/db.types.ts

export type DatabaseStatus =
  | 'idle'
  | 'opening'
  | 'ready'
  | 'migrating'
  | 'error';

export type DatabaseInfo = {
  name: string;
  currentVersion: number;
  latestVersion: number;
  status: DatabaseStatus;
};

export type MigrationRecord = {
  version: number;
  name: string;
  applied_at: string;
};

export type QueryParams = Array<string | number | null | boolean>;