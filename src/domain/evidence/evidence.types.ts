// src/domain/evidence/evidence.types.ts

import type { SyncStatus } from '../tasks/task.types';

export type EvidenceType =
  | 'customer_document'
  | 'customer_with_equipment'
  | 'equipment_serial'
  | 'house_front'
  | 'recovery_proof'
  | 'failed_visit'
  | 'other';

export type UploadStatus =
  | 'local_only'
  | 'queued'
  | 'uploading'
  | 'uploaded'
  | 'upload_failed'
  | 'linked_to_task';

export type Evidence = {
  id: string;

  taskId: string;
  taskEventId?: string;
  remoteId?: string;

  evidenceType: EvidenceType;

  localUri: string;
  remoteUrl?: string;

  fileName?: string;
  mimeType: string;
  sizeBytes?: number;
  checksum?: string;

  latitude?: number;
  longitude?: number;
  accuracy?: number;

  capturedAt: string;
  uploadedAt?: string;

  uploadStatus: UploadStatus;
  syncStatus: SyncStatus;

  createdAt: string;
  updatedAt: string;
};