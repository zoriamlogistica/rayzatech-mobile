// src/domain/tasks/taskOperationalRules.ts

import type { Task } from './task.types';

export type TaskOperationalValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type TaskCompletionValidationInput = {
  task: Task | null;
  recoveredDeviceCounters: {
    total: number;
    withPhoto: number;
    missingPhoto: number;
    dirty: number;
    pendingSync: number;
  };
  gpsCounters: {
    total: number;
    pendingSync: number;
    mocked: number;
  };
  evidenceCounters: {
    total: number;
    uploaded: number;
    pendingUpload: number;
  };
};

export function canStartTask(task: Task | null): TaskOperationalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!task) {
    errors.push('TASK_NOT_FOUND');
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  if (task.isLocked) {
    errors.push(`TASK_LOCKED:${task.lockReason ?? 'NO_REASON'}`);
  }

  if (task.status !== 'pending') {
    errors.push(`INVALID_STATUS_TO_START:${task.status}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function canCompleteTask(
  input: TaskCompletionValidationInput
): TaskOperationalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { task, recoveredDeviceCounters, gpsCounters, evidenceCounters } = input;

  if (!task) {
    errors.push('TASK_NOT_FOUND');
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  if (task.isLocked) {
    errors.push(`TASK_LOCKED:${task.lockReason ?? 'NO_REASON'}`);
  }

  if (task.status !== 'in_progress') {
    errors.push(`INVALID_STATUS_TO_COMPLETE:${task.status}`);
  }

  if (recoveredDeviceCounters.total <= 0) {
    errors.push('RECOVERED_DEVICE_REQUIRED');
  }

  if (recoveredDeviceCounters.total > 10) {
    errors.push(`RECOVERED_DEVICE_LIMIT_EXCEEDED:${recoveredDeviceCounters.total}`);
  }

  if (recoveredDeviceCounters.missingPhoto > 0) {
    errors.push(`RECOVERED_DEVICE_PHOTO_REQUIRED:${recoveredDeviceCounters.missingPhoto}`);
  }

  if (gpsCounters.total <= 0) {
    errors.push('GPS_REQUIRED');
  }

  if (gpsCounters.mocked > 0) {
    warnings.push(`MOCKED_GPS_DETECTED:${gpsCounters.mocked}`);
  }

  if (evidenceCounters.total <= 0) {
    errors.push('EVIDENCE_REQUIRED');
  }

  if (evidenceCounters.pendingUpload > 0) {
    warnings.push(`EVIDENCE_PENDING_UPLOAD:${evidenceCounters.pendingUpload}`);
  }

  if (recoveredDeviceCounters.pendingSync > 0) {
    warnings.push(`RECOVERED_DEVICES_PENDING_SYNC:${recoveredDeviceCounters.pendingSync}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function canMarkTaskUnsuccessful(task: Task | null): TaskOperationalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!task) {
    errors.push('TASK_NOT_FOUND');
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  if (task.isLocked) {
    errors.push(`TASK_LOCKED:${task.lockReason ?? 'NO_REASON'}`);
  }

  if (task.status !== 'pending' && task.status !== 'in_progress') {
    errors.push(`INVALID_STATUS_TO_MARK_UNSUCCESSFUL:${task.status}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function canRecoverSeries(params: {
  task: Task | null;
  seriesId: string;
}): TaskOperationalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!params.task) {
    errors.push('TASK_NOT_FOUND');
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  if (params.task.isLocked) {
    errors.push(`TASK_LOCKED:${params.task.lockReason ?? 'NO_REASON'}`);
  }

  if (
    params.task.status !== 'pending' &&
    params.task.status !== 'in_progress'
  ) {
    errors.push(`INVALID_STATUS_TO_RECOVER_SERIES:${params.task.status}`);
  }

  if (!params.seriesId) {
    errors.push('SERIES_ID_REQUIRED');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function assertOperationalValidation(
  result: TaskOperationalValidationResult
): void {
  if (result.valid) {
    return;
  }

  throw new Error(`OPERATIONAL_RULE_FAILED:${result.errors.join('|')}`);
}