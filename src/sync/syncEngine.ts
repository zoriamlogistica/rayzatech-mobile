// src/sync/syncEngine.ts

import { appLogger } from '@/application/logging/appLogger.service';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import {
  clearSuccessfulSyncItems,
  countPendingSyncItems,
  listPendingSyncItems,
  markGpsPointSyncItemsAsSuccess,
  markSyncItemAsCancelled,
  markSyncItemAsFailed,
  markSyncItemAsSuccess,
  markSyncItemAsSyncing,
  releaseBlockedSyncItems,
  releaseWaitingRetrySyncItems,
} from '@/infrastructure/db/repositories/syncQueueRepository';
import { listRecentTaskManagements } from '@/infrastructure/db/repositories/taskManagementRepository';
import { syncEvidenceToRemote } from '@/infrastructure/remote/mobileEvidenceSync';
import { syncRecoveredDeviceToRemote } from '@/infrastructure/remote/mobileRecoveredDeviceSync';
import { syncTaskManagementToRemote } from '@/infrastructure/remote/mobileTaskManagementSync';
import { calculateNextAttemptAt, shouldStopRetrying } from './retryPolicy';
import { finalizeSyncedEntity } from './syncEntityFinalizer';

export type SyncEngineResult = {
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  finalized: number;
  remainingPending: number;
  details: Array<{
    id: string;
    entityType: string;
    entityId: string;
    operation: string;
    result: 'success' | 'failed' | 'skipped';
    message?: string;
    finalized?: boolean;
    finalizerMessage?: string;
  }>;
};

const WORKER_ID = 'local-dev-sync-worker';

let isSyncRunning = false;

export async function getPendingSyncCount(): Promise<number> {
  return countPendingSyncItems();
}

export async function getPendingSyncPreview(
  limit = 50
): Promise<SyncQueueItem[]> {
  return listPendingSyncItems(limit);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getErrorCode(message: string): string {
  if (message.includes(':')) {
    return message.split(':')[0] || 'SYNC_ERROR';
  }

  return message || 'SYNC_ERROR';
}

function shouldCancelStaleRemoteTaskSync(item: SyncQueueItem, message: string) {
  return (
    item.entityType === 'evidence' &&
    message.includes('MOBILE_API_ERROR:404:Task not found')
  );
}

async function syncOneItem(item: SyncQueueItem): Promise<void> {
  if (item.entityType === 'task_management') {
    await syncTaskManagementToRemote(item.entityId);
    return;
  }

  if (item.entityType === 'recovered_device') {
    await syncRecoveredDeviceToRemote(item.entityId);
    return;
  }

  if (item.entityType === 'evidence') {
    await syncEvidenceToRemote(item.entityId);
    return;
  }

  if (item.entityType === 'gps_point') {
    return;
  }

  throw new Error(`UNSUPPORTED_SYNC_ENTITY_TYPE:${item.entityType}`);
}

async function repairRecentManagementSync(limit = 50): Promise<{
  success: number;
  failed: number;
  details: SyncEngineResult['details'];
}> {
  const recentManagements = await listRecentTaskManagements(limit);
  let success = 0;
  let failed = 0;
  const details: SyncEngineResult['details'] = [];

  for (const management of recentManagements) {
    try {
      await syncTaskManagementToRemote(management.id);
      success += 1;
      details.push({
        id: `repair-${management.id}`,
        entityType: 'task_management',
        entityId: management.id,
        operation: 'REPAIR',
        result: 'success',
        message: 'Recent management synced during repair.',
        finalized: true,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      failed += 1;
      details.push({
        id: `repair-${management.id}`,
        entityType: 'task_management',
        entityId: management.id,
        operation: 'REPAIR',
        result: 'failed',
        message,
      });

      await appLogger.warn({
        scope: 'SYNC_ENGINE',
        message: 'Recent management repair sync failed.',
        payload: {
          managementId: management.id,
          error: message,
        },
      });
    }
  }

  return { success, failed, details };
}

export async function runDevSyncSimulation(params?: {
  limit?: number;
  forceFail?: boolean;
}): Promise<SyncEngineResult> {
  if (isSyncRunning) {
    const repairResult = await repairRecentManagementSync(50);

    if (repairResult.success > 0) {
      await appLogger.info({
        scope: 'SYNC_ENGINE',
        message: 'Recent management repair sync finished.',
        payload: {
          repairedManagements: repairResult.success,
        },
      });
    }

    const remainingPending = await countPendingSyncItems();

    await appLogger.warn({
      scope: 'SYNC_ENGINE',
      message: 'Sync skipped because another sync is already running.',
      payload: {
        remainingPending,
      },
    });

    return {
      processed: 0,
      success: 0,
      failed: repairResult.failed,
      skipped: 0,
      finalized: 0,
      remainingPending,
      details: [
        ...repairResult.details,
        {
          id: 'sync-lock',
          entityType: 'sync_engine',
          entityId: 'sync_engine',
          operation: 'LOCK',
          result: 'skipped',
          message: 'Sync already running',
        },
      ],
    };
  }

  isSyncRunning = true;

  const details: SyncEngineResult['details'] = [];

  let processed = 0;
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let finalized = 0;

  await appLogger.info({
    scope: 'SYNC_ENGINE',
    message: 'Starting DEV sync simulation.',
    payload: {
      limit: params?.limit ?? 25,
      forceFail: params?.forceFail ?? false,
      workerId: WORKER_ID,
    },
  });

  try {
    const clearedGpsItems = await markGpsPointSyncItemsAsSuccess();

    if (clearedGpsItems > 0) {
      await appLogger.info({
        scope: 'SYNC_ENGINE',
        message: 'GPS point sync items marked as success.',
        payload: {
          clearedGpsItems,
        },
      });
    }

    const releasedRetryItems = await releaseWaitingRetrySyncItems();

    if (releasedRetryItems > 0) {
      await appLogger.info({
        scope: 'SYNC_ENGINE',
        message: 'Waiting retry sync items released for manual sync.',
        payload: {
          releasedRetryItems,
        },
      });
    }

    const releasedBlockedItems = await releaseBlockedSyncItems();

    if (releasedBlockedItems > 0) {
      await appLogger.warn({
        scope: 'SYNC_ENGINE',
        message: 'Blocked sync items released for manual retry.',
        payload: {
          releasedBlockedItems,
        },
      });
    }

    const repairResult = await repairRecentManagementSync(50);

    if (repairResult.success > 0 || repairResult.failed > 0) {
      processed += repairResult.success + repairResult.failed;
      success += repairResult.success;
      failed += repairResult.failed;
      details.push(...repairResult.details);

      await appLogger.info({
        scope: 'SYNC_ENGINE',
        message: 'Recent management repair sync finished.',
        payload: {
          repairedManagements: repairResult.success,
          failedManagementRepairs: repairResult.failed,
        },
      });
    }

    const pendingItems = await listPendingSyncItems(params?.limit ?? 25);

    await appLogger.info({
      scope: 'SYNC_ENGINE',
      message: 'Pending sync items loaded.',
      payload: {
        count: pendingItems.length,
      },
    });

        for (const item of pendingItems) {
      processed += 1;

      if (
        shouldStopRetrying({
          attemptCount: item.attemptCount,
          maxAttempts: item.maxAttempts,
        })
      ) {
        skipped += 1;

        await appLogger.warn({
          scope: 'SYNC_ENGINE',
          message: 'Sync item skipped because max attempts reached.',
          payload: {
            id: item.id,
            entityType: item.entityType,
            entityId: item.entityId,
            operation: item.operation,
            attemptCount: item.attemptCount,
            maxAttempts: item.maxAttempts,
          },
        });

        details.push({
          id: item.id,
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          result: 'skipped',
          message: 'Max attempts reached',
        });

        continue;
      }

      await markSyncItemAsSyncing({
        id: item.id,
        workerId: WORKER_ID,
      });

      if (item.entityType === 'gps_point') {
  await markSyncItemAsSuccess(item.id);

  success += 1;

  details.push({
    id: item.id,
    entityType: item.entityType,
    entityId: item.entityId,
    operation: item.operation,
    result: 'success',
    message:
      'GPS point ignored because GPS data is already included in task management sync.',
    finalized: true,
    finalizerMessage: 'GPS point skipped as non-critical standalone entity.',
  });

  await appLogger.info({
    scope: 'SYNC_ENGINE',
    message: 'GPS point sync item ignored and marked as success.',
    payload: {
      id: item.id,
      entityType: item.entityType,
      entityId: item.entityId,
    },
  });

  continue;
}

      try {
        await appLogger.info({
          scope: 'SYNC_ENGINE',
          message: 'Sync item marked as syncing.',
          payload: {
            id: item.id,
            entityType: item.entityType,
            entityId: item.entityId,
            operation: item.operation,
          },
        });

        if (params?.forceFail) {
          throw new Error('DEV_SYNC_FORCED_FAILURE');
        }

        await syncOneItem(item);

        const finalization = await finalizeSyncedEntity(item);

        if (finalization.finalized) {
          finalized += 1;
        }

        await markSyncItemAsSuccess(item.id);

        success += 1;

        await appLogger.info({
          scope: 'SYNC_ENGINE',
          message: 'Sync item marked as success and entity finalized.',
          payload: {
            id: item.id,
            entityType: item.entityType,
            entityId: item.entityId,
            operation: item.operation,
            finalization,
          },
        });

        details.push({
          id: item.id,
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          result: 'success',
          message: 'Sync item completed successfully',
          finalized: finalization.finalized,
          finalizerMessage: finalization.message,
        });
      } catch (error) {
        const message = getErrorMessage(error);
        const errorCode = getErrorCode(message);

        if (shouldCancelStaleRemoteTaskSync(item, message)) {
          skipped += 1;

          await markSyncItemAsCancelled({
            id: item.id,
            error: message,
            errorCode,
          });

          await appLogger.warn({
            scope: 'SYNC_ENGINE',
            message: 'Stale sync item cancelled because the remote task no longer exists.',
            payload: {
              id: item.id,
              entityType: item.entityType,
              entityId: item.entityId,
              errorCode,
            },
          });

          details.push({
            id: item.id,
            entityType: item.entityType,
            entityId: item.entityId,
            operation: item.operation,
            result: 'skipped',
            message,
          });

          continue;
        }

        const nextAttemptAt = calculateNextAttemptAt(item.attemptCount);

        await markSyncItemAsFailed({
          id: item.id,
          error: message,
          errorCode,
          nextAttemptAt,
        });

        failed += 1;

        await appLogger.error({
          scope: 'SYNC_ENGINE',
          message: 'Sync item failed and was marked for retry.',
          payload: {
            id: item.id,
            entityType: item.entityType,
            entityId: item.entityId,
            operation: item.operation,
            errorCode,
            nextAttemptAt,
          },
          error,
        });

        details.push({
          id: item.id,
          entityType: item.entityType,
          entityId: item.entityId,
          operation: item.operation,
          result: 'failed',
          message,
        });
      }
    }

    const remainingPending = await countPendingSyncItems();

    const result: SyncEngineResult = {
      processed,
      success,
      failed,
      skipped,
      finalized,
      remainingPending,
      details,
    };

    await appLogger.info({
      scope: 'SYNC_ENGINE',
      message: 'DEV sync simulation finished.',
      payload: result,
    });

    return result;
  } finally {
    isSyncRunning = false;
  }
}

export async function clearDevSuccessfulSyncItems(): Promise<void> {
  await clearSuccessfulSyncItems();

  await appLogger.info({
    scope: 'SYNC_ENGINE',
    message: 'Successful sync items cleared from queue.',
  });
}
