// src/infrastructure/remote/remoteTask.types.ts

export type RemoteTaskSeriesDto = {
  remoteId: string;
  serialNumber: string;
  equipmentType?: string;
  brand?: string;
  model?: string;
};

export type RemoteTaskDto = {
  remoteId: string;
  taskNumber: string;
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
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  status?: 'pending' | 'in_progress' | 'completed' | 'unsuccessful' | 'rescheduled' | 'cancelled';

  observations?: string;
  operatorNotes?: string;
  internalNotes?: string;

  version: number;
  remoteUpdatedAt: string;

  series: RemoteTaskSeriesDto[];
};

export type RemoteTaskDownloadResponse = {
  downloadedAt: string;
  tasks: RemoteTaskDto[];
};
