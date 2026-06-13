// src/infrastructure/db/repositories/evidenceRepository.ts

import type {
    Evidence,
    EvidenceType,
    UploadStatus,
} from '@/domain/evidence/evidence.types';
import type { SyncStatus } from '@/domain/tasks/task.types';
import { getDatabase } from '../database';

type EvidenceRow = {
  id: string;
  task_id: string;
  task_event_id: string | null;
  remote_id: string | null;

  evidence_type: EvidenceType;
  local_uri: string;
  remote_url: string | null;

  file_name: string | null;
  mime_type: string;
  size_bytes: number | null;
  checksum: string | null;

  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;

  captured_at: string;
  uploaded_at: string | null;

  upload_status: UploadStatus;
  sync_status: SyncStatus;

  created_at: string;
  updated_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function mapRowToEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id,

    taskId: row.task_id,
    taskEventId: row.task_event_id ?? undefined,
    remoteId: row.remote_id ?? undefined,

    evidenceType: row.evidence_type,

    localUri: row.local_uri,
    remoteUrl: row.remote_url ?? undefined,

    fileName: row.file_name ?? undefined,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes ?? undefined,
    checksum: row.checksum ?? undefined,

    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    accuracy: row.accuracy ?? undefined,

    capturedAt: row.captured_at,
    uploadedAt: row.uploaded_at ?? undefined,

    uploadStatus: row.upload_status,
    syncStatus: row.sync_status,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertEvidence(evidence: Evidence): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO evidences (
        id,
        task_id,
        task_event_id,
        remote_id,
        evidence_type,
        local_uri,
        remote_url,
        file_name,
        mime_type,
        size_bytes,
        checksum,
        latitude,
        longitude,
        accuracy,
        captured_at,
        uploaded_at,
        upload_status,
        sync_status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      evidence.id,
      evidence.taskId,
      evidence.taskEventId ?? null,
      evidence.remoteId ?? null,
      evidence.evidenceType,
      evidence.localUri,
      evidence.remoteUrl ?? null,
      evidence.fileName ?? null,
      evidence.mimeType,
      evidence.sizeBytes ?? null,
      evidence.checksum ?? null,
      evidence.latitude ?? null,
      evidence.longitude ?? null,
      evidence.accuracy ?? null,
      evidence.capturedAt,
      evidence.uploadedAt ?? null,
      evidence.uploadStatus,
      evidence.syncStatus,
      evidence.createdAt,
      evidence.updatedAt,
    ]
  );
}

export async function getEvidenceById(id: string): Promise<Evidence | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<EvidenceRow>(
    `
      SELECT *
      FROM evidences
      WHERE id = ?
      LIMIT 1;
    `,
    [id]
  );

  return row ? mapRowToEvidence(row) : null;
}

export async function listEvidencesByTask(taskId: string): Promise<Evidence[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<EvidenceRow>(
    `
      SELECT *
      FROM evidences
      WHERE task_id = ?
      ORDER BY captured_at ASC;
    `,
    [taskId]
  );

  return rows.map(mapRowToEvidence);
}

export async function listPendingEvidenceUploads(): Promise<Evidence[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<EvidenceRow>(
    `
      SELECT *
      FROM evidences
      WHERE upload_status IN ('local_only', 'queued', 'upload_failed')
      ORDER BY captured_at ASC;
    `
  );

  return rows.map(mapRowToEvidence);
}

export async function markEvidenceAsQueued(evidenceId: string): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE evidences
      SET
        upload_status = 'queued',
        sync_status = 'pending_sync',
        updated_at = ?
      WHERE id = ?;
    `,
    [now, evidenceId]
  );
}

export async function markEvidenceAsUploading(evidenceId: string): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE evidences
      SET
        upload_status = 'uploading',
        updated_at = ?
      WHERE id = ?;
    `,
    [now, evidenceId]
  );
}

export async function markEvidenceAsUploaded(params: {
  evidenceId: string;
  remoteUrl: string;
  remoteId?: string;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE evidences
      SET
        remote_id = COALESCE(?, remote_id),
        remote_url = ?,
        upload_status = 'uploaded',
        sync_status = 'pending_sync',
        uploaded_at = ?,
        updated_at = ?
      WHERE id = ?;
    `,
    [
      params.remoteId ?? null,
      params.remoteUrl,
      now,
      now,
      params.evidenceId,
    ]
  );
}

export async function markEvidenceAsLinkedToTask(
  evidenceId: string
): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE evidences
      SET
        upload_status = 'linked_to_task',
        sync_status = 'synced',
        updated_at = ?
      WHERE id = ?;
    `,
    [now, evidenceId]
  );
}

export async function markEvidenceUploadAsFailed(params: {
  evidenceId: string;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE evidences
      SET
        upload_status = 'upload_failed',
        sync_status = 'sync_failed',
        updated_at = ?
      WHERE id = ?;
    `,
    [now, params.evidenceId]
  );
}

export async function countEvidencesByTask(taskId: string): Promise<{
  total: number;
  uploaded: number;
  pendingUpload: number;
}> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{
    total: number;
    uploaded: number;
    pendingUpload: number;
  }>(
    `
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN upload_status IN ('uploaded', 'linked_to_task') THEN 1 ELSE 0 END) as uploaded,
        SUM(CASE WHEN upload_status IN ('local_only', 'queued', 'upload_failed') THEN 1 ELSE 0 END) as pendingUpload
      FROM evidences
      WHERE task_id = ?;
    `,
    [taskId]
  );

  return {
    total: row?.total ?? 0,
    uploaded: row?.uploaded ?? 0,
    pendingUpload: row?.pendingUpload ?? 0,
  };
}