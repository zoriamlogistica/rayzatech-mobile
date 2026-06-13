// src/infrastructure/upload/evidenceUploadService.ts

import { appLogger } from '@/application/logging/appLogger.service';
import type { Evidence } from '@/domain/evidence/evidence.types';

import {
  listPendingEvidenceUploads,
  markEvidenceAsQueued,
  markEvidenceAsUploaded,
  markEvidenceAsUploading,
  markEvidenceUploadAsFailed,
} from '@/infrastructure/db/repositories/evidenceRepository';
import { fileExists } from '@/infrastructure/storage/evidenceStorage';

export type EvidenceUploadResult = {
  evidenceId: string;
  taskId: string;
  status: 'uploaded' | 'failed' | 'skipped';
  remoteUrl?: string;
  error?: string;
};

export type EvidenceUploadBatchResult = {
  processed: number;
  uploaded: number;
  failed: number;
  skipped: number;
  details: EvidenceUploadResult[];
};

function createDevRemoteUrl(evidence: Evidence): string {
  const safeFileName = evidence.fileName ?? `${evidence.id}.jpg`;

  return `dev://rayzatech/evidences/${evidence.taskId}/${safeFileName}`;
}

async function uploadEvidenceDevSimulation(
  evidence: Evidence
): Promise<EvidenceUploadResult> {
  await appLogger.info({
    scope: 'EVIDENCE_UPLOAD',
    message: 'Starting DEV evidence upload.',
    taskId: evidence.taskId,
    payload: {
      evidenceId: evidence.id,
      localUri: evidence.localUri,
      uploadStatus: evidence.uploadStatus,
    },
  });

  const exists = await fileExists(evidence.localUri);

  if (!exists) {
    await markEvidenceUploadAsFailed({
      evidenceId: evidence.id,
    });

    await appLogger.error({
      scope: 'EVIDENCE_UPLOAD',
      message: 'Evidence local file not found.',
      taskId: evidence.taskId,
      payload: {
        evidenceId: evidence.id,
        localUri: evidence.localUri,
      },
      error: new Error('LOCAL_FILE_NOT_FOUND'),
    });

    return {
      evidenceId: evidence.id,
      taskId: evidence.taskId,
      status: 'failed',
      error: 'LOCAL_FILE_NOT_FOUND',
    };
  }

  await markEvidenceAsUploading(evidence.id);

  await appLogger.info({
    scope: 'EVIDENCE_UPLOAD',
    message: 'Evidence marked as uploading.',
    taskId: evidence.taskId,
    payload: {
      evidenceId: evidence.id,
      localUri: evidence.localUri,
    },
  });

  const remoteUrl = createDevRemoteUrl(evidence);

  await markEvidenceAsUploaded({
    evidenceId: evidence.id,
    remoteUrl,
    remoteId: `remote_${evidence.id}`,
  });

  await appLogger.info({
    scope: 'EVIDENCE_UPLOAD',
    message: 'Evidence uploaded successfully in DEV simulation.',
    taskId: evidence.taskId,
    payload: {
      evidenceId: evidence.id,
      remoteUrl,
    },
  });

  return {
    evidenceId: evidence.id,
    taskId: evidence.taskId,
    status: 'uploaded',
    remoteUrl,
  };
}

export async function uploadPendingEvidencesDev(params?: {
  limit?: number;
}): Promise<EvidenceUploadBatchResult> {
  const pendingEvidences = await listPendingEvidenceUploads();
  const limit = params?.limit ?? 25;

  const selected = pendingEvidences.slice(0, limit);

  await appLogger.info({
    scope: 'EVIDENCE_UPLOAD',
    message: 'Starting pending evidence upload batch.',
    payload: {
      pendingTotal: pendingEvidences.length,
      selectedTotal: selected.length,
      limit,
    },
  });

  const details: EvidenceUploadResult[] = [];

  let uploaded = 0;
  let failed = 0;
  let skipped = 0;

  for (const evidence of selected) {
    try {
      await markEvidenceAsQueued(evidence.id);

      const result = await uploadEvidenceDevSimulation(evidence);

      details.push(result);

      if (result.status === 'uploaded') {
        uploaded += 1;
      } else if (result.status === 'failed') {
        failed += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await markEvidenceUploadAsFailed({
        evidenceId: evidence.id,
      });

      await appLogger.error({
        scope: 'EVIDENCE_UPLOAD',
        message: 'Evidence upload failed unexpectedly.',
        taskId: evidence.taskId,
        error,
        payload: {
          evidenceId: evidence.id,
          localUri: evidence.localUri,
        },
      });

      failed += 1;

      details.push({
        evidenceId: evidence.id,
        taskId: evidence.taskId,
        status: 'failed',
        error: message,
      });
    }
  }

  const result: EvidenceUploadBatchResult = {
    processed: selected.length,
    uploaded,
    failed,
    skipped,
    details,
  };

  await appLogger.info({
    scope: 'EVIDENCE_UPLOAD',
    message: 'Pending evidence upload batch finished.',
    payload: result,
  });

  return result;
}