// src/domain/tasks/task.types.ts

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'unsuccessful'
  | 'rescheduled'
  | 'cancelled';

export type SyncStatus =
  | 'synced'
  | 'pending_sync'
  | 'syncing'
  | 'sync_failed'
  | 'conflict';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type Task = {
  id: string;
  remoteId?: string;

  taskNumber?: string;
  orderCode?: string;
  project?: string;
  sot?: string;
  routeNumber?: string;
  guideNumber?: string;
  fieldOperationType?: 'inverse' | 'last_mile';
  lastMileTaskType?: 'delivery' | 'pickup';
  serviceArea?: string;
  contactData?: string;
  packageCount?: number;
  deliveryInstructions?: string;
  merchandiseCondition?: string;
  liquidationStatus?: 'none' | 'pending' | 'partial' | 'liquidated';
  hasPendingLiquidation?: boolean;

  assignedUserId?: string;

  customerName?: string;
  customerDocument?: string;
  customerPhone?: string;
  customerEmail?: string;

  department?: string;
  province?: string;
  district?: string;
  address?: string;
  reference?: string;

  latitude?: number;
  longitude?: number;

  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  timeRange?: string;

  taskType?: string;
  priority: TaskPriority;

  status: TaskStatus;
  previousStatus?: TaskStatus;

  observations?: string;
  operatorNotes?: string;
  internalNotes?: string;

  version: number;
  remoteUpdatedAt?: string;
  localUpdatedAt: string;

  syncStatus: SyncStatus;
  isDirty: boolean;
  isLocked: boolean;
  lockReason?: string;

  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};
