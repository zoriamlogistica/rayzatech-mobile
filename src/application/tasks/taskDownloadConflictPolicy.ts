// src/application/tasks/taskDownloadConflictPolicy.ts

import type { Task } from '@/domain/tasks/task.types';

export type TaskDownloadDecision =
  | {
      action: 'insert';
      reason: 'LOCAL_TASK_NOT_FOUND';
    }
  | {
      action: 'update';
      reason: 'LOCAL_TASK_CLEAN';
    }
  | {
      action: 'skip_dirty';
      reason:
        | 'LOCAL_TASK_DIRTY'
        | 'LOCAL_TASK_PENDING_SYNC'
        | 'LOCAL_TASK_SYNC_FAILED'
        | 'LOCAL_TASK_CONFLICT'
        | 'LOCAL_TASK_LOCKED';
    };

export function decideTaskDownloadAction(
  localTask: Task | null
): TaskDownloadDecision {
  if (!localTask) {
    return {
      action: 'insert',
      reason: 'LOCAL_TASK_NOT_FOUND',
    };
  }

  if (localTask.isLocked) {
    return {
      action: 'skip_dirty',
      reason: 'LOCAL_TASK_LOCKED',
    };
  }

  if (localTask.isDirty) {
    return {
      action: 'skip_dirty',
      reason: 'LOCAL_TASK_DIRTY',
    };
  }

  if (localTask.syncStatus === 'pending_sync') {
    return {
      action: 'skip_dirty',
      reason: 'LOCAL_TASK_PENDING_SYNC',
    };
  }

  if (localTask.syncStatus === 'sync_failed') {
    return {
      action: 'skip_dirty',
      reason: 'LOCAL_TASK_SYNC_FAILED',
    };
  }

  if (localTask.syncStatus === 'conflict') {
    return {
      action: 'skip_dirty',
      reason: 'LOCAL_TASK_CONFLICT',
    };
  }

  return {
    action: 'update',
    reason: 'LOCAL_TASK_CLEAN',
  };
}