// src/infrastructure/remote/mobileEvidenceSync.ts

import {
  getEvidenceById,
  markEvidenceAsUploaded,
} from '@/infrastructure/db/repositories/evidenceRepository';
import {
  getTaskManagementByGeneralEvidenceId,
  getTaskManagementById,
} from '@/infrastructure/db/repositories/taskManagementRepository';

import { getRecoveredDeviceBySeriesLabelEvidenceId } from '@/infrastructure/db/repositories/recoveredDeviceRepository';
import { getTaskById } from '@/infrastructure/db/repositories/taskRepository';
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

export async function syncEvidenceToRemote(
  evidenceId: string
): Promise<MobileEvidenceUploadResponse> {
  console.log('[EVIDENCE SYNC] iniciando:', evidenceId);

  const evidence = await getEvidenceById(evidenceId);

  if (!evidence) {
    throw new Error(`EVIDENCE_NOT_FOUND:${evidenceId}`);
  }

  console.log('[EVIDENCE SYNC] evidencia encontrada:', {
    id: evidence.id,
    taskId: evidence.taskId,
    evidenceType: evidence.evidenceType,
    localUri: evidence.localUri,
    fileName: evidence.fileName,
    mimeType: evidence.mimeType,
    uploadStatus: evidence.uploadStatus,
    syncStatus: evidence.syncStatus,
  });

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

  console.log('[EVIDENCE SYNC] management vinculada:', {
    evidenceId: evidence.id,
    managementId: management?.id,
    managementRemoteId: management?.remoteId,
    resultStatus: management?.resultStatus,
  });

  if (!management) {
  throw new Error(`EVIDENCE_MANAGEMENT_NOT_FOUND:${evidence.id}`);
}

if (!management.remoteId) {
  console.log('[EVIDENCE SYNC] gestión sin remoteId, sincronizando primero:', {
    managementId: management.id,
    evidenceId: evidence.id,
  });

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

  console.log('[EVIDENCE SYNC] enviando evidencia al panel:', {
    evidenceId: evidence.id,
    remoteTaskId: task.remoteId,
    managementRemoteId: managementRemoteId,
    localUri: evidence.localUri,
    evidenceType: evidence.evidenceType,
  });

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
  ...(recoveredDeviceLocalId
    ? { recoveredDeviceLocalId }
    : {}),
},
  });

  console.log('[EVIDENCE SYNC] evidencia subida OK:', response);

  await markEvidenceAsUploaded({
    evidenceId: evidence.id,
    remoteId: response.remoteId,
    remoteUrl: response.remoteUrl,
  });

  return response;
}