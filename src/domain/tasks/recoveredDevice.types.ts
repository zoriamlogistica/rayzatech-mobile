// src/domain/tasks/recoveredDevice.types.ts

export type RecoveredDeviceType =
  | 'router'
  | 'modem'
  | 'decoder'
  | 'ont'
  | 'repeater'
  | 'phone'
  | 'tablet'
  | 'other';

export type RecoveredDeviceCondition =
  | 'good'
  | 'damaged'
  | 'incomplete'
  | 'not_readable'
  | 'unknown';

export type RecoveredDevice = {
  id: string;
  taskId: string;
  managementId?: string;
  remoteId?: string;

  serialNumber: string;
  deviceType: RecoveredDeviceType;
  condition: RecoveredDeviceCondition;

  hasCharger: boolean;
  hasRemoteControl: boolean;
  hasPowerSupply: boolean;
  hasNetworkCable: boolean;
  hasOtherAccessory: boolean;
  otherAccessoryDetail?: string;

  deviceObservation?: string;

  seriesLabelEvidenceId?: string;

  syncStatus: 'synced' | 'pending_sync' | 'syncing' | 'sync_failed' | 'conflict';
  isDirty: boolean;

  createdAt: string;
  updatedAt: string;
  localUpdatedAt: string;
  remoteUpdatedAt?: string;
};

export type CreateRecoveredDeviceInput = {
  taskId: string;
  managementId?: string;
  serialNumber: string;
  deviceType: RecoveredDeviceType;
  condition?: RecoveredDeviceCondition;

  hasCharger?: boolean;
  hasRemoteControl?: boolean;
  hasPowerSupply?: boolean;
  hasNetworkCable?: boolean;
  hasOtherAccessory?: boolean;
  otherAccessoryDetail?: string;

  deviceObservation?: string;
  seriesLabelEvidenceId?: string;
};

export type UpdateRecoveredDeviceInput = {
  id: string;
  managementId?: string;

  serialNumber?: string;
  deviceType?: RecoveredDeviceType;
  condition?: RecoveredDeviceCondition;

  hasCharger?: boolean;
  hasRemoteControl?: boolean;
  hasPowerSupply?: boolean;
  hasNetworkCable?: boolean;
  hasOtherAccessory?: boolean;
  otherAccessoryDetail?: string;

  deviceObservation?: string;
  seriesLabelEvidenceId?: string;
};

export type RecoveredDeviceCounters = {
  total: number;
  withPhoto: number;
  missingPhoto: number;
  dirty: number;
  pendingSync: number;
};