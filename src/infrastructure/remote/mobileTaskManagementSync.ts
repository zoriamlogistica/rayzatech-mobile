// src/infrastructure/remote/mobileTaskManagementSync.ts


import {
  getTaskManagementById,
  markTaskManagementAsSyncedWithRemoteId,
} from '@/infrastructure/db/repositories/taskManagementRepository';
import { getTaskById } from '@/infrastructure/db/repositories/taskRepository';
import { mobileApiPost } from './mobileApiClient';

type MobileTaskManagementSyncResponse = {
  ok: boolean;
  remoteId: string;
  taskId: string;
  finalStatus: string;
  syncedAt: string;
  idempotent?: boolean;
};

export async function syncTaskManagementToRemote(
  managementId: string
): Promise<MobileTaskManagementSyncResponse> {
  const management = await getTaskManagementById(managementId);

  if (!management) {
    throw new Error(`TASK_MANAGEMENT_NOT_FOUND:${managementId}`);
  }

  const task = await getTaskById(management.taskId);

  if (!task) {
    throw new Error(`TASK_NOT_FOUND:${management.taskId}`);
  }

  if (!task.remoteId) {
    throw new Error(`TASK_REMOTE_ID_MISSING:${management.taskId}`);
  }

console.log('[MANAGEMENT SYNC DEBUG] enviando gestión:', {
  localId: management.id,
  remoteId: management.remoteId,
  taskId: management.taskId,
  remoteTaskId: task.remoteId,
  resultStatus: management.resultStatus,
  managedAt: management.managedAt,
  generalEvidenceId: management.generalEvidenceId,
});

  const response = await mobileApiPost<MobileTaskManagementSyncResponse>(
  '/api/mobile/task-managements',
  {
    localId: management.id,
    remoteTaskId: task.remoteId,
    resultStatus: management.resultStatus,
    reason: management.reason ?? null,
    observation: management.observation ?? null,
    latitude: management.latitude ?? null,
    longitude: management.longitude ?? null,
    accuracy: management.accuracy ?? null,
    mocked: management.mocked ?? false,
    rescheduleDate: management.rescheduleDate ?? null,
    rescheduleTimeRange: management.rescheduleTimeRange ?? null,
    managedAt: management.managedAt,
  } satisfies Record<string, unknown>
);

await markTaskManagementAsSyncedWithRemoteId({
  id: management.id,
  remoteId: response.remoteId,
  remoteUpdatedAt: response.syncedAt,
});

return response;
}