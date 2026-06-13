// src/infrastructure/gps/locationService.ts

import * as Location from 'expo-location';

export type CapturedLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  provider?: string;
  mocked: boolean;
  capturedAt: string;
};

export type LocationPermissionResult = {
  granted: boolean;
  canAskAgain: boolean;
  status: Location.PermissionStatus;
};

export async function requestForegroundLocationPermission(): Promise<LocationPermissionResult> {
  const result = await Location.requestForegroundPermissionsAsync();

  return {
    granted: result.granted,
    canAskAgain: result.canAskAgain,
    status: result.status,
  };
}

export async function getForegroundLocationPermission(): Promise<LocationPermissionResult> {
  const result = await Location.getForegroundPermissionsAsync();

  return {
    granted: result.granted,
    canAskAgain: result.canAskAgain,
    status: result.status,
  };
}

export async function ensureForegroundLocationPermission(): Promise<void> {
  const currentPermission = await getForegroundLocationPermission();

  if (currentPermission.granted) {
    return;
  }

  const requestedPermission = await requestForegroundLocationPermission();

  if (!requestedPermission.granted) {
    throw new Error('LOCATION_PERMISSION_DENIED');
  }
}

export async function captureCurrentLocation(): Promise<CapturedLocation> {
  await ensureForegroundLocationPermission();

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy ?? undefined,
    altitude: location.coords.altitude ?? undefined,
    speed: location.coords.speed ?? undefined,
    heading: location.coords.heading ?? undefined,
    provider: 'expo-location',
    mocked: location.mocked ?? false,
    capturedAt: new Date(location.timestamp).toISOString(),
  };
}

export function getLocationQualityLabel(accuracy?: number): 'good' | 'medium' | 'poor' | 'unknown' {
  if (typeof accuracy !== 'number') {
    return 'unknown';
  }

  if (accuracy <= 50) {
    return 'good';
  }

  if (accuracy <= 150) {
    return 'medium';
  }

  return 'poor';
}

export function shouldWarnAboutLowAccuracy(accuracy?: number): boolean {
  if (typeof accuracy !== 'number') {
    return true;
  }

  return accuracy > 100;
}

export function shouldRequireLocationRetry(accuracy?: number): boolean {
  if (typeof accuracy !== 'number') {
    return true;
  }

  return accuracy > 300;
}