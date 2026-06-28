// src/infrastructure/remote/mobileEvidenceSync.ts

import {
  getEvidenceById,
  markEvidenceAsUploaded,
} from '@/infrastructure/db/repositories/evidenceRepository';
import { getRecoveredDeviceBySeriesLabelEvidenceId } from '@/infrastructure/db/repositories/recoveredDeviceRepository';
import { getTaskById } from '@/infrastructure/db/repositories/taskRepository';
import {
  getTaskManagementByGeneralEvidenceId,
  getTaskManagementById,
  listTaskManagementsByTask,
} from '@/infrastructure/db/repositories/taskManagementRepository';
import { mobileApiUploadFile } from './mobileApiClient';
import { syncTaskManagementToRemote } from './mobileTaskManagementSync';

type MobileEvidenceUploadResponse = {
  ok: boolean;
  remoteId: string;
  remoteUrl: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  idempotent?: boolean;
};

function getFallbackFileName(evidenceId: string): string {
  return `${evidenceId}.webp`;
}

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

function managementContainsEvidenceId(
  management: Awaited<ReturnType<typeof getTaskManagementById>>,
  evidenceId: string
) {
  const ids =
    getObservationValue(management?.observation, 'Evidencias gestion')
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean) || [];

  return ids.includes(evidenceId);
}

export async function syncEvidenceToRemote(
  evidenceId: string
): Promise<MobileEvidenceUploadResponse> {
  const evidence = await getEvidenceById(evidenceId);

  if (!evidence) {
    throw new Error(`EVIDENCE_NOT_FOUND:${evidenceId}`);
  }

  const task = await getTaskById(evidence.taskId);

  if (!task) {
    throw new Error(`TASK_NOT_FOUND:${evidence.taskId}`);
  }

  if (!task.remoteId) {
    throw new Error(`TASK_REMOTE_ID_MISSING:${task.id}`);
  }

  let recoveredDeviceLocalId: string | null = null;
  let management = await getTaskManagementByGeneralEvidenceId(evidence.id);

  if (!management) {
    const recoveredDevice = await getRecoveredDeviceBySeriesLabelEvidenceId(
      evidence.id
    );

    if (recoveredDevice) {
      recoveredDeviceLocalId = recoveredDevice.id;

      if (!recoveredDevice.managementId) {
        throw new Error(
          `RECOVERED_DEVICE_MANAGEMENT_ID_MISSING:${recoveredDevice.id}`
        );
      }

      management = await getTaskManagementById(recoveredDevice.managementId);
    }
  }

  if (!management && task.fieldOperationType === 'last_mile') {
    const managements = await listTaskManagementsByTask(evidence.taskId);
    management =
      managements.find((item) => managementContainsEvidenceId(item, evidence.id)) ??
      managements[0] ??
      null;
  }

  if (!management) {
    throw new Error(`EVIDENCE_MANAGEMENT_NOT_FOUND:${evidence.id}`);
  }

  if (!management.remoteId) {
    await syncTaskManagementToRemote(management.id);

    const refreshedManagement = await getTaskManagementById(management.id);

    if (!refreshedManagement?.remoteId) {
      throw new Error(`MANAGEMENT_REMOTE_ID_MISSING_AFTER_SYNC:${management.id}`);
    }

    management = refreshedManagement;
  }

  const managementRemoteId = management.remoteId;

  if (!managementRemoteId) {
    throw new Error(`MANAGEMENT_REMOTE_ID_MISSING:${management.id}`);
  }

  const response = await mobileApiUploadFile<MobileEvidenceUploadResponse>({
    path: '/api/mobile/evidences',
    fileUri: evidence.localUri,
    fieldName: 'file',
    mimeType: evidence.mimeType || 'image/webp',
    parameters: {
      remoteTaskId: task.remoteId,
      managementId: managementRemoteId,
      localEvidenceId: evidence.id,
      evidenceType: evidence.evidenceType,
      fileName: evidence.fileName ?? getFallbackFileName(evidence.id),
      ...(recoveredDeviceLocalId ? { recoveredDeviceLocalId } : {}),
    },
  });

  await markEvidenceAsUploaded({
    evidenceId: evidence.id,
    remoteId: response.remoteId,
    remoteUrl: response.remoteUrl,
  });

  return response;
}
