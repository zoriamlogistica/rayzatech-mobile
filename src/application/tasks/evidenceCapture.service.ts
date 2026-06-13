// src/application/tasks/evidenceCapture.service.ts

import type { Evidence } from '@/domain/evidence/evidence.types';
import type { SyncQueueItem } from '@/domain/sync/sync.types';

import { captureEvidencePhoto } from '@/infrastructure/camera/evidenceCamera.service';
import { insertEvidence } from '@/infrastructure/db/repositories/evidenceRepository';
import { enqueueSyncItem } from '@/infrastructure/db/repositories/syncQueueRepository';
import { optimizeEvidenceImage } from '@/infrastructure/image/evidenceImageOptimizer.service';
import { copyEvidenceFileToTaskFolder } from '@/infrastructure/storage/evidenceStorage';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function getFileExtensionFromMimeType(mimeType: string): string {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

async function enqueueEvidenceUpload(params: {
  evidence: Evidence;
}): Promise<SyncQueueItem> {
  const now = nowIso();

  const item: SyncQueueItem = {
    id: makeId('sync'),
    entityType: 'evidence',
    entityId: params.evidence.id,
    operation: 'UPLOAD',
    payload: {
      evidenceId: params.evidence.id,
      taskId: params.evidence.taskId,
      localUri: params.evidence.localUri,
      evidenceType: params.evidence.evidenceType,
      fileName: params.evidence.fileName,
      mimeType: params.evidence.mimeType,
      sizeBytes: params.evidence.sizeBytes,
    },
    status: 'pending',
    priority: 3,
    attemptCount: 0,
    maxAttempts: 10,
    createdAt: now,
    updatedAt: now,
  };

  await enqueueSyncItem(item);

  return item;
}

export async function captureRealEvidenceForTaskOffline(params: {
  taskId: string;
  evidenceType: Evidence['evidenceType'];
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}): Promise<{
  evidence: Evidence;
  syncItem: SyncQueueItem;
} | null> {
  const capturedPhoto = await captureEvidencePhoto({
    fileNamePrefix: params.evidenceType,
  });

  if (!capturedPhoto) {
    return null;
  }

  const now = nowIso();
const evidenceId = makeId('evidence');

const optimizedPhoto = await optimizeEvidenceImage({
  sourceUri: capturedPhoto.localUri,
  width: capturedPhoto.width,
  preferWebp: true,
});

const copiedFile = await copyEvidenceFileToTaskFolder({
  taskId: params.taskId,
  evidenceId,
  sourceUri: optimizedPhoto.localUri,
  extension: optimizedPhoto.fileNameExtension,
});

  const evidence: Evidence = {
    id: evidenceId,
    taskId: params.taskId,
    evidenceType: params.evidenceType,
    localUri: copiedFile.localUri,
    fileName: copiedFile.fileName,
    mimeType: optimizedPhoto.mimeType,
    sizeBytes: copiedFile.sizeBytes,
    latitude: params.latitude,
    longitude: params.longitude,
    accuracy: params.accuracy,
    capturedAt: now,
    uploadStatus: 'local_only',
    syncStatus: 'pending_sync',
    createdAt: now,
    updatedAt: now,
  };

  await insertEvidence(evidence);

  const syncItem = await enqueueEvidenceUpload({
    evidence,
  });

  return {
    evidence,
    syncItem,
  };
}