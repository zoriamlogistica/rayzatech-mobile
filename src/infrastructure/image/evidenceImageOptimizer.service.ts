// src/infrastructure/image/evidenceImageOptimizer.service.ts

import * as ImageManipulator from 'expo-image-manipulator';

export type OptimizedEvidenceImage = {
  localUri: string;
  fileNameExtension: 'jpg' | 'webp';
  mimeType: 'image/jpeg' | 'image/webp';
  width?: number;
  height?: number;
};

const MAX_IMAGE_WIDTH = 1280;
const IMAGE_QUALITY = 0.7;

function getResizeAction(width?: number) {
  if (!width || width <= MAX_IMAGE_WIDTH) {
    return [];
  }

  return [
    {
      resize: {
        width: MAX_IMAGE_WIDTH,
      },
    },
  ];
}

export async function optimizeEvidenceImage(params: {
  sourceUri: string;
  width?: number;
  preferWebp?: boolean;
}): Promise<OptimizedEvidenceImage> {
  const preferWebp = params.preferWebp ?? true;

  const format = preferWebp
    ? ImageManipulator.SaveFormat.WEBP
    : ImageManipulator.SaveFormat.JPEG;

  try {
  const result = await ImageManipulator.manipulateAsync(
    params.sourceUri,
    getResizeAction(params.width),
    {
      compress: IMAGE_QUALITY,
      format,
    }
  );

  return {
    localUri: result.uri,
    fileNameExtension: preferWebp ? 'webp' : 'jpg',
    mimeType: preferWebp ? 'image/webp' : 'image/jpeg',
    width: result.width,
    height: result.height,
  };
} catch (error) {
  throw new Error(
    `IMAGE_OPTIMIZATION_FAILED:${
      error instanceof Error ? error.message : String(error)
    }`
  );
}
}