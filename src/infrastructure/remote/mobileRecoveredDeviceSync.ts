// src/infrastructure/remote/mobileRecoveredDeviceSync.ts

import {
  getRecoveredDeviceById,
  markRecoveredDeviceAsSyncedWithRemoteId,
} from '@/infrastructure/db/repositories/recoveredDeviceRepository';
import { getTaskManagementById } from '@/infrastructure/db/repositories/taskManagementRepository';
import { getTaskById } from '@/infrastructure/db/repositories/taskRepository';
import { mobileApiPost } from './mobileApiClient';

type MobileRecoveredDeviceSyncResponse = {
  ok: boolean;
  remoteId: string;
  syncedAt: string;
  idempotent?: boolean;
};

export async function syncRecoveredDeviceToRemote(
  recoveredDeviceId: string
): Promise<MobileRecoveredDeviceSyncResponse> {
  const device = await getRecoveredDeviceById(recoveredDeviceId);

  if (!device) {
    throw new Error(`RECOVERED_DEVICE_NOT_FOUND:${recoveredDeviceId}`);
  }

  const task = await getTaskById(device.taskId);

  if (!task) {
    throw new Error(`TASK_NOT_FOUND:${device.taskId}`);
  }

  if (!task.remoteId) {
    throw new Error(`TASK_REMOTE_ID_MISSING:${task.id}`);
  }

  if (!device.managementId) {
    throw new Error(`RECOVERED_DEVICE_MANAGEMENT_ID_MISSING:${device.id}`);
  }

  const management = await getTaskManagementById(device.managementId);

  if (!management) {
    throw new Error(`TASK_MANAGEMENT_NOT_FOUND:${device.managementId}`);
  }

  if (!management.remoteId) {
    throw new Error(`MANAGEMENT_REMOTE_ID_MISSING:${management.id}`);
  }

  const response = await mobileApiPost<MobileRecoveredDeviceSyncResponse>(
    '/api/mobile/recovered-devices',
    {
      localDeviceId: device.id,
      remoteTaskId: task.remoteId,
      managementId: management.remoteId,

      serialNumber: device.serialNumber,
      deviceType: device.deviceType,
      condition:
  device.condition && device.condition !== 'unknown'
    ? device.condition
    : undefined,

      hasCharger: device.hasCharger,
      hasRemoteControl: device.hasRemoteControl,
      hasPowerSupply: device.hasPowerSupply,
      hasNetworkCable: device.hasNetworkCable,
      hasOtherAccessory: device.hasOtherAccessory,
      otherAccessoryDetail: device.otherAccessoryDetail ?? null,

      deviceObservation: device.deviceObservation ?? null,
    } satisfies Record<string, unknown>
  );

  await markRecoveredDeviceAsSyncedWithRemoteId({
    id: device.id,
    remoteId: response.remoteId,
    remoteUpdatedAt: response.syncedAt,
  });

  return response;
}