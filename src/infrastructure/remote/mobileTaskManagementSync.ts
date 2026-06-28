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

function getObservationValue(
  observation: string | undefined,
  label: string
): string | null {
  if (!observation) {
    return null;
  }

  const prefix = `${label}:`;
  const line = observation
    .split('\n')
    .find((item) => item.trim().toLowerCase().startsWith(prefix.toLowerCase()));

  if (!line) {
    return null;
  }

  const value = line.slice(prefix.length).trim();
  return value || null;
}

function buildLastMilePayload(
  task: Awaited<ReturnType<typeof getTaskById>>,
  management: Awaited<ReturnType<typeof getTaskManagementById>>
) {
  if (!task || !management || task.fieldOperationType !== 'last_mile') {
    return {};
  }

  const observation = management.observation;
  const lastMileResult = getObservationValue(
    observation,
    'Resultado ultima milla'
  );
  const lastMileSubstatus =
    getObservationValue(observation, 'Subestado') ?? management.reason ?? null;
  const merchandiseCondition = getObservationValue(
    observation,
    'Condicion mercaderia'
  );
  const packageCountText = getObservationValue(
    observation,
    'Cantidad bultos/items gestionados'
  );
  const operationNumber = getObservationValue(observation, 'Numero operacion');
  const isPickup =
    task.lastMileTaskType === 'pickup' || task.taskType === 'last_mile_pickup';
  const requiresLiquidation =
    (isPickup && management.resultStatus === 'successful') ||
    normalizeForCompare(merchandiseCondition) === 'items sobrantes';

  return {
    lastMileResult,
    lastMileSubstatus,
    merchandiseCondition,
    packageCount: packageCountText ? Number(packageCountText) || null : null,
    operationNumber,
    requiresLiquidation,
  };
}

function normalizeForCompare(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

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

  const response = await mobileApiPost<MobileTaskManagementSyncResponse>(
    '/api/mobile/task-managements',
    {
      localId: management.id,
      localTaskId: task.id,
      remoteTaskId: task.remoteId,
      taskNumber: task.taskNumber ?? null,
      routeNumber: task.routeNumber ?? null,
      scheduledDate: task.scheduledDate ?? null,
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
      ...buildLastMilePayload(task, management),
    } satisfies Record<string, unknown>
  );

  await markTaskManagementAsSyncedWithRemoteId({
    id: management.id,
    remoteId: response.remoteId,
    remoteUpdatedAt: response.syncedAt,
  });

  return response;
}
