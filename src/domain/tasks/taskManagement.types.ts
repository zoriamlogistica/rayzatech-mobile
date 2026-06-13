// src/domain/tasks/taskManagement.types.ts

import type { SyncStatus } from './task.types';

export type TaskManagementStatus =
  | 'successful'
  | 'unsuccessful'
  | 'rescheduled';

export type UnsuccessfulReason =
  | 'Cliente no encontrado'
  | 'Cliente ausente'
  | 'Cliente entregó a terceros'
  | 'Fraude'
  | 'Dirección errada'
  | 'Cliente mudado'
  | 'Dirección inaccesible'
  | 'Cliente niega devolución'
  | 'Cliente ya no cuenta con los equipos'
  | 'Servicio activo';

export type RescheduleReason =
  | 'Cliente solicita reprogramación'
  | 'Cliente no disponible'
  | 'Horario no compatible'
  | 'Cliente de viaje'
  | 'Solicitud operativa'
  | 'Pendiente confirmación';

export type TaskManagement = {
  id: string;
  taskId: string;
  remoteId?: string;

  managementNumber: number;
  resultStatus: TaskManagementStatus;

  reason?: UnsuccessfulReason | RescheduleReason;
  observation?: string;

  latitude?: number;
  longitude?: number;
  accuracy?: number;
  mocked?: boolean;

  generalEvidenceId?: string;

  rescheduleDate?: string;
  rescheduleTimeRange?: string;

  managedAt: string;
  managedBy?: string;

  syncStatus: SyncStatus;
  isDirty: boolean;

  createdAt: string;
  updatedAt: string;
  localUpdatedAt: string;
  remoteUpdatedAt?: string;
};

export type CreateSuccessfulManagementInput = {
  taskId: string;
  observation?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  mocked?: boolean;
  generalEvidenceId?: string;
  managedBy?: string;
};

export type CreateUnsuccessfulManagementInput = {
  taskId: string;
  reason: UnsuccessfulReason;
  observation?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  mocked?: boolean;
  generalEvidenceId?: string;
  managedBy?: string;
};

export type CreateRescheduledManagementInput = {
  taskId: string;
  reason: RescheduleReason;
  observation?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  mocked?: boolean;
  generalEvidenceId?: string;
  rescheduleDate: string;
  rescheduleTimeRange: string;
  managedBy?: string;
};

export type TaskManagementCounters = {
  total: number;
  successful: number;
  unsuccessful: number;
  rescheduled: number;
  today: number;
  dirty: number;
  pendingSync: number;
};

export const UNSUCCESSFUL_REASONS: UnsuccessfulReason[] = [
  'Cliente no encontrado',
  'Cliente ausente',
  'Cliente entregó a terceros',
  'Fraude',
  'Dirección errada',
  'Cliente mudado',
  'Dirección inaccesible',
  'Cliente niega devolución',
  'Cliente ya no cuenta con los equipos',
  'Servicio activo',
];

export const RESCHEDULE_REASONS: RescheduleReason[] = [
  'Cliente solicita reprogramación',
  'Cliente no disponible',
  'Horario no compatible',
  'Cliente de viaje',
  'Solicitud operativa',
  'Pendiente confirmación',
];