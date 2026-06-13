// src/infrastructure/camera/evidenceCamera.service.ts

import * as ImagePicker from 'expo-image-picker';

export type EvidenceCameraResult = {
  localUri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
};

function makeEvidenceFileName(prefix: string): string {
  return `${prefix}_${Date.now()}.jpg`;
}

export async function requestEvidenceCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();

  if (current.granted) {
    return true;
  }

  const requested = await ImagePicker.requestCameraPermissionsAsync();

  return requested.granted;
}

export async function captureEvidencePhoto(params?: {
  fileNamePrefix?: string;
}): Promise<EvidenceCameraResult | null> {
  const hasPermission = await requestEvidenceCameraPermission();

  if (!hasPermission) {
    throw new Error('CAMERA_PERMISSION_DENIED');
  }

  let result: ImagePicker.ImagePickerResult;

try {
  result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.75,
    exif: false,
  });
} catch (error) {
  throw new Error(
    `CAMERA_UNAVAILABLE:${error instanceof Error ? error.message : String(error)}`
  );
}

if (result.canceled) {
  return null;
}

if (result.assets.length === 0) {
  throw new Error('IMAGE_CAPTURE_FAILED:NO_ASSETS_RETURNED');
}

  const asset = result.assets[0];
  const fileName =
    asset.fileName ?? makeEvidenceFileName(params?.fileNamePrefix ?? 'evidence');

  return {
    localUri: asset.uri,
    fileName,
    mimeType: asset.mimeType ?? 'image/jpeg',
    sizeBytes: asset.fileSize ?? 0,
    width: asset.width,
    height: asset.height,
  };
}