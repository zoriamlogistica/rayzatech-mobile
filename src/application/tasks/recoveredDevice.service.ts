// src/application/tasks/recoveredDevice.service.ts

import { appLogger } from '@/application/logging/appLogger.service';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import type {
  CreateRecoveredDeviceInput,
  RecoveredDevice,
  RecoveredDeviceCounters,
  UpdateRecoveredDeviceInput,
} from '@/domain/tasks/recoveredDevice.types';
import {
  countRecoveredDevicesByTask,
  deleteRecoveredDevice,
  getRecoveredDeviceById,
  listRecoveredDevicesByTask,
  upsertRecoveredDevice,
} from '@/infrastructure/db/repositories/recoveredDeviceRepository';
import { enqueueSyncItem } from '@/infrastructure/db/repositories/syncQueueRepository';

const MAX_RECOVERED_DEVICES_PER_TASK = 10;

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function normalizeText(value: string): string {
  return value.trim();
}

function assertValidCreateInput(input: CreateRecoveredDeviceInput): void {
  if (!input.taskId.trim()) {
    throw new Error('RECOVERED_DEVICE_VALIDATION:TASK_REQUIRED');
  }

  if (!input.serialNumber.trim()) {
    throw new Error('RECOVERED_DEVICE_VALIDATION:SERIAL_REQUIRED');
  }

  if (!input.deviceType) {
    throw new Error('RECOVERED_DEVICE_VALIDATION:DEVICE_TYPE_REQUIRED');
  }

  if (input.hasOtherAccessory && !input.otherAccessoryDetail?.trim()) {
    throw new Error('RECOVERED_DEVICE_VALIDATION:OTHER_ACCESSORY_DETAIL_REQUIRED');
  }
}

function assertValidUpdateInput(input: UpdateRecoveredDeviceInput): void {
  if (!input.id.trim()) {
    throw new Error('RECOVERED_DEVICE_VALIDATION:ID_REQUIRED');
  }

  if (input.serialNumber !== undefined && !input.serialNumber.trim()) {
    throw new Error('RECOVERED_DEVICE_VALIDATION:SERIAL_REQUIRED');
  }

  if (input.hasOtherAccessory && !input.otherAccessoryDetail?.trim()) {
    throw new Error('RECOVERED_DEVICE_VALIDATION:OTHER_ACCESSORY_DETAIL_REQUIRED');
  }
}

async function enqueueRecoveredDeviceSync(params: {
  device: RecoveredDevice;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
}): Promise<SyncQueueItem> {
  const now = nowIso();

  const syncItem: SyncQueueItem = {
    id: makeId('sync'),
    entityType: 'recovered_device',
    entityId: params.device.id,
    operation: params.operation,
    payload: {
      recoveredDeviceId: params.device.id,
      taskId: params.device.taskId,
      managementId: params.device.managementId,
      serialNumber: params.device.serialNumber,
      deviceType: params.device.deviceType,
      condition: params.device.condition,
      hasCharger: params.device.hasCharger,
      hasRemoteControl: params.device.hasRemoteControl,
      hasPowerSupply: params.device.hasPowerSupply,
      hasNetworkCable: params.device.hasNetworkCable,
      hasOtherAccessory: params.device.hasOtherAccessory,
      otherAccessoryDetail: params.device.otherAccessoryDetail,
      deviceObservation: params.device.deviceObservation,
      seriesLabelEvidenceId: params.device.seriesLabelEvidenceId,
      operation: params.operation,
    },
    status: 'pending',
    priority: 2,
    attemptCount: 0,
    maxAttempts: 10,
    createdAt: now,
    updatedAt: now,
  };

  await enqueueSyncItem(syncItem);

  return syncItem;
}

export async function addRecoveredDeviceOffline(
  input: CreateRecoveredDeviceInput
): Promise<{
  device: RecoveredDevice;
  counters: RecoveredDeviceCounters;
  syncItem: SyncQueueItem;
}> {
  assertValidCreateInput(input);

  const countersBefore = await countRecoveredDevicesByTask(input.taskId);

  if (countersBefore.total >= MAX_RECOVERED_DEVICES_PER_TASK) {
    throw new Error('RECOVERED_DEVICE_VALIDATION:MAX_DEVICES_REACHED');
  }

  const now = nowIso();

  const device: RecoveredDevice = {
    id: makeId('recovered_device'),
    taskId: input.taskId,
    managementId: input.managementId,

    serialNumber: normalizeText(input.serialNumber),
    deviceType: input.deviceType,
    condition: input.condition ?? 'unknown',

    hasCharger: input.hasCharger ?? false,
    hasRemoteControl: input.hasRemoteControl ?? false,
    hasPowerSupply: input.hasPowerSupply ?? false,
    hasNetworkCable: input.hasNetworkCable ?? false,
    hasOtherAccessory: input.hasOtherAccessory ?? false,
    otherAccessoryDetail: input.otherAccessoryDetail?.trim() || undefined,

    deviceObservation: input.deviceObservation?.trim() || undefined,

    seriesLabelEvidenceId: input.seriesLabelEvidenceId,

    syncStatus: 'pending_sync',
    isDirty: true,

    createdAt: now,
    updatedAt: now,
    localUpdatedAt: now,
  };

  await upsertRecoveredDevice(device);

  const syncItem = await enqueueRecoveredDeviceSync({
    device,
    operation: 'CREATE',
  });

  const counters = await countRecoveredDevicesByTask(input.taskId);

  await appLogger.info({
    scope: 'RECOVERED_DEVICE',
    message: 'Recovered device added offline.',
    taskId: input.taskId,
    payload: {
      recoveredDeviceId: device.id,
      serialNumber: device.serialNumber,
      deviceType: device.deviceType,
      counters,
    },
  });

  return {
    device,
    counters,
    syncItem,
  };
}

export async function updateRecoveredDeviceOffline(
  input: UpdateRecoveredDeviceInput
): Promise<{
  device: RecoveredDevice;
  counters: RecoveredDeviceCounters;
  syncItem: SyncQueueItem;
}> {
  assertValidUpdateInput(input);

  const existing = await getRecoveredDeviceById(input.id);

  if (!existing) {
    throw new Error(`RECOVERED_DEVICE_NOT_FOUND:${input.id}`);
  }

  const now = nowIso();

  const updated: RecoveredDevice = {
    ...existing,

    managementId:
  input.managementId !== undefined
    ? input.managementId
    : existing.managementId,

    serialNumber:
      input.serialNumber !== undefined
        ? normalizeText(input.serialNumber)
        : existing.serialNumber,

    deviceType: input.deviceType ?? existing.deviceType,
    condition: input.condition ?? existing.condition,

    hasCharger: input.hasCharger ?? existing.hasCharger,
    hasRemoteControl: input.hasRemoteControl ?? existing.hasRemoteControl,
    hasPowerSupply: input.hasPowerSupply ?? existing.hasPowerSupply,
    hasNetworkCable: input.hasNetworkCable ?? existing.hasNetworkCable,
    hasOtherAccessory: input.hasOtherAccessory ?? existing.hasOtherAccessory,
    otherAccessoryDetail:
      input.otherAccessoryDetail !== undefined
        ? input.otherAccessoryDetail.trim() || undefined
        : existing.otherAccessoryDetail,

    deviceObservation:
      input.deviceObservation !== undefined
        ? input.deviceObservation.trim() || undefined
        : existing.deviceObservation,

    seriesLabelEvidenceId:
      input.seriesLabelEvidenceId !== undefined
        ? input.seriesLabelEvidenceId
        : existing.seriesLabelEvidenceId,

    syncStatus: 'pending_sync',
    isDirty: true,
    updatedAt: now,
    localUpdatedAt: now,
  };

  await upsertRecoveredDevice(updated);

  const syncItem = await enqueueRecoveredDeviceSync({
    device: updated,
    operation: 'UPDATE',
  });

  const counters = await countRecoveredDevicesByTask(updated.taskId);

  await appLogger.info({
    scope: 'RECOVERED_DEVICE',
    message: 'Recovered device updated offline.',
    taskId: updated.taskId,
    payload: {
      recoveredDeviceId: updated.id,
      serialNumber: updated.serialNumber,
      deviceType: updated.deviceType,
      counters,
    },
  });

  return {
    device: updated,
    counters,
    syncItem,
  };
}

export async function attachSeriesLabelEvidenceToRecoveredDeviceOffline(params: {
  recoveredDeviceId: string;
  evidenceId: string;
}): Promise<{
  device: RecoveredDevice;
  counters: RecoveredDeviceCounters;
  syncItem: SyncQueueItem;
}> {
  return updateRecoveredDeviceOffline({
    id: params.recoveredDeviceId,
    seriesLabelEvidenceId: params.evidenceId,
  });
}

export async function removeRecoveredDeviceOffline(id: string): Promise<{
  removedDeviceId: string;
  taskId: string;
  counters: RecoveredDeviceCounters;
  syncItem: SyncQueueItem;
}> {
  const existing = await getRecoveredDeviceById(id);

  if (!existing) {
    throw new Error(`RECOVERED_DEVICE_NOT_FOUND:${id}`);
  }

  const syncItem = await enqueueRecoveredDeviceSync({
    device: existing,
    operation: 'DELETE',
  });

  await deleteRecoveredDevice(id);

  const counters = await countRecoveredDevicesByTask(existing.taskId);

  await appLogger.warn({
    scope: 'RECOVERED_DEVICE',
    message: 'Recovered device removed offline.',
    taskId: existing.taskId,
    payload: {
      recoveredDeviceId: existing.id,
      serialNumber: existing.serialNumber,
      counters,
    },
  });

  return {
    removedDeviceId: id,
    taskId: existing.taskId,
    counters,
    syncItem,
  };
}

export async function listRecoveredDevicesForTask(
  taskId: string
): Promise<RecoveredDevice[]> {
  return listRecoveredDevicesByTask(taskId);
}

export async function getRecoveredDeviceCountersForTask(
  taskId: string
): Promise<RecoveredDeviceCounters> {
  return countRecoveredDevicesByTask(taskId);
}

export function getMaxRecoveredDevicesPerTask(): number {
  return MAX_RECOVERED_DEVICES_PER_TASK;
}