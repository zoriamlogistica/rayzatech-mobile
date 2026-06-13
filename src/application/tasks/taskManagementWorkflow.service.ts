// src/application/tasks/taskManagementWorkflow.service.ts

import type { Evidence } from '@/domain/evidence/evidence.types';
import type {
  RecoveredDevice,
  RecoveredDeviceCondition,
  RecoveredDeviceType,
} from '@/domain/tasks/recoveredDevice.types';
import type {
  CreateRescheduledManagementInput,
  CreateSuccessfulManagementInput,
  CreateUnsuccessfulManagementInput,
  RescheduleReason,
  TaskManagement,
  UnsuccessfulReason,
} from '@/domain/tasks/taskManagement.types';

import {
  addRecoveredDeviceOffline,
  attachSeriesLabelEvidenceToRecoveredDeviceOffline,
} from './recoveredDevice.service';
import {
  createRescheduledManagementOffline,
  createSuccessfulManagementOffline,
  createUnsuccessfulManagementOffline,
} from './taskManagement.service';
import {
  captureFakeEvidenceForTaskOffline,
  captureGpsForTaskOffline,
} from './taskOperations.service';

const MAX_DEVICES_PER_MANAGEMENT = 10;

export type ManagedRecoveredDeviceInput = {
  serialNumber: string;
  deviceType: RecoveredDeviceType;
  condition?: RecoveredDeviceCondition;
  labelEvidenceId?: string;

  hasCharger?: boolean;
  hasRemoteControl?: boolean;
  hasPowerSupply?: boolean;
  hasNetworkCable?: boolean;
  hasOtherAccessory?: boolean;
  otherAccessoryDetail?: string;

  deviceObservation?: string;

  /**
   * DEV: si está en true, se crea una evidencia fake tipo equipment_serial
   * y se vincula al equipo como foto de etiqueta.
   *
   * En producción esto vendrá de cámara/escáner real.
   */
  captureLabelEvidence?: boolean;
};

export type SuccessfulManagementWorkflowInput = {
  taskId: string;
  observation?: string;
  managedBy?: string;
  devices: ManagedRecoveredDeviceInput[];
  generalEvidenceId?: string;

  /**
   * DEV: crea evidencia fake tipo recovery_proof.
   * En producción será foto real de evidencia general.
   */
  captureGeneralEvidence?: boolean;
};

export type UnsuccessfulManagementWorkflowInput = {
  taskId: string;
  reason: UnsuccessfulReason;
  observation?: string;
  managedBy?: string;
  houseFrontEvidenceId?: string;

  /**
   * DEV: crea evidencia fake tipo house_front.
   * En producción será foto real de fachada.
   */
  captureHouseFrontEvidence?: boolean;
};

export type RescheduledManagementWorkflowInput = {
  taskId: string;
  reason: RescheduleReason;
  observation?: string;
  rescheduleDate: string;
  rescheduleTimeRange: string;
  managedBy?: string;
  houseFrontEvidenceId?: string;

  /**
   * DEV: crea evidencia fake tipo house_front.
   * En producción será foto real de fachada.
   */
  captureHouseFrontEvidence?: boolean;
};

export type TaskManagementWorkflowResult = {
  management: TaskManagement;
  generalEvidence?: Evidence;
  recoveredDevices: RecoveredDevice[];
  warnings: string[];
};

function assertDeviceInputs(devices: ManagedRecoveredDeviceInput[]): void {
  if (devices.length <= 0) {
    throw new Error('TASK_MANAGEMENT_WORKFLOW:RECOVERED_DEVICE_REQUIRED');
  }

  if (devices.length > MAX_DEVICES_PER_MANAGEMENT) {
    throw new Error(
      `TASK_MANAGEMENT_WORKFLOW:MAX_RECOVERED_DEVICES_EXCEEDED:${devices.length}`
    );
  }

  for (const [index, device] of devices.entries()) {
    if (!device.serialNumber.trim()) {
      throw new Error(
        `TASK_MANAGEMENT_WORKFLOW:DEVICE_SERIAL_REQUIRED:${index + 1}`
      );
    }

    if (!device.deviceType) {
      throw new Error(
        `TASK_MANAGEMENT_WORKFLOW:DEVICE_TYPE_REQUIRED:${index + 1}`
      );
    }

    if (device.hasOtherAccessory && !device.otherAccessoryDetail?.trim()) {
      throw new Error(
        `TASK_MANAGEMENT_WORKFLOW:OTHER_ACCESSORY_DETAIL_REQUIRED:${index + 1}`
      );
    }
  }
}

function buildGpsWarnings(params: {
  mocked?: boolean;
  accuracy?: number;
}): string[] {
  const warnings: string[] = [];

  if (params.mocked) {
    warnings.push(
      'GPS_MOCKED_DETECTED: Se identificó posible ubicación falsa. Debe notificarse al supervisor.'
    );
  }

  if (params.accuracy !== undefined && params.accuracy > 80) {
    warnings.push(
      `GPS_LOW_ACCURACY: Precisión baja detectada (${Math.round(
        params.accuracy
      )}m).`
    );
  }

  return warnings;
}

async function captureEvidenceIfNeeded(params: {
  taskId: string;
  evidenceType: Evidence['evidenceType'];
  enabled: boolean;
}): Promise<Evidence | undefined> {
  if (!params.enabled) {
    return undefined;
  }

  const result = await captureFakeEvidenceForTaskOffline({
    taskId: params.taskId,
    evidenceType: params.evidenceType,
  });

  return result.evidence;
}

export async function createSuccessfulManagementWorkflowOffline(
  input: SuccessfulManagementWorkflowInput
): Promise<TaskManagementWorkflowResult> {
  assertDeviceInputs(input.devices);

  const gpsResult = await captureGpsForTaskOffline(input.taskId);

  const generalEvidence = input.generalEvidenceId
  ? undefined
  : await captureEvidenceIfNeeded({
      taskId: input.taskId,
      evidenceType: 'recovery_proof',
      enabled: input.captureGeneralEvidence ?? true,
    });
  const managementInput: CreateSuccessfulManagementInput = {
    taskId: input.taskId,
    observation: input.observation,
    latitude: gpsResult.gpsPoint.latitude,
    longitude: gpsResult.gpsPoint.longitude,
    accuracy: gpsResult.gpsPoint.accuracy,
    mocked: gpsResult.gpsPoint.mocked,
    generalEvidenceId: input.generalEvidenceId ?? generalEvidence?.id,
    managedBy: input.managedBy,
  };

  const managementResult = await createSuccessfulManagementOffline(
    managementInput
  );

  const recoveredDevices: RecoveredDevice[] = [];

  for (const deviceInput of input.devices) {
    const createdDeviceResult = await addRecoveredDeviceOffline({
      taskId: input.taskId,
      managementId: managementResult.management.id,
      serialNumber: deviceInput.serialNumber,
      deviceType: deviceInput.deviceType,
      condition: deviceInput.condition ?? 'unknown',
      hasCharger: deviceInput.hasCharger ?? false,
      hasRemoteControl: deviceInput.hasRemoteControl ?? false,
      hasPowerSupply: deviceInput.hasPowerSupply ?? false,
      hasNetworkCable: deviceInput.hasNetworkCable ?? false,
      hasOtherAccessory: deviceInput.hasOtherAccessory ?? false,
      otherAccessoryDetail: deviceInput.otherAccessoryDetail,
      deviceObservation: deviceInput.deviceObservation,
    });

    let finalDevice = createdDeviceResult.device;

    if (deviceInput.labelEvidenceId) {
  const attachedResult =
    await attachSeriesLabelEvidenceToRecoveredDeviceOffline({
      recoveredDeviceId: createdDeviceResult.device.id,
      evidenceId: deviceInput.labelEvidenceId,
    });

  finalDevice = attachedResult.device;
} else if (deviceInput.captureLabelEvidence ?? true) {
  const labelEvidence = await captureFakeEvidenceForTaskOffline({
    taskId: input.taskId,
    evidenceType: 'equipment_serial',
  });

  const attachedResult =
    await attachSeriesLabelEvidenceToRecoveredDeviceOffline({
      recoveredDeviceId: createdDeviceResult.device.id,
      evidenceId: labelEvidence.evidence.id,
    });

  finalDevice = attachedResult.device;
}

    recoveredDevices.push(finalDevice);
  }

  return {
    management: managementResult.management,
    generalEvidence,
    recoveredDevices,
    warnings: buildGpsWarnings({
      mocked: gpsResult.gpsPoint.mocked,
      accuracy: gpsResult.gpsPoint.accuracy,
    }),
  };
}

export async function createUnsuccessfulManagementWorkflowOffline(
  input: UnsuccessfulManagementWorkflowInput
): Promise<TaskManagementWorkflowResult> {
  const gpsResult = await captureGpsForTaskOffline(input.taskId);

  const houseFrontEvidence = input.houseFrontEvidenceId
  ? undefined
  : await captureEvidenceIfNeeded({
      taskId: input.taskId,
      evidenceType: 'house_front',
      enabled: input.captureHouseFrontEvidence ?? true,
    });

  const managementInput: CreateUnsuccessfulManagementInput = {
    taskId: input.taskId,
    reason: input.reason,
    observation: input.observation,
    latitude: gpsResult.gpsPoint.latitude,
    longitude: gpsResult.gpsPoint.longitude,
    accuracy: gpsResult.gpsPoint.accuracy,
    mocked: gpsResult.gpsPoint.mocked,
    generalEvidenceId: input.houseFrontEvidenceId ?? houseFrontEvidence?.id,
    managedBy: input.managedBy,
  };

  const managementResult = await createUnsuccessfulManagementOffline(
    managementInput
  );

  return {
    management: managementResult.management,
    generalEvidence: houseFrontEvidence,
    recoveredDevices: [],
    warnings: buildGpsWarnings({
      mocked: gpsResult.gpsPoint.mocked,
      accuracy: gpsResult.gpsPoint.accuracy,
    }),
  };
}

export async function createRescheduledManagementWorkflowOffline(
  input: RescheduledManagementWorkflowInput
): Promise<TaskManagementWorkflowResult> {
  const gpsResult = await captureGpsForTaskOffline(input.taskId);

  const houseFrontEvidence = input.houseFrontEvidenceId
  ? undefined
  : await captureEvidenceIfNeeded({
      taskId: input.taskId,
      evidenceType: 'house_front',
      enabled: input.captureHouseFrontEvidence ?? true,
    });

  const managementInput: CreateRescheduledManagementInput = {
    taskId: input.taskId,
    reason: input.reason,
    observation: input.observation,
    latitude: gpsResult.gpsPoint.latitude,
    longitude: gpsResult.gpsPoint.longitude,
    accuracy: gpsResult.gpsPoint.accuracy,
    mocked: gpsResult.gpsPoint.mocked,
    generalEvidenceId: input.houseFrontEvidenceId ?? houseFrontEvidence?.id,
    rescheduleDate: input.rescheduleDate,
    rescheduleTimeRange: input.rescheduleTimeRange,
    managedBy: input.managedBy,
  };

  const managementResult = await createRescheduledManagementOffline(
    managementInput
  );
 
  return {
    management: managementResult.management,
    generalEvidence: houseFrontEvidence,
    recoveredDevices: [],
    warnings: buildGpsWarnings({
      mocked: gpsResult.gpsPoint.mocked,
      accuracy: gpsResult.gpsPoint.accuracy,
    }),
  };
}