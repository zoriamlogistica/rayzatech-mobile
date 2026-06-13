// src/infrastructure/storage/evidenceStorage.ts

import * as FileSystem from 'expo-file-system/legacy';

const ROOT_FOLDER = `${FileSystem.documentDirectory}rayzatech`;
const EVIDENCE_FOLDER = `${ROOT_FOLDER}/evidences`;

// Imagen PNG DEV visible.
// Sirve para validar miniaturas, visor y zoom.
// No representa una foto real.
const DEV_EVIDENCE_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAABJ0lEQVR42u2a3Q2DMAyEweoGZZOyWRmD0RiFIfpQqar4jZ1z4kjnJyQecl/wJY5J/3y/upZDusaDAAQgAAHqxuPsxTov0bQO08gUIkA5D9wmX5m4tSJTiAAEIAABsooXCaV+nRcthgScexVGUA+k7/0SMPVVlYs0rb4yAOTMJKHUG8peaVp9oFXIfOSQFo1bEwCr3ghgXj08WjViE2GQAjSuHeBfhIrBSb0aYDNkTkqgOh2SOXAKA9y4uSZWMbiqty+jiQwFOsSCSuK9Vj/jwjayC4Yy6gE7cbofnBqsgFJiz+BtXHwtdK3PtbkNK+ZqteCR1eghgzcYuJz+yh2m8ffQ0hfYTHmZpGJzlwAEIEDdSPrRHfDiB1OIAKjoefGVAAQgAAFy4gN0fHY7Nv8txgAAAABJRU5ErkJggg==';
export async function ensureEvidenceStorageReady(): Promise<void> {
  await ensureDirectory(ROOT_FOLDER);
  await ensureDirectory(EVIDENCE_FOLDER);
}

async function ensureDirectory(path: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(path);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, {
      intermediates: true,
    });
  }
}

export async function ensureTaskEvidenceFolder(taskId: string): Promise<string> {
  await ensureEvidenceStorageReady();

  const taskFolder = `${EVIDENCE_FOLDER}/${taskId}`;

  await ensureDirectory(taskFolder);

  return taskFolder;
}

export async function createFakeEvidenceFile(params: {
  taskId: string;
  evidenceId: string;
}): Promise<{
  localUri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}> {
  const folder = await ensureTaskEvidenceFolder(params.taskId);

  const fileName = `${params.evidenceId}.png`;
  const localUri = `${folder}/${fileName}`;

  await FileSystem.writeAsStringAsync(localUri, DEV_EVIDENCE_IMAGE_BASE64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const info = await FileSystem.getInfoAsync(localUri);

return {
  localUri,
  fileName,
  mimeType: 'image/png',
  sizeBytes: info.exists && typeof info.size === 'number' ? info.size : 0,
};
}

export async function fileExists(localUri: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(localUri);
  return info.exists;
}

export async function copyEvidenceFileToTaskFolder(params: {
  taskId: string;
  evidenceId: string;
  sourceUri: string;
  extension?: string;
}): Promise<{
  localUri: string;
  fileName: string;
  sizeBytes: number;
}> {
  const folder = await ensureTaskEvidenceFolder(params.taskId);

  const extension = params.extension ?? 'jpg';
  const fileName = `${params.evidenceId}.${extension}`;
  const localUri = `${folder}/${fileName}`;

  try {
  await FileSystem.copyAsync({
    from: params.sourceUri,
    to: localUri,
  });
} catch (error) {
  throw new Error(
    `EVIDENCE_COPY_FAILED:${error instanceof Error ? error.message : String(error)}`
  );
}

  const info = await FileSystem.getInfoAsync(localUri);

  return {
    localUri,
    fileName,
    sizeBytes: info.exists && typeof info.size === 'number' ? info.size : 0,
  };
}

export async function deleteLocalEvidenceFile(localUri: string): Promise<void> {
  const exists = await fileExists(localUri);

  if (!exists) {
    return;
  }

  await FileSystem.deleteAsync(localUri, {
    idempotent: true,
  });
}