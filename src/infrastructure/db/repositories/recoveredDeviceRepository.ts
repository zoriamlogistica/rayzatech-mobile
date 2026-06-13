// src/infrastructure/db/repositories/recoveredDeviceRepository.ts

import type {
  RecoveredDevice,
  RecoveredDeviceCondition,
  RecoveredDeviceCounters,
  RecoveredDeviceType,
} from '@/domain/tasks/recoveredDevice.types';

import { getDatabase } from '../database';

type RecoveredDeviceRow = {
  id: string;
  task_id: string;
  management_id: string | null;
  remote_id: string | null;

  serial_number: string;
  device_type: RecoveredDeviceType;
  condition: RecoveredDeviceCondition;

  has_charger: number;
  has_remote_control: number;
  has_power_supply: number;
  has_network_cable: number;
  has_other_accessory: number;
  other_accessory_detail: string | null;

  device_observation: string | null;

  series_label_evidence_id: string | null;

  sync_status: RecoveredDevice['syncStatus'];
  is_dirty: number;

  created_at: string;
  updated_at: string;
  local_updated_at: string;
  remote_updated_at: string | null;
};

function mapRowToRecoveredDevice(row: RecoveredDeviceRow): RecoveredDevice {
  return {
    id: row.id,
    taskId: row.task_id,
    managementId: row.management_id ?? undefined,
    remoteId: row.remote_id ?? undefined,

    serialNumber: row.serial_number,
    deviceType: row.device_type,
    condition: row.condition,

    hasCharger: row.has_charger === 1,
    hasRemoteControl: row.has_remote_control === 1,
    hasPowerSupply: row.has_power_supply === 1,
    hasNetworkCable: row.has_network_cable === 1,
    hasOtherAccessory: row.has_other_accessory === 1,
    otherAccessoryDetail: row.other_accessory_detail ?? undefined,

    deviceObservation: row.device_observation ?? undefined,

    seriesLabelEvidenceId: row.series_label_evidence_id ?? undefined,

    syncStatus: row.sync_status,
    isDirty: row.is_dirty === 1,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
    localUpdatedAt: row.local_updated_at,
    remoteUpdatedAt: row.remote_updated_at ?? undefined,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function upsertRecoveredDevice(
  device: RecoveredDevice
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO recovered_devices (
        id,
        task_id,
        management_id,
        remote_id,
        serial_number,
        device_type,
        condition,
        has_charger,
        has_remote_control,
        has_power_supply,
        has_network_cable,
        has_other_accessory,
        other_accessory_detail,
        device_observation,
        series_label_evidence_id,
        sync_status,
        is_dirty,
        created_at,
        updated_at,
        local_updated_at,
        remote_updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        task_id = excluded.task_id,
        management_id = excluded.management_id,
        remote_id = excluded.remote_id,
        serial_number = excluded.serial_number,
        device_type = excluded.device_type,
        condition = excluded.condition,
        has_charger = excluded.has_charger,
        has_remote_control = excluded.has_remote_control,
        has_power_supply = excluded.has_power_supply,
        has_network_cable = excluded.has_network_cable,
        has_other_accessory = excluded.has_other_accessory,
        other_accessory_detail = excluded.other_accessory_detail,
        device_observation = excluded.device_observation,
        series_label_evidence_id = excluded.series_label_evidence_id,
        sync_status = excluded.sync_status,
        is_dirty = excluded.is_dirty,
        updated_at = excluded.updated_at,
        local_updated_at = excluded.local_updated_at,
        remote_updated_at = excluded.remote_updated_at;
    `,
    [
      device.id,
      device.taskId,
      device.managementId ?? null,
      device.remoteId ?? null,
      device.serialNumber,
      device.deviceType,
      device.condition,
      device.hasCharger ? 1 : 0,
      device.hasRemoteControl ? 1 : 0,
      device.hasPowerSupply ? 1 : 0,
      device.hasNetworkCable ? 1 : 0,
      device.hasOtherAccessory ? 1 : 0,
      device.otherAccessoryDetail ?? null,
      device.deviceObservation ?? null,
      device.seriesLabelEvidenceId ?? null,
      device.syncStatus,
      device.isDirty ? 1 : 0,
      device.createdAt,
      device.updatedAt,
      device.localUpdatedAt,
      device.remoteUpdatedAt ?? null,
    ]
  );
}

export async function getRecoveredDeviceById(
  id: string
): Promise<RecoveredDevice | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<RecoveredDeviceRow>(
    `
      SELECT *
      FROM recovered_devices
      WHERE id = ?
      LIMIT 1;
    `,
    [id]
  );

  return row ? mapRowToRecoveredDevice(row) : null;
}

export async function listRecoveredDevicesByTask(
  taskId: string
): Promise<RecoveredDevice[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<RecoveredDeviceRow>(
    `
      SELECT *
      FROM recovered_devices
      WHERE task_id = ?
      ORDER BY created_at ASC;
    `,
    [taskId]
  );

  return rows.map(mapRowToRecoveredDevice);
}

export async function countRecoveredDevicesByTask(
  taskId: string
): Promise<RecoveredDeviceCounters> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    total: number;
    with_photo: number;
    missing_photo: number;
    dirty: number;
    pending_sync: number;
  }>(
    `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN series_label_evidence_id IS NOT NULL THEN 1 ELSE 0 END) as with_photo,
        SUM(CASE WHEN series_label_evidence_id IS NULL THEN 1 ELSE 0 END) as missing_photo,
        SUM(CASE WHEN is_dirty = 1 THEN 1 ELSE 0 END) as dirty,
        SUM(CASE WHEN sync_status IN ('pending_sync', 'sync_failed', 'conflict') THEN 1 ELSE 0 END) as pending_sync
      FROM recovered_devices
      WHERE task_id = ?;
    `,
    [taskId]
  );

  return {
    total: row?.total ?? 0,
    withPhoto: row?.with_photo ?? 0,
    missingPhoto: row?.missing_photo ?? 0,
    dirty: row?.dirty ?? 0,
    pendingSync: row?.pending_sync ?? 0,
  };
}

export async function deleteRecoveredDevice(id: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      DELETE FROM recovered_devices
      WHERE id = ?;
    `,
    [id]
  );
}

export async function markRecoveredDeviceAsSynced(id: string): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE recovered_devices
      SET
        sync_status = 'synced',
        is_dirty = 0,
        updated_at = ?
      WHERE id = ?;
    `,
    [now, id]
  );
}

export async function markRecoveredDeviceAsSyncedWithRemoteId(params: {
  id: string;
  remoteId: string;
  remoteUpdatedAt?: string;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE recovered_devices
      SET
        remote_id = ?,
        sync_status = 'synced',
        is_dirty = 0,
        updated_at = ?,
        remote_updated_at = ?
      WHERE id = ?;
    `,
    [
      params.remoteId,
      now,
      params.remoteUpdatedAt ?? now,
      params.id,
    ]
  );
}

export async function markRecoveredDeviceAsFailed(params: {
  id: string;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE recovered_devices
      SET
        sync_status = 'sync_failed',
        updated_at = ?
      WHERE id = ?;
    `,
    [now, params.id]
  );
}

export async function clearRecoveredDevicesByTask(taskId: string): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      DELETE FROM recovered_devices
      WHERE task_id = ?;
    `,
    [taskId]
  );
}
export async function listRecoveredDevicesByManagement(
  managementId: string
): Promise<RecoveredDevice[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<RecoveredDeviceRow>(
    `
      SELECT *
      FROM recovered_devices
      WHERE management_id = ?
      ORDER BY created_at ASC;
    `,
    [managementId]
  );

  return rows.map(mapRowToRecoveredDevice);
}

export async function linkRecoveredDeviceToManagement(params: {
  recoveredDeviceId: string;
  managementId: string;
}): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      UPDATE recovered_devices
      SET
        management_id = ?,
        updated_at = ?,
        local_updated_at = ?,
        sync_status = 'pending_sync',
        is_dirty = 1
      WHERE id = ?;
    `,
    [
      params.managementId,
      new Date().toISOString(),
      new Date().toISOString(),
      params.recoveredDeviceId,
    ]
  );
}
export async function getRecoveredDeviceBySeriesLabelEvidenceId(
  evidenceId: string
): Promise<RecoveredDevice | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<RecoveredDeviceRow>(
    `
      SELECT *
      FROM recovered_devices
      WHERE series_label_evidence_id = ?
      LIMIT 1;
    `,
    [evidenceId]
  );

  return row ? mapRowToRecoveredDevice(row) : null;
}