// src/infrastructure/dev/devDataReset.ts

import { getDatabase } from '@/infrastructure/db/database';

export type DevResetResult = {
  deleted: {
    syncAttempts: number;
    syncQueue: number;
    localLogs: number;
    gpsPoints: number;
    evidences: number;
    recoveredDevices: number;
    taskManagements: number;
    taskEvents: number;
    taskSeries: number;
    tasks: number;
  };
  resetAt: string;
};

async function countRows(tableName: string): Promise<number> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) as total FROM ${tableName};`
  );

  return row?.total ?? 0;
}

async function deleteRows(tableName: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(`DELETE FROM ${tableName};`);
}

export async function resetDevOperationalData(): Promise<DevResetResult> {
  const before = {
    syncAttempts: await countRows('sync_attempts'),
    syncQueue: await countRows('sync_queue'),
    localLogs: await countRows('local_logs'),
    gpsPoints: await countRows('gps_points'),
    evidences: await countRows('evidences'),
    recoveredDevices: await countRows('recovered_devices'),
    taskManagements: await countRows('task_managements'),
    taskEvents: await countRows('task_events'),
    taskSeries: await countRows('task_series'),
    tasks: await countRows('tasks'),
  };

  const db = await getDatabase();

  await db.execAsync('PRAGMA foreign_keys = OFF;');

  try {
    await deleteRows('sync_attempts');
    await deleteRows('sync_queue');
    await deleteRows('local_logs');
    await deleteRows('gps_points');
    await deleteRows('evidences');
    await deleteRows('recovered_devices');
    await deleteRows('task_managements');
    await deleteRows('task_events');
    await deleteRows('task_series');
    await deleteRows('tasks');
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }

  return {
    deleted: before,
    resetAt: new Date().toISOString(),
  };
}

export async function getDevOperationalDataCounts(): Promise<
  DevResetResult['deleted']
> {
  return {
    syncAttempts: await countRows('sync_attempts'),
    syncQueue: await countRows('sync_queue'),
    localLogs: await countRows('local_logs'),
    gpsPoints: await countRows('gps_points'),
    evidences: await countRows('evidences'),
    recoveredDevices: await countRows('recovered_devices'),
    taskManagements: await countRows('task_managements'),
    taskEvents: await countRows('task_events'),
    taskSeries: await countRows('task_series'),
    tasks: await countRows('tasks'),
  };
}