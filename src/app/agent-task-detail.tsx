// src/app/agent-task-detail.tsx

import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { classifyFieldError } from '@/application/errors/fieldError.service';
import { appLogger } from '@/application/logging/appLogger.service';
import { captureRealEvidenceForTaskOffline } from '@/application/tasks/evidenceCapture.service';
import { downloadDevTasksToLocalCache } from '@/application/tasks/taskDownload.service';
import {
  createRescheduledManagementWorkflowOffline,
  createSuccessfulManagementWorkflowOffline,
  createUnsuccessfulManagementWorkflowOffline,
} from '@/application/tasks/taskManagementWorkflow.service';
import {
  createSuccessfulManagementOffline,
  createUnsuccessfulManagementOffline,
} from '@/application/tasks/taskManagement.service';
import {
  getTaskDetailSnapshot,
  type TaskDetailSnapshot,
} from '@/application/tasks/taskQuery.service';
import { AgentScreen } from '@/components/agent-screen';
import type { RecoveredDeviceType } from '@/domain/tasks/recoveredDevice.types';
import {
  LAST_MILE_DELIVERY_RESULTS,
  LAST_MILE_PICKUP_RESULTS,
  MERCHANDISE_CONDITIONS,
  PARTIAL_DELIVERY_MERCHANDISE_CONDITIONS,
} from '@/domain/tasks/lastMile.types';
import {
  RESCHEDULE_REASONS,
  UNSUCCESSFUL_REASONS,
  type RescheduleReason,
  type TaskManagementStatus,
  type UnsuccessfulReason,
} from '@/domain/tasks/taskManagement.types';
import { captureCurrentLocation } from '@/infrastructure/gps/locationService';
import { getSecureAccessToken } from '@/infrastructure/security/secureTokenStore';
import {
  formatLimaDateTime,
  getLimaDateKey,
} from '@/shared/time/limaTime';
import { getDisplayZone } from '@/shared/zones';
import { runDevSyncSimulation } from '@/sync/syncEngine';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
const DEVICE_TYPE_OPTIONS = [
  'Decodificador',
  'Modem',
  'Router',
  'Repetidor',
] as const;

const TIME_RANGE_OPTIONS = ['AM', 'PM', 'TODO EL DIA'] as const;

type DeviceForm = {
  id: string;
  serialNumber: string;
  deviceType: string;
  deviceObservation: string;
  labelEvidenceId?: string;
  labelEvidenceUri?: string;
  hasCharger: boolean;
  hasPowerSupply: boolean;
  hasRemoteControl: boolean;
  hasOtherAccessory: boolean;
  otherAccessoryDetail: string;
};

const MAX_DEVICES_PER_MANAGEMENT = 10;
const MAX_LAST_MILE_EVIDENCE_PHOTOS = 10;
const MAX_RECOMMENDED_EVIDENCE_SIZE_BYTES = 2 * 1024 * 1024;

type EvidencePreview = {
  id: string;
  uri: string;
};

type LastMileResultKey =
  | keyof typeof LAST_MILE_DELIVERY_RESULTS
  | keyof typeof LAST_MILE_PICKUP_RESULTS;

type LastMileResultOption = {
  key: LastMileResultKey;
  label: string;
  substates: readonly string[];
};

function createDeviceForm(): DeviceForm {
  return {
    id: `device_form_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    serialNumber: '',
    deviceType: 'Modem',
    deviceObservation: '',
    hasCharger: true,
    hasPowerSupply: true,
    hasRemoteControl: false,
    hasOtherAccessory: false,
    otherAccessoryDetail: '',
  };
}


function parseDateKeyToDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);

  return new Date(year, month - 1, day);
}

function formatDateKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDateForAgent(dateKey?: string): string {
  if (!dateKey) {
    return '-';
  }

  const [year, month, day] = dateKey.split('-');

  if (!year || !month || !day) {
    return dateKey;
  }

  return `${day}/${month}/${year}`;
}

function formatFileSize(sizeBytes?: number | null): string {
  if (!sizeBytes || sizeBytes <= 0) {
    return '-';
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const sizeKb = sizeBytes / 1024;

  if (sizeKb < 1024) {
    return `${Math.round(sizeKb)} KB`;
  }

  const sizeMb = sizeKb / 1024;

  return `${sizeMb.toFixed(1)} MB`;
}

async function warnIfEvidenceIsHeavy(params: {
  evidenceId: string;
  evidenceType: string;
  sizeBytes?: number | null;
  taskId?: string;
}) {
  const sizeBytes = params.sizeBytes ?? 0;

  if (sizeBytes <= MAX_RECOMMENDED_EVIDENCE_SIZE_BYTES) {
    return;
  }

  const readableSize = formatFileSize(sizeBytes);

  await appLogger.warn({
    scope: 'AGENT_TASK_DETAIL',
    message: 'Evidencia optimizada supera el peso recomendado.',
    taskId: params.taskId,
    payload: {
      evidenceId: params.evidenceId,
      evidenceType: params.evidenceType,
      sizeBytes,
      readableSize,
      maxRecommendedBytes: MAX_RECOMMENDED_EVIDENCE_SIZE_BYTES,
    },
  });

  Alert.alert(
    'Evidencia pesada',
    `La foto fue guardada, pero aún pesa ${readableSize}. Si la imagen no es legible o tarda en sincronizar, toma una nueva foto con mejor encuadre y menos fondo innecesario.`
  );
}

function formatValue(value?: string | number | null): string {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  return String(value);
}

function formatDateTime(value?: string): string {
  return formatLimaDateTime(value);
}

function getTaskStatusLabel(status?: string): string {
  if (status === 'pending') return 'Pendiente';
  if (status === 'in_progress') return 'En progreso';
  if (status === 'completed') return 'Completada';
  if (status === 'unsuccessful') return 'No exitosa';
  if (status === 'rescheduled') return 'Reprogramada';
  if (status === 'cancelled') return 'Cancelada';

  return status ?? '-';
}

function isLastMileTask(
  task?: { fieldOperationType?: string; taskType?: string } | null
) {
  return (
    task?.fieldOperationType === 'last_mile' ||
    task?.taskType === 'last_mile_delivery' ||
    task?.taskType === 'last_mile_pickup'
  );
}

function isLastMilePickup(
  task?: { lastMileTaskType?: string; taskType?: string } | null
) {
  return task?.lastMileTaskType === 'pickup' || task?.taskType === 'last_mile_pickup';
}

function getLastMileTaskLabel(task?: {
  lastMileTaskType?: string;
  taskType?: string;
} | null) {
  return isLastMilePickup(task) ? 'Recojo' : 'Entrega';
}

function isDeliveryPartialSubstate(substate: string): boolean {
  return substate === 'Entrega parcial';
}

function isCashOnDeliverySubstate(substate: string): boolean {
  return substate === 'Pedido contra entrega pagado con POS/TRANS/YAPE/EFECTIVO';
}

function getMerchandiseConditionOptions(params: {
  isUnsuccessful: boolean;
  substate: string;
}): string[] {
  if (params.isUnsuccessful) {
    return [];
  }

  if (isDeliveryPartialSubstate(params.substate)) {
    return [...PARTIAL_DELIVERY_MERCHANDISE_CONDITIONS];
  }

  return [...MERCHANDISE_CONDITIONS];
}

function getDefaultMerchandiseCondition(params: {
  isUnsuccessful: boolean;
  substate: string;
}): string {
  return getMerchandiseConditionOptions(params)[0] ?? '';
}

function getLastMileResultOptions(task?: {
  lastMileTaskType?: string;
  taskType?: string;
} | null): LastMileResultOption[] {
  const source = isLastMilePickup(task)
    ? LAST_MILE_PICKUP_RESULTS
    : LAST_MILE_DELIVERY_RESULTS;

  return Object.entries(source).map(([key, value]) => ({
    key: key as LastMileResultKey,
    label: value.label,
    substates: value.substates,
  }));
}

function getManagementStatusLabel(status: string): string {
  if (status === 'successful') return 'Exitosa';
  if (status === 'unsuccessful') return 'No exitosa';
  if (status === 'rescheduled') return 'Reprogramada';

  return status;
}

function getInternalDeviceType(displayType: string): RecoveredDeviceType {
  if (displayType === 'Decodificador') {
    return 'decoder';
  }

  if (displayType === 'Router') {
    return 'router';
  }

  if (displayType === 'Repetidor') {
    return 'repeater';
  }

  if (displayType === 'Modem') {
    return 'modem';
  }

  return 'other';
}

function getGpsAuditLabel(params: {
  mocked?: boolean | null;
  accuracy?: number | null;
}): string {
  const accuracyText =
    typeof params.accuracy === 'number'
      ? ` · Precisión ${Math.round(params.accuracy)} m`
      : '';

  if (params.mocked) {
    return `GPS: posible ubicación falsa${accuracyText}`;
  }

  if (typeof params.accuracy === 'number' && params.accuracy > 100) {
    return `GPS: precisión baja${accuracyText}`;
  }

  return `GPS: OK${accuracyText}`;
}

function getGpsAuditStyle(params: {
  mocked?: boolean | null;
  accuracy?: number | null;
}) {
  if (params.mocked) {
    return styles.gpsAuditDanger;
  }

  if (typeof params.accuracy === 'number' && params.accuracy > 100) {
    return styles.gpsAuditWarning;
  }

  return styles.gpsAuditOk;
}

function getDeviceTypeLabel(deviceType?: string): string {
  if (deviceType === 'decoder') {
    return 'Decodificador';
  }

  if (deviceType === 'modem') {
    return 'Modem';
  }

  if (deviceType === 'router') {
    return 'Router';
  }

  if (deviceType === 'repeater') {
    return 'Repetidor';
  }

  if (deviceType === 'ont') {
    return 'ONT';
  }

  if (deviceType === 'phone') {
    return 'Teléfono';
  }

  if (deviceType === 'tablet') {
    return 'Tablet';
  }

  if (deviceType === 'other') {
    return 'Otro';
  }

  return deviceType ?? '-';
}
function getAccessoriesLabel(device: {
  hasCharger: boolean;
  hasRemoteControl: boolean;
  hasPowerSupply: boolean;
  hasNetworkCable: boolean;
  hasOtherAccessory: boolean;
  otherAccessoryDetail?: string;
}): string {
  const accessories: string[] = [];

  if (device.hasCharger) accessories.push('Cargador');
  if (device.hasPowerSupply) accessories.push('Fuente');
  if (device.hasRemoteControl) accessories.push('Control');
  if (device.hasNetworkCable) accessories.push('Cable red');
  if (device.hasOtherAccessory) {
    accessories.push(device.otherAccessoryDetail || 'Otros');
  }

  return accessories.length > 0 ? accessories.join(', ') : 'Sin accesorios';
}

export default function AgentTaskDetailScreen() {
  const params = useLocalSearchParams<{ taskId?: string }>();
  const taskId = params.taskId;

  const [snapshot, setSnapshot] = useState<TaskDetailSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<TaskManagementStatus>('successful');

  const [isDeviceTypeModalOpen, setIsDeviceTypeModalOpen] = useState(false);
  const [isUnsuccessfulReasonModalOpen, setIsUnsuccessfulReasonModalOpen] =
    useState(false);
  const [isRescheduleReasonModalOpen, setIsRescheduleReasonModalOpen] =
    useState(false);
  const [isRescheduleDateModalOpen, setIsRescheduleDateModalOpen] =
    useState(false);
  const [isTimeRangeModalOpen, setIsTimeRangeModalOpen] = useState(false);
  const [isLastMileResultModalOpen, setIsLastMileResultModalOpen] =
    useState(false);
  const [isLastMileSubstateModalOpen, setIsLastMileSubstateModalOpen] =
    useState(false);
  const [isMerchandiseConditionModalOpen, setIsMerchandiseConditionModalOpen] =
    useState(false);

  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [managementObservation, setManagementObservation] = useState('');
  const [lastMileResultKey, setLastMileResultKey] =
    useState<LastMileResultKey>('delivered');
  const [lastMileSubstate, setLastMileSubstate] = useState('');
  const [lastMilePackageCount, setLastMilePackageCount] = useState('');
  const [lastMileOperationNumber, setLastMileOperationNumber] = useState('');
  const [lastMileMerchandiseCondition, setLastMileMerchandiseCondition] =
    useState<string>(MERCHANDISE_CONDITIONS[0]);
  const [deviceForms, setDeviceForms] = useState<DeviceForm[]>([
  createDeviceForm(),
]);

const [selectedDeviceFormId, setSelectedDeviceFormId] = useState<string | null>(
  null
);

const [scannerDeviceFormId, setScannerDeviceFormId] = useState<string | null>(
  null
);
const [hasScannedCode, setHasScannedCode] = useState(false);
const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [unsuccessfulReason, setUnsuccessfulReason] =
    useState<UnsuccessfulReason>(UNSUCCESSFUL_REASONS[0]);

  const [rescheduleReason, setRescheduleReason] =
    useState<RescheduleReason>(RESCHEDULE_REASONS[0]);

  const [rescheduleDate, setRescheduleDate] = useState(getLimaDateKey());
  const [rescheduleTimeRange, setRescheduleTimeRange] = useState('AM');
  const [generalEvidenceId, setGeneralEvidenceId] = useState<string | undefined>();
const [generalEvidenceUri, setGeneralEvidenceUri] = useState<string | undefined>();
const [houseFrontEvidenceId, setHouseFrontEvidenceId] = useState<string | undefined>();
const [houseFrontEvidenceUri, setHouseFrontEvidenceUri] = useState<string | undefined>();
const [lastMileEvidencePhotos, setLastMileEvidencePhotos] = useState<
  EvidencePreview[]
>([]);
const [lastMileFacadePhotos, setLastMileFacadePhotos] = useState<
  EvidencePreview[]
>([]);

  async function handleError(error: unknown) {
    const fieldError = classifyFieldError(error);

    await appLogger.error({
      scope: 'AGENT_TASK_DETAIL',
      message: fieldError.message,
      error,
      taskId,
      payload: {
        fieldError,
      },
    });

    Alert.alert(fieldError.title, fieldError.message);
  }

  async function syncNow() {
  try {
    setIsLoading(true);

    const downloadResult = await downloadDevTasksToLocalCache();

    const syncResult = await runDevSyncSimulation({
      limit: 100,
      forceFail: false,
    });

    await loadDetail();

    Alert.alert(
      'Sincronización finalizada',
      `Tareas recibidas: ${downloadResult.remoteTasksReceived}.\n` +
        `Insertadas: ${downloadResult.inserted}.\n` +
        `Actualizadas: ${downloadResult.updated}.\n` +
        `Sincronizadas: ${syncResult.success}.\n` +
        `Pendientes: ${syncResult.remainingPending}.`
    );
  } catch (error) {
    await handleError(error);
  } finally {
    setIsLoading(false);
  }
}

async function syncImmediatelyAfterManagement(): Promise<boolean> {
  try {
    const syncResult = await runDevSyncSimulation({
      limit: 100,
      forceFail: false,
    });

    await downloadDevTasksToLocalCache();
    await loadDetail();

    await appLogger.info({
      scope: 'AGENT_TASK_DETAIL',
      message: 'Immediate sync after management finished.',
      taskId,
      payload: {
        success: syncResult.success,
        failed: syncResult.failed,
        remainingPending: syncResult.remainingPending,
      },
    });

    return syncResult.failed === 0;
  } catch (error) {
    await appLogger.warn({
      scope: 'AGENT_TASK_DETAIL',
      message:
        'Immediate sync after management failed. Management remains pending locally.',
      taskId,
      payload: {
        errorMessage:
          error instanceof Error ? error.message : String(error),
      },
    });

    await loadDetail();

    return false;
  }
}

  const loadDetail = useCallback(async () => {
    if (!taskId) {
      Alert.alert('Tarea no encontrada', 'No se recibio el ID de la tarea.');
      return;
    }

    try {
      setIsLoading(true);

      const result = await getTaskDetailSnapshot(taskId);

      setSnapshot(result);
    } catch (error) {
      await handleError(error);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  function resetManagementForm() {
    const lastMileOptions = getLastMileResultOptions(snapshot?.task);
    const defaultLastMileResult = lastMileOptions[0];
    const defaultLastMileSubstate = defaultLastMileResult?.substates[0] ?? '';
    const defaultLastMileIsUnsuccessful =
      defaultLastMileResult?.key === 'not_delivered' ||
      defaultLastMileResult?.key === 'not_picked_up';

    setSelectedStatus('successful');
    setManagementObservation('');
    setLastMileResultKey(defaultLastMileResult?.key ?? 'delivered');
    setLastMileSubstate(defaultLastMileSubstate);
    setLastMilePackageCount(
      snapshot?.task?.packageCount == null
        ? ''
        : String(snapshot.task.packageCount)
    );
    setLastMileOperationNumber('');
    setLastMileMerchandiseCondition(
      getDefaultMerchandiseCondition({
        isUnsuccessful: defaultLastMileIsUnsuccessful,
        substate: defaultLastMileSubstate,
      })
    );
    setDeviceForms([
  {
    ...createDeviceForm(),
    serialNumber: `SERIE-${Date.now()}`,
  },
]);
setSelectedDeviceFormId(null);
    setUnsuccessfulReason(UNSUCCESSFUL_REASONS[0]);
    setRescheduleReason(RESCHEDULE_REASONS[0]);
    setRescheduleDate(getLimaDateKey());
    setRescheduleTimeRange('AM');
    setGeneralEvidenceId(undefined);
setGeneralEvidenceUri(undefined);
setHouseFrontEvidenceId(undefined);
setHouseFrontEvidenceUri(undefined);
setLastMileEvidencePhotos([]);
setLastMileFacadePhotos([]);
  }

  function updateDeviceForm(
  deviceFormId: string,
  changes: Partial<DeviceForm>
): void {
  setDeviceForms((current) =>
    current.map((device) =>
      device.id === deviceFormId
        ? {
            ...device,
            ...changes,
          }
        : device
    )
  );
}

async function openSerialScanner(deviceFormId: string): Promise<void> {
  if (!cameraPermission?.granted) {
    const permission = await requestCameraPermission();

    if (!permission.granted) {
      Alert.alert(
        'Permiso de cámara requerido',
        'Debes permitir el uso de la cámara para escanear códigos de barras o QR.'
      );
      return;
    }
  }

  setHasScannedCode(false);
  setScannerDeviceFormId(deviceFormId);
}

function closeSerialScanner(): void {
  setHasScannedCode(false);
  setScannerDeviceFormId(null);
}

function normalizeScannedSerial(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

function handleSerialScanned(result: BarcodeScanningResult): void {
  if (hasScannedCode || !scannerDeviceFormId) {
    return;
  }

  const scannedValue = normalizeScannedSerial(result.data || '');

  if (!scannedValue) {
    return;
  }

  setHasScannedCode(true);

  updateDeviceForm(scannerDeviceFormId, {
    serialNumber: scannedValue,
  });

  Alert.alert(
    'Serie escaneada',
    `Se registró la serie:\n${scannedValue}`,
    [
      {
        text: 'OK',
        onPress: closeSerialScanner,
      },
    ]
  );
}

function addDeviceForm(): void {
  setDeviceForms((current) => {
    if (current.length >= MAX_DEVICES_PER_MANAGEMENT) {
      Alert.alert(
        'Limite alcanzado',
        `Solo puedes registrar hasta ${MAX_DEVICES_PER_MANAGEMENT} equipos por gestion.`
      );

      return current;
    }

    return [...current, createDeviceForm()];
  });
}

function removeDeviceForm(deviceFormId: string): void {
  setDeviceForms((current) => {
    if (current.length <= 1) {
      Alert.alert(
        'Equipo requerido',
        'Una gestion exitosa debe tener al menos un equipo recuperado.'
      );

      return current;
    }

    return current.filter((device) => device.id !== deviceFormId);
  });
}
  async function confirmGpsBeforeStartingManagement(): Promise<boolean> {
  try {
    const location = await captureCurrentLocation();

    if (!location.mocked) {
      return true;
    }

    await appLogger.warn({
      scope: 'AGENT_TASK_DETAIL',
      message: 'GPS mock detectado antes de iniciar gestión.',
      taskId,
      payload: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        mocked: location.mocked,
        capturedAt: location.capturedAt,
      },
    });

    return await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Ubicación posiblemente falsa',
        'Se identificó una posible ubicación falsa o simulada. Esta situación será registrada y notificada para revisión del supervisor. Puedes continuar, pero quedará trazabilidad de la advertencia.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Continuar de todos modos',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ]
      );
    });
  } catch (error) {
    await handleError(error);
    return false;
  }
}

  async function startManagement() {
  if (!snapshot?.task) {
    Alert.alert('Tarea no encontrada', 'No se encontró información local.');
    return;
  }

  const canContinueAfterGpsCheck = await confirmGpsBeforeStartingManagement();

  if (!canContinueAfterGpsCheck) {
    return;
  }

  const openModal = () => {
    resetManagementForm();
    setIsManagementModalOpen(true);
  };

  const hasPreviousManagements = snapshot.managementCounters.total > 0;
  const hasTodayManagements = snapshot.managementCounters.today > 0;

  const isFinalStatus =
    snapshot.task.status === 'completed' ||
    snapshot.task.status === 'unsuccessful' ||
    snapshot.task.status === 'rescheduled';

  if (hasPreviousManagements || hasTodayManagements || isFinalStatus) {
    Alert.alert(
      'Tarea ya gestionada',
      hasTodayManagements
        ? 'Esta tarea ya tiene una gestión registrada el día de hoy. Si continúas, se registrará una nueva gestión adicional.'
        : 'Esta tarea ya tiene una gestión registrada anteriormente. Si continúas, se registrará una nueva gestión adicional.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: openModal,
        },
      ]
    );

    return;
  }

  openModal();
}

function handleRescheduleDateChange(
  event: DateTimePickerEvent,
  selectedDate?: Date
) {
  setIsRescheduleDateModalOpen(false);

  if (event.type !== 'set' || !selectedDate) {
    return;
  }

  setRescheduleDate(formatDateKeyFromDate(selectedDate));
}

  async function captureGeneralEvidencePhoto() {
  if (!taskId) {
    return;
  }

  try {
    setIsLoading(true);

    const result = await captureRealEvidenceForTaskOffline({
      taskId,
      evidenceType: 'recovery_proof',
    });

    if (!result) {
      return;
    }

    setGeneralEvidenceId(result.evidence.id);
    setGeneralEvidenceUri(result.evidence.localUri);
    
    await warnIfEvidenceIsHeavy({
  evidenceId: result.evidence.id,
  evidenceType: result.evidence.evidenceType,
  sizeBytes: result.evidence.sizeBytes,
  taskId,
});

  } catch (error) {
    await handleError(error);
  } finally {
    setIsLoading(false);
  }
}

async function captureHouseFrontEvidencePhoto() {
  if (!taskId) {
    return;
  }

  try {
    setIsLoading(true);

    const result = await captureRealEvidenceForTaskOffline({
      taskId,
      evidenceType: 'house_front',
    });

    if (!result) {
      return;
    }

    setHouseFrontEvidenceId(result.evidence.id);
    setHouseFrontEvidenceUri(result.evidence.localUri);
    await warnIfEvidenceIsHeavy({
  evidenceId: result.evidence.id,
  evidenceType: result.evidence.evidenceType,
  sizeBytes: result.evidence.sizeBytes,
  taskId,
});
  } catch (error) {
    await handleError(error);
  } finally {
    setIsLoading(false);
  }
}

async function captureLastMileEvidencePhoto() {
  if (!taskId) {
    return;
  }

  if (lastMileEvidencePhotos.length >= MAX_LAST_MILE_EVIDENCE_PHOTOS) {
    Alert.alert(
      'Limite alcanzado',
      `Solo puedes registrar hasta ${MAX_LAST_MILE_EVIDENCE_PHOTOS} fotos por gestion.`
    );
    return;
  }

  try {
    setIsLoading(true);

    const result = await captureRealEvidenceForTaskOffline({
      taskId,
      evidenceType: 'recovery_proof',
    });

    if (!result) {
      return;
    }

    setGeneralEvidenceId((current) => current ?? result.evidence.id);
    setGeneralEvidenceUri((current) => current ?? result.evidence.localUri);
    setLastMileEvidencePhotos((current) => [
      ...current,
      {
        id: result.evidence.id,
        uri: result.evidence.localUri,
      },
    ]);

    await warnIfEvidenceIsHeavy({
      evidenceId: result.evidence.id,
      evidenceType: result.evidence.evidenceType,
      sizeBytes: result.evidence.sizeBytes,
      taskId,
    });
  } catch (error) {
    await handleError(error);
  } finally {
    setIsLoading(false);
  }
}

async function captureLastMileFacadePhoto() {
  if (!taskId) {
    return;
  }

  if (lastMileFacadePhotos.length >= MAX_LAST_MILE_EVIDENCE_PHOTOS) {
    Alert.alert(
      'Limite alcanzado',
      `Solo puedes registrar hasta ${MAX_LAST_MILE_EVIDENCE_PHOTOS} fotos por gestion.`
    );
    return;
  }

  try {
    setIsLoading(true);

    const result = await captureRealEvidenceForTaskOffline({
      taskId,
      evidenceType: 'house_front',
    });

    if (!result) {
      return;
    }

    setHouseFrontEvidenceId((current) => current ?? result.evidence.id);
    setHouseFrontEvidenceUri((current) => current ?? result.evidence.localUri);
    setLastMileFacadePhotos((current) => [
      ...current,
      {
        id: result.evidence.id,
        uri: result.evidence.localUri,
      },
    ]);

    await warnIfEvidenceIsHeavy({
      evidenceId: result.evidence.id,
      evidenceType: result.evidence.evidenceType,
      sizeBytes: result.evidence.sizeBytes,
      taskId,
    });
  } catch (error) {
    await handleError(error);
  } finally {
    setIsLoading(false);
  }
}

function removeLastMileEvidencePhoto(evidenceId: string) {
  setLastMileEvidencePhotos((current) => {
    const next = current.filter((photo) => photo.id !== evidenceId);
    return next;
  });

  const next = lastMileEvidencePhotos.filter(
    (photo) => photo.id !== evidenceId
  );
  setGeneralEvidenceId(next[0]?.id);
  setGeneralEvidenceUri(next[0]?.uri);
}

function removeLastMileFacadePhoto(evidenceId: string) {
  setLastMileFacadePhotos((current) => {
    const next = current.filter((photo) => photo.id !== evidenceId);
    return next;
  });

  const next = lastMileFacadePhotos.filter((photo) => photo.id !== evidenceId);
  setHouseFrontEvidenceId(next[0]?.id);
  setHouseFrontEvidenceUri(next[0]?.uri);
}

async function captureDeviceLabelEvidencePhoto(deviceFormId: string) {
  if (!taskId) {
    return;
  }

  try {
    setIsLoading(true);

    const result = await captureRealEvidenceForTaskOffline({
      taskId,
      evidenceType: 'equipment_serial',
    });

    if (!result) {
      return;
    }

    updateDeviceForm(deviceFormId, {
      labelEvidenceId: result.evidence.id,
      labelEvidenceUri: result.evidence.localUri,
    });
    await warnIfEvidenceIsHeavy({
  evidenceId: result.evidence.id,
  evidenceType: result.evidence.evidenceType,
  sizeBytes: result.evidence.sizeBytes,
  taskId,
});
  } catch (error) {
    await handleError(error);
  } finally {
    setIsLoading(false);
  }
}
  function showManagementWarnings(warnings: string[]) {
  if (warnings.length === 0) {
    return;
  }

  const hasMockedGps = warnings.some((warning) =>
    warning.includes('GPS_MOCKED_DETECTED')
  );

  const hasLowAccuracy = warnings.some((warning) =>
    warning.includes('GPS_LOW_ACCURACY')
  );

  if (hasMockedGps) {
    Alert.alert(
      'Ubicación posiblemente falsa',
      'La gestión fue registrada, pero el dispositivo reportó una posible ubicación simulada o falsa. Esta alerta quedará registrada para revisión del supervisor.'
    );
    return;
  }

  if (hasLowAccuracy) {
    Alert.alert(
      'Precisión GPS baja',
      'La gestión fue registrada, pero la precisión GPS fue baja. Si estás en interior o zona con poca señal, intenta acercarte a una ventana o salir a un área abierta.'
    );
  }
}

  async function saveManagement() {
    if (!taskId) {
      return;
    }

    try {
      setIsLoading(true);

      if (selectedStatus === 'successful') {
  const invalidDeviceIndex = deviceForms.findIndex(
    (device) => !device.serialNumber.trim()
  );
  if (!generalEvidenceId) {
  Alert.alert(
    'Evidencia requerida',
    'Debes tomar la foto de evidencia general de la gestión.'
  );
  return;
}

const missingLabelEvidenceIndex = deviceForms.findIndex(
  (device) => !device.labelEvidenceId
);

if (missingLabelEvidenceIndex >= 0) {
  Alert.alert(
    'Foto de etiqueta requerida',
    `Debes tomar la foto de etiqueta del equipo ${
      missingLabelEvidenceIndex + 1
    }.`
  );
  return;
}

  if (invalidDeviceIndex >= 0) {
    Alert.alert(
      'Serie requerida',
      `Debes ingresar la serie del equipo ${invalidDeviceIndex + 1}.`
    );
    return;
  }

  const result = await createSuccessfulManagementWorkflowOffline({
  taskId,
    observation: managementObservation,
    managedBy: 'dev_agent_001',
    generalEvidenceId,
captureGeneralEvidence: false,
    devices: deviceForms.map((device) => ({
      serialNumber: device.serialNumber,
      deviceType: getInternalDeviceType(device.deviceType),
      labelEvidenceId: device.labelEvidenceId,
      hasCharger: device.hasCharger,
      hasPowerSupply: device.hasPowerSupply,
      hasRemoteControl: device.hasRemoteControl,
      hasNetworkCable: false,
      hasOtherAccessory: device.hasOtherAccessory,
      otherAccessoryDetail: device.hasOtherAccessory
        ? device.otherAccessoryDetail
        : undefined,
      deviceObservation: device.deviceObservation,
      captureLabelEvidence: false,
    })),
  });
  showManagementWarnings(result.warnings);
}

      if (selectedStatus === 'unsuccessful') {
        if (!houseFrontEvidenceId) {
  Alert.alert(
    'Foto de fachada requerida',
    'Debes tomar la foto de fachada antes de guardar la gestión no exitosa.'
  );
  return;
}
        const result = await createUnsuccessfulManagementWorkflowOffline({
          taskId,
          reason: unsuccessfulReason,
          observation: managementObservation,
          managedBy: 'dev_agent_001',
          houseFrontEvidenceId,
          captureHouseFrontEvidence: false,
          
        });

  showManagementWarnings(result.warnings);
}
      

      if (selectedStatus === 'rescheduled') {
        if (!houseFrontEvidenceId) {
  Alert.alert(
    'Foto de fachada requerida',
    'Debes tomar la foto de fachada antes de guardar la reprogramación.'
  );
  return;
}
        const result = await createRescheduledManagementWorkflowOffline({
          taskId,
          reason: rescheduleReason,
          observation: managementObservation,
          rescheduleDate,
          rescheduleTimeRange,
          managedBy: 'dev_agent_001',
          houseFrontEvidenceId,
captureHouseFrontEvidence: false,
        });
        showManagementWarnings(result.warnings);
      }

      setIsManagementModalOpen(false);

const synced = await syncImmediatelyAfterManagement();

if (synced) {
  Alert.alert(
    'Gestión sincronizada',
    selectedStatus === 'successful'
      ? 'La gestión fue registrada y sincronizada. La constancia ya debería estar disponible.'
      : 'La gestión fue registrada y sincronizada correctamente.'
  );
} else {
  Alert.alert(
    'Gestión guardada',
    'La gestión fue registrada en el equipo, pero quedó pendiente de sincronización. Se enviará automáticamente cuando haya conexión estable.'
  );
}
    } catch (error) {
      await handleError(error);
    } finally {
      setIsLoading(false);
    }
  }
async function callCustomer() {
  const cleanPhone = task?.customerPhone?.trim();

  if (!cleanPhone) {
    Alert.alert('Sin teléfono', 'Esta tarea no tiene teléfono registrado.');
    return;
  }

  await Linking.openURL(`tel:${cleanPhone}`);
}

async function messageCustomer() {
  const cleanPhone = task?.customerPhone?.replace(/\D/g, '');

  if (!cleanPhone) {
    Alert.alert('Sin teléfono', 'Esta tarea no tiene teléfono registrado.');
    return;
  }

  const whatsappPhone = cleanPhone.startsWith('51')
    ? cleanPhone
    : `51${cleanPhone}`;

  await Linking.openURL(`https://wa.me/${whatsappPhone}`);
}

async function buildReceiptUrl(
  remoteTaskId?: string,
  remoteManagementId?: string
) {
  if (!remoteTaskId || !remoteManagementId) {
    return null;
  }

  const baseUrl = process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL;

  if (!baseUrl) {
    return null;
  }

  const accessToken = await getSecureAccessToken();

  if (!accessToken) {
    return null;
  }

  const safeBaseUrl = baseUrl.replace(/\/$/, '');
  const safeToken = encodeURIComponent(accessToken);

  return `${safeBaseUrl}/api/mobile/tasks/${remoteTaskId}/receipt/${remoteManagementId}?access_token=${safeToken}`;
}
async function getPublicReceiptUrl(remoteManagementId?: string) {
  if (!task?.remoteId || !remoteManagementId) {
    return null;
  }

  const baseUrl = process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL;
  const accessToken = await getSecureAccessToken();

  if (!baseUrl || !accessToken) {
    return null;
  }

  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/api/mobile/tasks/${task.remoteId}/receipt-link/${remoteManagementId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  return data.publicUrl as string;
}

async function openReceiptPdf(remoteManagementId?: string) {
  const publicUrl = await getPublicReceiptUrl(remoteManagementId);

  if (!publicUrl) {
    Alert.alert(
      'Constancia no disponible',
      'No se pudo generar el enlace de constancia. Verifica que la gestión esté sincronizada.'
    );
    return;
  }

  await Linking.openURL(publicUrl);
}

function normalizeWhatsAppPhone(phone?: string | null) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (!digits) return '';

  if (digits.startsWith('51')) return digits;

  if (digits.length === 9) return `51${digits}`;

  return digits;
}

async function sendReceiptByWhatsApp(remoteManagementId?: string) {
  const publicUrl = await getPublicReceiptUrl(remoteManagementId);

  if (!publicUrl) {
    Alert.alert(
      'Constancia no disponible',
      'No se pudo generar el enlace de constancia para WhatsApp.'
    );
    return;
  }

  const phone = normalizeWhatsAppPhone(task?.customerPhone);

  const message = [
    `Estimado(a) ${task?.customerName || 'cliente'},`,
    '',
    `Por medio del presente, le enviamos su *Comprobante de Devolución de Equipos* correspondiente a la gestión realizada por encargo de la empresa ${task?.project || '-'}.`,
    '',
    'El documento contiene el detalle de la visita y los equipos registrados como sustento de la atención.',
    '',
    `Ver comprobante: ${publicUrl}`,
    '',
    'Saludos cordiales.',
    'Equipo de Gestión Operativa',
    'RAYZATECH Recovery Platform',
  ].join('\n');

  const whatsappUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  await Linking.openURL(whatsappUrl);
}

function showReceiptOptions(remoteManagementId?: string) {
  Alert.alert(
    'Constancia PDF',
    'Selecciona una acción',
    [
      {
        text: 'Descargar / abrir',
        onPress: () => openReceiptPdf(remoteManagementId),
      },
      {
        text: 'Enviar por WhatsApp',
        onPress: () => sendReceiptByWhatsApp(remoteManagementId),
      },
      {
        text: 'Cancelar',
        style: 'cancel',
      },
    ]
  );
}

async function openCustomerMap() {
  const coordinates =
    task?.latitude && task?.longitude
      ? `${task.latitude},${task.longitude}`
      : undefined;

  const query = coordinates
    ? coordinates
    : [task?.address, task?.district, 'Perú'].filter(Boolean).join(', ');

  if (!query.trim()) {
    Alert.alert('Sin ubicación', 'Esta tarea no tiene dirección registrada.');
    return;
  }

  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;

  await Linking.openURL(url);
  }

  async function saveLastMileManagement() {
    if (!taskId || !snapshot?.task) {
      return;
    }

    const resultOptions = getLastMileResultOptions(snapshot.task);
    const resultOption = resultOptions.find(
      (option) => option.key === lastMileResultKey
    );
    const isUnsuccessful =
      lastMileResultKey === 'not_delivered' ||
      lastMileResultKey === 'not_picked_up';
    const evidenceId = isUnsuccessful ? houseFrontEvidenceId : generalEvidenceId;

    if (!lastMileSubstate) {
      Alert.alert('Subestado requerido', 'Selecciona el subestado de la gestion.');
      return;
    }

    if (!evidenceId) {
      Alert.alert(
        'Evidencia requerida',
        isUnsuccessful
          ? 'Debes tomar la foto de fachada antes de confirmar.'
          : 'Debes tomar la evidencia de entrega o recojo antes de confirmar.'
      );
      return;
    }

    try {
      setIsLoading(true);

      const location = await captureCurrentLocation();
      const observationParts = [
        `Resultado ultima milla: ${resultOption?.label ?? lastMileResultKey}`,
        `Subestado: ${lastMileSubstate}`,
        !isUnsuccessful && lastMileMerchandiseCondition
          ? `Condicion mercaderia: ${lastMileMerchandiseCondition}`
          : null,
        lastMilePackageCount
          ? `Cantidad bultos/items gestionados: ${lastMilePackageCount}`
          : null,
        isCashOnDeliverySubstate(lastMileSubstate) && lastMileOperationNumber
          ? `Numero operacion: ${lastMileOperationNumber}`
          : null,
        managementObservation
          ? `Observaciones agente: ${managementObservation}`
          : null,
      ].filter(Boolean);

      if (isUnsuccessful) {
        await createUnsuccessfulManagementOffline({
          taskId,
          reason: lastMileSubstate as any,
          observation: observationParts.join('\n'),
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          mocked: location.mocked,
          generalEvidenceId: evidenceId,
          managedBy: 'dev_agent_001',
        });
      } else {
        await createSuccessfulManagementOffline({
          taskId,
          observation: observationParts.join('\n'),
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          mocked: location.mocked,
          generalEvidenceId: evidenceId,
          managedBy: 'dev_agent_001',
        });
      }

      setIsManagementModalOpen(false);
      resetManagementForm();

      const synced = await syncImmediatelyAfterManagement();

      Alert.alert(
        'Gestion registrada',
        synced
          ? 'La gestion de ultima milla fue registrada y sincronizada.'
          : 'La gestion quedo guardada en el telefono y pendiente de sincronizar.'
      );

      await loadDetail();
    } catch (error) {
      await handleError(error);
    } finally {
      setIsLoading(false);
    }
  }

  const task = snapshot?.task;
  const taskIsLastMile = isLastMileTask(task);
  const lastMileResultOptions = getLastMileResultOptions(task);
  const selectedLastMileResult =
    lastMileResultOptions.find((option) => option.key === lastMileResultKey) ??
    lastMileResultOptions[0];
  const lastMileSubstateOptions = selectedLastMileResult?.substates ?? [];
  const lastMileIsUnsuccessful =
    lastMileResultKey === 'not_delivered' ||
    lastMileResultKey === 'not_picked_up';
  const lastMileConditionOptions = getMerchandiseConditionOptions({
    isUnsuccessful: lastMileIsUnsuccessful,
    substate: lastMileSubstate,
  });
  const shouldShowLastMileCondition =
    taskIsLastMile && !lastMileIsUnsuccessful;
  const shouldShowOperationNumber =
    taskIsLastMile && isCashOnDeliverySubstate(lastMileSubstate);
  const visibleLastMilePhotos = lastMileIsUnsuccessful
    ? lastMileFacadePhotos
    : lastMileEvidencePhotos;

  return (
    <AgentScreen
      active="tasks"
      title="Detalle de tarea"
      subtitle={task?.taskNumber ?? 'Informacion operativa'}
      isRefreshing={isLoading}
      onRefresh={loadDetail}
      isSyncing={isLoading}
      onSyncPress={syncNow}
      onMenuSynced={loadDetail}
    >
      {!task ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sin informacion</Text>
          <Text style={styles.emptyText}>
            No se encontro la tarea local. ID recibido: {taskId ?? 'sin ID'}
          </Text>

          <Pressable style={styles.homeButton} onPress={() => router.back()}>
            <Text style={styles.homeButtonText}>Volver</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.compactCard}>
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.taskNumber}>
                  {formatValue(task.taskNumber ?? task.id)}
                </Text>
                <Text style={styles.customerName}>
                  {formatValue(task.customerName)}
                </Text>
              </View>

              <Text style={[styles.statusBadge, getTaskStatusStyle(task.status)]}>
                {getTaskStatusLabel(task.status)}
              </Text>
            </View>

            {task.hasPendingLiquidation ? (
              <Text style={styles.liquidationWarning}>
                Pedido con items pendiente de liquidar
              </Text>
            ) : null}

            <View style={styles.detailList}>
              {taskIsLastMile ? (
                <>
                  <DetailRow label="TIPO OPERACION" value="Ultima milla" />
                  <DetailRow label="TIPO TAREA" value={getLastMileTaskLabel(task)} />
                  <DetailRow label="NUMERO PEDIDO" value={task.taskNumber ?? task.id} />
                  <DetailRow label="CUENTA" value={task.orderCode} />
                  <DetailRow label="PROYECTO" value={task.project} />
                  <DetailRow label="NUMERO RUTA" value={task.routeNumber} />
                  <DetailRow label="NUMERO GUIA" value={task.guideNumber} />
                  <DetailRow label="AREA ATENCION" value={task.serviceArea} />
                  <DetailRow
                    label="BULTOS/ITEMS"
                    value={
                      task.packageCount == null
                        ? undefined
                        : String(task.packageCount)
                    }
                  />
                  <DetailRow label="FECHA PROGRAMADA" value={task.scheduledDate} />
                  <DetailRow label="RANGO HORARIO" value={task.timeRange} />
                  <DetailRow
                    label="INSTRUCCIONES"
                    value={task.deliveryInstructions}
                  />
                  <DetailRow
                    label="CONDICION MERCADERIA"
                    value={task.merchandiseCondition}
                  />
                  <DetailRow label="LIQUIDACION" value={task.liquidationStatus} />
                </>
              ) : (
                <>
                  <DetailRow label="TIPO OPERACION" value="Logistica inversa" />
                  <DetailRow label="NUMERO_TAREA" value={task.taskNumber ?? task.id} />
                  <DetailRow label="PROYECTO" value={task.project} />
                  <DetailRow label="SOT" value={task.sot} />
                  <DetailRow label="FECHA_PROGRAMADA" value={task.scheduledDate} />
                  <DetailRow label="RANGO_HORARIO" value={task.timeRange} />
                  <DetailRow label="TIPO_TAREA" value={task.taskType} />
                </>
              )}
              <DetailRow label="CLIENTE" value={task.customerName} />
              <DetailRow label="DOCUMENTO IDENTIDAD" value={task.customerDocument} />
              <DetailRow label="TELEFONO" value={task.customerPhone} />
              <DetailRow label="CONTACTO" value={task.contactData} />
              <DetailRow
                label="UBICACION"
                value={`${formatValue(task.department)} / ${formatValue(
                  task.province
                )} / ${formatValue(task.district)}`}
              />
              <DetailRow label="Zona" value={getDisplayZone(task)} />
              <DetailRow
                label="COORDENADAS"
                value={
                  task.latitude && task.longitude
                    ? `${task.latitude}, ${task.longitude}`
                    : '-'
                }
              />
              <DetailRow label="DIRECCION" value={task.address} />
              <DetailRow label="REFERENCIA" value={task.reference} />
              <DetailRow label="OBSERVACIONES" value={task.observations} />
              <DetailRow label="ESTADO" value={getTaskStatusLabel(task.status)} />
            </View>
          </View>

<View style={styles.detailQuickActions}>
  <DetailQuickAction
    iconName="call-outline"
    label="Llamar"
    onPress={callCustomer}
  />

  <DetailQuickAction
    iconName="logo-whatsapp"
    label="WhatsApp"
    onPress={messageCustomer}
  />

  <DetailQuickAction
    iconName="location-outline"
    label="Mapa"
    onPress={openCustomerMap}
  />
</View>

<Pressable style={styles.primaryButton} onPress={startManagement}>
  <Text style={styles.primaryButtonText}>Iniciar gestión</Text>
</Pressable>

          <View style={styles.card}>
            <View style={styles.historyHeader}>
              <Text style={styles.cardTitle}>Historial de gestiones</Text>
              <Text style={styles.counterBadge}>
                {snapshot.managementCounters.total}
              </Text>
            </View>

            {snapshot.managementHistory.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Sin gestiones registradas</Text>
                <Text style={styles.emptyText}>
                  Cuando el agente gestione la tarea, el historial aparecera aqui.
                </Text>
              </View>
            ) : (
              snapshot.managementHistory.map((item) => (
                <View key={item.management.id} style={styles.managementCard}>
                  <View style={styles.managementHeader}>
                    <Text style={styles.managementTitle}>
                      Gestion #{item.management.managementNumber}
                    </Text>

                    <Text
                      style={[
                        styles.managementStatusBadge,
                        getManagementStatusStyle(item.management.resultStatus),
                      ]}
                    >
                      {getManagementStatusLabel(item.management.resultStatus)}
                    </Text>
                  </View>

                  <Text style={styles.historyText}>
  Fecha/hora: {formatDateTime(item.management.managedAt)}
</Text>

<Text
  style={[
    styles.gpsAuditText,
    getGpsAuditStyle({
      mocked: item.management.mocked,
      accuracy: item.management.accuracy,
    }),
  ]}
>
  {getGpsAuditLabel({
    mocked: item.management.mocked,
    accuracy: item.management.accuracy,
  })}
</Text>

                  {item.management.reason ? (
                    <Text style={styles.metaText}>
                      Motivo: {item.management.reason}
                    </Text>
                  ) : null}

                  {item.management.rescheduleDate ? (
                    <Text style={styles.metaText}>
                      Fecha reprogramada:{' '}
                      {formatValue(item.management.rescheduleDate)}
                    </Text>
                  ) : null}

                  {item.management.rescheduleTimeRange ? (
                    <Text style={styles.metaText}>
                      Nuevo rango horario:{' '}
                      {formatValue(item.management.rescheduleTimeRange)}
                    </Text>
                  ) : null}

                  <Text style={styles.metaText}>
                    Observaciones: {formatValue(item.management.observation)}
                  </Text>

                  <Text style={styles.metaText}>
                    Coordenadas:{' '}
                    {item.management.latitude && item.management.longitude
                      ? `${item.management.latitude}, ${item.management.longitude}`
                      : '-'}
                  </Text>

                  {item.management.mocked ? (
                    <Text style={styles.dangerText}>
                      Advertencia: ubicacion marcada como posible falsa/mock.
                    </Text>
                  ) : null}

                  {item.generalEvidence ? (
  <View style={styles.evidenceBox}>
    <Text style={styles.evidenceText}>Evidencia registrada</Text>

    <View style={styles.evidencePreviewRow}>
      <PhotoThumbnail
        uri={item.generalEvidence.localUri}
        label="Evidencia"
        onPress={(uri) => setPreviewImageUri(uri)}
      />

      <Text style={styles.evidenceSizeText}>
        Peso: {formatFileSize(item.generalEvidence.sizeBytes)}
      </Text>
    </View>
  </View>
) : null}

{item.management.resultStatus === 'successful' &&
item.management.remoteId &&
task?.remoteId ? (
  <Pressable
  style={styles.receiptButton}
  onPress={() => showReceiptOptions(item.management.remoteId)}
>
  <Text style={styles.receiptButtonText}>
    Constancia PDF
  </Text>
</Pressable>
) : null}
                  
                  {item.management.resultStatus === 'successful' ? (
                    <View style={styles.devicesSection}>
                      <Text style={styles.devicesTitle}>
                        Equipos recuperados ({item.recoveredDevices.length})
                      </Text>

                      {item.recoveredDevices.length === 0 ? (
                        <Text style={styles.emptyText}>
                          Sin equipos vinculados a esta gestion.
                        </Text>
                      ) : (
                        item.recoveredDevices.map((deviceSnapshot, index) => {
  const device = deviceSnapshot.device;

  return (
    <View key={device.id} style={styles.deviceCard}>
     <View style={styles.deviceThumbnailBox}>
  <PhotoThumbnail
    uri={deviceSnapshot.labelEvidence?.localUri}
    label="Etiqueta"
    onPress={(uri) => setPreviewImageUri(uri)}
  />

  {deviceSnapshot.labelEvidence ? (
    <Text style={styles.deviceEvidenceSizeText}>
      {formatFileSize(deviceSnapshot.labelEvidence.sizeBytes)}
    </Text>
  ) : null}
</View>

      <View style={styles.deviceInfo}>
        <Text style={styles.deviceTitle}>
          Equipo {index + 1}
        </Text>

        <Text style={styles.deviceText}>
          Serie: {device.serialNumber}
        </Text>

        <Text style={styles.deviceText}>
          Tipo: {getDeviceTypeLabel(device.deviceType)}
        </Text>

        <Text style={styles.deviceText}>
          Accesorios: {getAccessoriesLabel(device)}
        </Text>
      </View>
    </View>
  );
})
                      )}
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>

          <Pressable style={styles.homeButton} onPress={() => router.back()}>
            <Text style={styles.homeButtonText}>Volver</Text>
          </Pressable>
        </>
      )}

      <Modal
  transparent
  animationType="fade"
  visible={isManagementModalOpen}
  onRequestClose={() => setIsManagementModalOpen(false)}
>
  <SafeAreaView
    style={styles.modalRoot}
    edges={['top', 'right', 'bottom', 'left']}
  >
    <Pressable
      style={styles.modalBackdrop}
      onPress={() => setIsManagementModalOpen(false)}
    />

    <View style={styles.modalCard}>
      <ScrollView
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.modalScrollContent}
      >
        <Text style={styles.modalTitle}>
          {taskIsLastMile
            ? `Gestionar ${getLastMileTaskLabel(task).toLowerCase()}`
            : 'Nueva gestion'}
        </Text>

        {taskIsLastMile ? (
          <View style={styles.successDeviceBox}>
            <SelectorField
              label="Resultado de gestion"
              value={selectedLastMileResult?.label ?? ''}
              onPress={() => setIsLastMileResultModalOpen(true)}
            />

            <SelectorField
              label="Subestado"
              value={lastMileSubstate}
              onPress={() => setIsLastMileSubstateModalOpen(true)}
            />

            {shouldShowLastMileCondition ? (
              <SelectorField
                label="Condicion de mercaderia"
                value={lastMileMerchandiseCondition}
                onPress={() => setIsMerchandiseConditionModalOpen(true)}
              />
            ) : null}

            <TextInput
              value={lastMilePackageCount}
              onChangeText={setLastMilePackageCount}
              placeholder="Cantidad bultos/items gestionados"
              style={styles.input}
              keyboardType="numeric"
            />

            {shouldShowOperationNumber ? (
              <TextInput
                value={lastMileOperationNumber}
                onChangeText={setLastMileOperationNumber}
                placeholder="Numero de operacion"
                style={styles.input}
              />
            ) : null}

            <TextInput
              value={managementObservation}
              onChangeText={setManagementObservation}
              placeholder="Observaciones de la gestion"
              style={styles.input}
              multiline
            />

            <Pressable
              style={styles.photoButton}
              onPress={
                lastMileIsUnsuccessful
                  ? captureLastMileFacadePhoto
                  : captureLastMileEvidencePhoto
              }
            >
              <Text style={styles.photoButtonText}>
                {lastMileIsUnsuccessful
                  ? `Agregar foto fachada (${lastMileFacadePhotos.length}/${MAX_LAST_MILE_EVIDENCE_PHOTOS})`
                  : `Agregar evidencia (${lastMileEvidencePhotos.length}/${MAX_LAST_MILE_EVIDENCE_PHOTOS})`}
              </Text>
            </Pressable>

            {visibleLastMilePhotos.length > 0 ? (
              <View style={styles.lastMilePhotoGrid}>
                {visibleLastMilePhotos.map((photo, index) => (
                  <View key={photo.id} style={styles.lastMilePhotoItem}>
                    <PhotoThumbnail
                      uri={photo.uri}
                      label={`Foto ${index + 1}`}
                      onPress={(uri) => setPreviewImageUri(uri)}
                    />

                    <Pressable
                      style={styles.removePhotoButton}
                      onPress={() =>
                        lastMileIsUnsuccessful
                          ? removeLastMileFacadePhoto(photo.id)
                          : removeLastMileEvidencePhoto(photo.id)
                      }
                    >
                      <Text style={styles.removePhotoButtonText}>X</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.helperText}>
              Para entrega o recojo conforme, registra evidencia del paquete,
              guia, voucher o fachada segun corresponda. Puedes subir maximo
              10 fotos por gestion. Para no exitosos, evidencia la visita con
              foto de fachada.
            </Text>
          </View>
        ) : null}

        {!taskIsLastMile ? (
        <View style={styles.statusSelector}>
          <StatusOption
            label="Exitosa"
            active={selectedStatus === 'successful'}
            onPress={() => setSelectedStatus('successful')}
          />
          <StatusOption
            label="No exitosa"
            active={selectedStatus === 'unsuccessful'}
            onPress={() => setSelectedStatus('unsuccessful')}
          />
          <StatusOption
            label="Reprogramada"
            active={selectedStatus === 'rescheduled'}
            onPress={() => setSelectedStatus('rescheduled')}
          />
        </View>
        ) : null}

        {!taskIsLastMile && selectedStatus === 'unsuccessful' ? (
          <View style={styles.optionList}>
            <SelectorField
              label="Motivo de no exitosa"
              value={unsuccessfulReason}
              onPress={() => setIsUnsuccessfulReasonModalOpen(true)}
            />
          </View>
        ) : null}

        {!taskIsLastMile && selectedStatus === 'rescheduled' ? (
          <View style={styles.optionList}>
            <SelectorField
              label="Motivo de reprogramacion"
              value={rescheduleReason}
              onPress={() => setIsRescheduleReasonModalOpen(true)}
            />

            <SelectorField
  label="Fecha reprogramada"
  value={formatDateForAgent(rescheduleDate)}
  onPress={() => setIsRescheduleDateModalOpen(true)}
/>

            <SelectorField
              label="Nuevo rango horario"
              value={rescheduleTimeRange}
              onPress={() => setIsTimeRangeModalOpen(true)}
            />
          </View>
        ) : null}

        {!taskIsLastMile ? (
        <TextInput
          value={managementObservation}
          onChangeText={setManagementObservation}
          placeholder="Observaciones de la gestion"
          style={styles.input}
          multiline
        />
        ) : null}

        {!taskIsLastMile && selectedStatus === 'successful' ? (
          <View style={styles.successDeviceBox}>
            <View style={styles.deviceSectionHeader}>
              <Text style={styles.inputLabel}>
                Equipos recuperados ({deviceForms.length}/
                {MAX_DEVICES_PER_MANAGEMENT})
              </Text>

              <Pressable style={styles.addDeviceButton} onPress={addDeviceForm}>
                <Text style={styles.addDeviceButtonText}>+ Equipo</Text>
              </Pressable>
            </View>

            <Pressable
  style={styles.photoButton}
  onPress={captureGeneralEvidencePhoto}
>
  <Text style={styles.photoButtonText}>
    {generalEvidenceId ? '✓ Evidencia general tomada' : 'Tomar evidencia general'}
  </Text>
</Pressable>

{generalEvidenceUri ? (
  <PhotoThumbnail
    uri={generalEvidenceUri}
    label="General"
    onPress={(uri) => setPreviewImageUri(uri)}
  />
) : null}

            {deviceForms.map((device, index) => (
              <View key={device.id} style={styles.deviceFormCard}>
                <View style={styles.deviceFormHeader}>
                  <Text style={styles.deviceFormTitle}>Equipo {index + 1}</Text>

                  <Pressable
                    style={styles.removeDeviceButton}
                    onPress={() => removeDeviceForm(device.id)}
                  >
                    <Text style={styles.removeDeviceButtonText}>Quitar</Text>
                  </Pressable>
                </View>

                <View style={styles.serialInputRow}>
  <TextInput
    value={device.serialNumber}
    onChangeText={(value) =>
      updateDeviceForm(device.id, {
        serialNumber: value,
      })
    }
    placeholder="Serie del equipo"
    style={styles.serialInput}
    autoCapitalize="characters"
    autoCorrect={false}
  />

  <Pressable
    style={styles.scanButton}
    onPress={() => openSerialScanner(device.id)}
  >
    <Ionicons name="scan-outline" size={18} color="#fff" />
    <Text style={styles.scanButtonText}>Escanear</Text>
  </Pressable>
</View>

                <SelectorField
                  label="Tipo de equipo"
                  value={device.deviceType}
                  onPress={() => {
                    setSelectedDeviceFormId(device.id);
                    setIsDeviceTypeModalOpen(true);
                  }}
                />

                <Pressable
  style={styles.photoButton}
  onPress={() => captureDeviceLabelEvidencePhoto(device.id)}
>
  <Text style={styles.photoButtonText}>
    {device.labelEvidenceId ? '✓ Foto etiqueta tomada' : 'Tomar foto etiqueta'}
  </Text>
</Pressable>

{device.labelEvidenceUri ? (
  <PhotoThumbnail
    uri={device.labelEvidenceUri}
    label="Etiqueta"
    onPress={(uri) => setPreviewImageUri(uri)}
  />
) : null}

                <View style={styles.checkRow}>
                  <CheckBoxLike
                    label="Cargador"
                    active={device.hasCharger}
                    onPress={() =>
                      updateDeviceForm(device.id, {
                        hasCharger: !device.hasCharger,
                      })
                    }
                  />

                  <CheckBoxLike
                    label="Fuente"
                    active={device.hasPowerSupply}
                    onPress={() =>
                      updateDeviceForm(device.id, {
                        hasPowerSupply: !device.hasPowerSupply,
                      })
                    }
                  />

                  <CheckBoxLike
                    label="Control"
                    active={device.hasRemoteControl}
                    onPress={() =>
                      updateDeviceForm(device.id, {
                        hasRemoteControl: !device.hasRemoteControl,
                      })
                    }
                  />

                  <CheckBoxLike
                    label="Otros"
                    active={device.hasOtherAccessory}
                    onPress={() =>
                      updateDeviceForm(device.id, {
                        hasOtherAccessory: !device.hasOtherAccessory,
                      })
                    }
                  />
                </View>

                {device.hasOtherAccessory ? (
                  <TextInput
                    value={device.otherAccessoryDetail}
                    onChangeText={(value) =>
                      updateDeviceForm(device.id, {
                        otherAccessoryDetail: value,
                      })
                    }
                    placeholder="Detalle de otros accesorios"
                    style={styles.input}
                  />
                ) : null}

                <TextInput
                  value={device.deviceObservation}
                  onChangeText={(value) =>
                    updateDeviceForm(device.id, {
                      deviceObservation: value,
                    })
                  }
                  placeholder="Observaciones del equipo"
                  style={styles.input}
                  multiline
                />

                <Text style={styles.helperText}>
                  DEV: se capturara foto de etiqueta automaticamente.
                </Text>
              </View>
            ))}

            <Text style={styles.helperText}>
              DEV: se capturara evidencia general automaticamente para la
              gestion.
            </Text>
          </View>
        ) : !taskIsLastMile ? (
          <View style={styles.optionList}>
  <Pressable
    style={styles.photoButton}
    onPress={captureHouseFrontEvidencePhoto}
  >
    <Text style={styles.photoButtonText}>
      {houseFrontEvidenceId ? '✓ Foto fachada tomada' : 'Tomar foto fachada'}
    </Text>
  </Pressable>

  {houseFrontEvidenceUri ? (
    <PhotoThumbnail
      uri={houseFrontEvidenceUri}
      label="Fachada"
      onPress={(uri) => setPreviewImageUri(uri)}
    />
  ) : null}
          </View>
        ) : null}

        <View style={styles.modalActions}>
          <Pressable
            style={styles.cancelButton}
            onPress={() => setIsManagementModalOpen(false)}
          >
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>

          <Pressable
            style={styles.saveButton}
            onPress={taskIsLastMile ? saveLastMileManagement : saveManagement}
          >
            <Text style={styles.saveButtonText}>Guardar gestion</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  </SafeAreaView>
</Modal> 

      <OptionPickerModal
  visible={isDeviceTypeModalOpen}
  title="Seleccionar tipo de equipo"
  options={[...DEVICE_TYPE_OPTIONS]}
  selectedValue={
    deviceForms.find((device) => device.id === selectedDeviceFormId)
      ?.deviceType ?? 'Modem'
  }
  onClose={() => {
    setIsDeviceTypeModalOpen(false);
    setSelectedDeviceFormId(null);
  }}
  onSelect={(value) => {
    if (selectedDeviceFormId) {
      updateDeviceForm(selectedDeviceFormId, {
        deviceType: value,
      });
    }

    setIsDeviceTypeModalOpen(false);
    setSelectedDeviceFormId(null);
  }}
/>

      <OptionPickerModal
        visible={isUnsuccessfulReasonModalOpen}
        title="Motivo de no exitosa"
        options={UNSUCCESSFUL_REASONS}
        selectedValue={unsuccessfulReason}
        onClose={() => setIsUnsuccessfulReasonModalOpen(false)}
        onSelect={(value) => {
          setUnsuccessfulReason(value as UnsuccessfulReason);
          setIsUnsuccessfulReasonModalOpen(false);
        }}
      />

      <OptionPickerModal
        visible={isRescheduleReasonModalOpen}
        title="Motivo de reprogramacion"
        options={RESCHEDULE_REASONS}
        selectedValue={rescheduleReason}
        onClose={() => setIsRescheduleReasonModalOpen(false)}
        onSelect={(value) => {
          setRescheduleReason(value as RescheduleReason);
          setIsRescheduleReasonModalOpen(false);
        }}
      />

      {isRescheduleDateModalOpen ? (
  <DateTimePicker
    value={parseDateKeyToDate(rescheduleDate)}
    mode="date"
    display="calendar"
    minimumDate={parseDateKeyToDate(getLimaDateKey())}
    onChange={handleRescheduleDateChange}
  />
) : null}

      <OptionPickerModal
        visible={isTimeRangeModalOpen}
        title="Nuevo rango horario"
        options={[...TIME_RANGE_OPTIONS]}
        selectedValue={rescheduleTimeRange}
        onClose={() => setIsTimeRangeModalOpen(false)}
        onSelect={(value) => {
          setRescheduleTimeRange(value);
          setIsTimeRangeModalOpen(false);
        }}
      />

      <OptionPickerModal
        visible={isLastMileResultModalOpen}
        title="Resultado de gestion"
        options={lastMileResultOptions.map((option) => option.label)}
        selectedValue={selectedLastMileResult?.label ?? ''}
        onClose={() => setIsLastMileResultModalOpen(false)}
        onSelect={(value) => {
          const selected = lastMileResultOptions.find(
            (option) => option.label === value
          );

          if (selected) {
            setLastMileResultKey(selected.key);
            const nextSubstate = selected.substates[0] ?? '';
            const nextIsUnsuccessful =
              selected.key === 'not_delivered' ||
              selected.key === 'not_picked_up';

            setLastMileSubstate(nextSubstate);
            setLastMileOperationNumber('');
            setLastMileMerchandiseCondition(
              getDefaultMerchandiseCondition({
                isUnsuccessful: nextIsUnsuccessful,
                substate: nextSubstate,
              })
            );
          }

          setIsLastMileResultModalOpen(false);
        }}
      />

      <OptionPickerModal
        visible={isLastMileSubstateModalOpen}
        title="Subestado"
        options={[...lastMileSubstateOptions]}
        selectedValue={lastMileSubstate}
        onClose={() => setIsLastMileSubstateModalOpen(false)}
        onSelect={(value) => {
          setLastMileSubstate(value);
          setLastMileOperationNumber('');
          setLastMileMerchandiseCondition(
            getDefaultMerchandiseCondition({
              isUnsuccessful: lastMileIsUnsuccessful,
              substate: value,
            })
          );
          setIsLastMileSubstateModalOpen(false);
        }}
      />

      <OptionPickerModal
        visible={isMerchandiseConditionModalOpen}
        title="Condicion de mercaderia"
        options={lastMileConditionOptions}
        selectedValue={lastMileMerchandiseCondition}
        onClose={() => setIsMerchandiseConditionModalOpen(false)}
        onSelect={(value) => {
          setLastMileMerchandiseCondition(value);
          setIsMerchandiseConditionModalOpen(false);
        }}
      />
      <Modal
  transparent
  animationType="fade"
  visible={!!previewImageUri}
  onRequestClose={() => setPreviewImageUri(null)}
>
  <SafeAreaView
    style={styles.imagePreviewRoot}
    edges={['top', 'right', 'bottom', 'left']}
  >
    <Pressable
      style={styles.imagePreviewClose}
      onPress={() => setPreviewImageUri(null)}
    >
      <Text style={styles.imagePreviewCloseText}>X</Text>
    </Pressable>

    {previewImageUri ? (
  <ZoomableImage uri={previewImageUri} />
) : null}

  </SafeAreaView>
</Modal>
<Modal
  animationType="slide"
  visible={!!scannerDeviceFormId}
  onRequestClose={closeSerialScanner}
>
  <SafeAreaView
    style={styles.scannerRoot}
    edges={['top', 'right', 'bottom', 'left']}
  >
    <CameraView
      style={styles.scannerCamera}
      facing="back"
      barcodeScannerSettings={{
        barcodeTypes: [
          'qr',
          'code128',
          'code39',
          'code93',
          'ean13',
          'ean8',
          'upc_a',
          'upc_e',
          'pdf417',
          'datamatrix',
        ],
      }}
      onBarcodeScanned={hasScannedCode ? undefined : handleSerialScanned}
    />

    <View style={styles.scannerOverlay}>
      <Text style={styles.scannerTitle}>Escanear serie</Text>
      <Text style={styles.scannerHelp}>
        Enfoca el código de barras o QR del equipo dentro del recuadro.
      </Text>

      <View style={styles.scannerFrame} />

      <Pressable style={styles.scannerCancelButton} onPress={closeSerialScanner}>
        <Text style={styles.scannerCancelText}>Cancelar</Text>
      </Pressable>
    </View>
  </SafeAreaView>
</Modal>
    </AgentScreen>
  );
}

function DetailQuickAction({
  iconName,
  label,
  onPress,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.detailQuickActionButton} onPress={onPress}>
      <Ionicons name={iconName} size={20} color="#137333" />
      <Text style={styles.detailQuickActionText}>{label}</Text>
    </Pressable>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{formatValue(value)}</Text>
    </View>
  );
}

function StatusOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.statusOption, active ? styles.statusOptionActive : null]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.statusOptionText,
          active ? styles.statusOptionTextActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ZoomableImage({ uri }: { uri: string }) {
  const [zoom, setZoom] = useState(1);

  function zoomIn() {
    setZoom((current) => Math.min(current + 0.5, 5));
  }

  function zoomOut() {
    setZoom((current) => Math.max(current - 0.5, 1));
  }

  function resetZoom() {
    setZoom(1);
  }

  return (
    <View style={styles.zoomableImageWrap}>
      <ScrollView
        style={styles.imagePanScroll}
        contentContainerStyle={styles.imagePanContent}
        horizontal
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <ScrollView
          contentContainerStyle={styles.imagePanContent}
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={{ uri }}
            style={[
              styles.imagePreview,
              {
                width: 360 * zoom,
                height: 640 * zoom,
              },
            ]}
            resizeMode="contain"
          />
        </ScrollView>
      </ScrollView>

      <View style={styles.zoomControls}>
        <Pressable style={styles.zoomButton} onPress={zoomOut}>
          <Text style={styles.zoomButtonText}>−</Text>
        </Pressable>

        <Pressable style={styles.zoomResetButton} onPress={resetZoom}>
          <Text style={styles.zoomResetButtonText}>{zoom.toFixed(1)}x</Text>
        </Pressable>

        <Pressable style={styles.zoomButton} onPress={zoomIn}>
          <Text style={styles.zoomButtonText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PhotoThumbnail({
  uri,
  label,
  onPress,
}: {
  uri?: string;
  label: string;
  onPress: (uri: string) => void;
}) {
  if (!uri) {
    return (
      <View style={styles.fakeThumbnail}>
        <Text style={styles.fakeThumbnailText}>Sin foto</Text>
      </View>
    );
  }

  return (
    <Pressable style={styles.realThumbnailWrap} onPress={() => onPress(uri)}>
      <Image source={{ uri }} style={styles.realThumbnail} resizeMode="cover" />
      <Text style={styles.thumbnailLabel}>{label}</Text>
    </Pressable>
  );
}
function OptionPickerModal({
  visible,
  title,
  options,
  selectedValue,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: readonly string[];
  selectedValue: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={styles.modalRoot}
        edges={['top', 'right', 'bottom', 'left']}
      >
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        <View style={styles.optionPickerCard}>
          <Text style={styles.modalTitle}>{title}</Text>

          {options.map((option) => (
            <Pressable
              key={option}
              style={[
                styles.optionPickerItem,
                selectedValue === option ? styles.optionPickerItemActive : null,
              ]}
              onPress={() => onSelect(option)}
            >
              <Text
                style={[
                  styles.optionPickerText,
                  selectedValue === option ? styles.optionPickerTextActive : null,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function SelectorField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.selectorField} onPress={onPress}>
      <View style={styles.selectorTextWrap}>
        <Text style={styles.selectorLabel}>{label}</Text>
        <Text style={styles.selectorValue}>{value || '-'}</Text>
      </View>

      <Text style={styles.selectorIcon}>▼</Text>
    </Pressable>
  );
}

function CheckBoxLike({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.checkChip, active ? styles.checkChipActive : null]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.checkChipText,
          active ? styles.checkChipTextActive : null,
        ]}
      >
        {active ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

function getTaskStatusStyle(status?: string) {
  if (status === 'completed') return styles.statusCompleted;
  if (status === 'unsuccessful') return styles.statusUnsuccessful;
  if (status === 'rescheduled') return styles.statusRescheduled;

  return styles.statusPending;
}

function getManagementStatusStyle(status?: string) {
  if (status === 'successful') return styles.statusCompleted;
  if (status === 'unsuccessful') return styles.statusUnsuccessful;
  if (status === 'rescheduled') return styles.statusRescheduled;

  return styles.statusPending;
}

const styles = StyleSheet.create({
  compactCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 14,
    backgroundColor: '#fff',
    gap: 10,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  receiptButton: {
  marginTop: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: '#BFDBFE',
  backgroundColor: '#EFF6FF',
  paddingVertical: 12,
  paddingHorizontal: 14,
  alignItems: 'center',
},

receiptButtonText: {
  color: '#1D4ED8',
  fontWeight: '800',
  fontSize: 13,
},
  taskNumber: {
    fontSize: 18,
    fontWeight: '900',
  },
  customerName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#222',
    marginTop: 2,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '900',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  statusPending: {
    backgroundColor: '#eeeeee',
    color: '#333333',
  },
  statusCompleted: {
    backgroundColor: '#e8f5ee',
    color: '#137333',
  },
  statusUnsuccessful: {
    backgroundColor: '#fdecec',
    color: '#b42318',
  },
  statusRescheduled: {
    backgroundColor: '#fff3df',
    color: '#9a6200',
  },
  liquidationWarning: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#fff5f5',
    color: '#9b1c1c',
    fontSize: 13,
    fontWeight: '900',
  },
  detailList: {
    gap: 0,
  },
  detailRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  detailLabel: {
    width: 122,
    fontSize: 10,
    fontWeight: '900',
    opacity: 0.62,
  },
  detailValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  primaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#137333',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#fff',
  },
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 14,
    backgroundColor: '#fff',
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counterBadge: {
    minWidth: 28,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '900',
    backgroundColor: '#eeeeee',
  },
  emptyBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f7f7f7',
    gap: 4,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  emptyText: {
    fontSize: 12,
    opacity: 0.72,
    lineHeight: 17,
  },
  managementCard: {
    padding: 11,
    borderWidth: 1,
    borderColor: '#eeeeee',
    borderRadius: 12,
    backgroundColor: '#fafafa',
    gap: 6,
  },
  managementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  managementTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  managementStatusBadge: {
    fontSize: 11,
    fontWeight: '900',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#333',
  },
  dangerText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '800',
    color: '#9b1c1c',
  },
  evidenceBox: {
    padding: 9,
    borderRadius: 10,
    backgroundColor: '#eef7f1',
  },
  evidenceText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#137333',
  },
  devicesSection: {
    marginTop: 4,
    gap: 8,
  },
  devicesTitle: {
    fontSize: 13,
    fontWeight: '900',
  },
  deviceCard: {
    flexDirection: 'row',
    gap: 9,
    padding: 9,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  fakeThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8e8e8',
  },
  fakeThumbnailText: {
    fontSize: 10,
    fontWeight: '800',
    opacity: 0.7,
  },
  deviceInfo: {
    flex: 1,
    gap: 2,
  },
  deviceTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  deviceText: {
    fontSize: 11,
    lineHeight: 15,
  },
  homeButton: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#eeeeee',
  },
  homeButtonText: {
    fontSize: 14,
    fontWeight: '900',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalCard: {
  maxHeight: '92%',
  borderRadius: 16,
  backgroundColor: '#fff',
  overflow: 'hidden',
},
modalScrollContent: {
  padding: 14,
  gap: 10,
  paddingBottom: 28,
},
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  statusSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#eeeeee',
  },
  statusOptionActive: {
    backgroundColor: '#137333',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#333',
  },
  statusOptionTextActive: {
    color: '#fff',
  },
  selectorField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  selectorTextWrap: {
    flex: 1,
    gap: 2,
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '900',
    opacity: 0.65,
  },
  selectorValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  selectorIcon: {
    fontSize: 11,
    fontWeight: '900',
    opacity: 0.7,
  },
  optionPickerCard: {
    maxHeight: '82%',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
    gap: 8,
  },
  optionPickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f3f3f3',
  },
  optionPickerItemActive: {
    backgroundColor: '#137333',
  },
  optionPickerText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#222',
  },
  optionPickerTextActive: {
    color: '#fff',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '900',
    opacity: 0.75,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: '#fff',
  },
  optionList: {
    gap: 6,
  },
  successDeviceBox: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f7f7f7',
    gap: 8,
  },
  checkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  checkChip: {
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: '#eeeeee',
  },
  checkChipActive: {
    backgroundColor: '#137333',
  },
  checkChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  checkChipTextActive: {
    color: '#fff',
  },
  helperText: {
    fontSize: 11,
    lineHeight: 15,
    opacity: 0.7,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#eeeeee',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '900',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#137333',
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
  },

  deviceSectionHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
},
addDeviceButton: {
  paddingVertical: 7,
  paddingHorizontal: 10,
  borderRadius: 999,
  backgroundColor: '#137333',
},
addDeviceButtonText: {
  fontSize: 12,
  fontWeight: '900',
  color: '#fff',
},
deviceFormCard: {
  padding: 10,
  borderWidth: 1,
  borderColor: '#e2e2e2',
  borderRadius: 12,
  backgroundColor: '#fff',
  gap: 8,
},
deviceFormHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
},
deviceFormTitle: {
  fontSize: 13,
  fontWeight: '900',
},
removeDeviceButton: {
  paddingVertical: 5,
  paddingHorizontal: 9,
  borderRadius: 999,
  backgroundColor: '#fdecec',
},
removeDeviceButtonText: {
  fontSize: 11,
  fontWeight: '900',
  color: '#b42318',
},
realThumbnailWrap: {
  width: 58,
  height: 58,
  borderRadius: 10,
  overflow: 'hidden',
  backgroundColor: '#e8e8e8',
  position: 'relative',
},
realThumbnail: {
  width: '100%',
  height: '100%',
},
thumbnailLabel: {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  paddingVertical: 2,
  textAlign: 'center',
  fontSize: 9,
  fontWeight: '900',
  color: '#fff',
  backgroundColor: 'rgba(0,0,0,0.45)',
},
imagePreviewRoot: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.92)',
  alignItems: 'center',
  justifyContent: 'center',
},
imagePreview: {
  width: '100%',
  height: '88%',
},
imagePreviewClose: {
  position: 'absolute',
  top: 42,
  right: 22,
  zIndex: 10,
  width: 42,
  height: 42,
  borderRadius: 21,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#ffffff',
},
imagePreviewCloseText: {
  fontSize: 18,
  fontWeight: '900',
  color: '#111',
},
zoomableImageWrap: {
  width: '100%',
  height: '88%',
  alignItems: 'center',
  justifyContent: 'center',
},
imagePanScroll: {
  width: '100%',
  height: '88%',
},
imagePanContent: {
  alignItems: 'center',
  justifyContent: 'center',
},
zoomControls: {
  position: 'absolute',
  bottom: 28,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  paddingVertical: 8,
  paddingHorizontal: 10,
  borderRadius: 999,
  backgroundColor: 'rgba(255,255,255,0.95)',
},
zoomButton: {
  width: 42,
  height: 42,
  borderRadius: 21,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#137333',
},
zoomButtonText: {
  fontSize: 24,
  fontWeight: '900',
  color: '#fff',
},
zoomResetButton: {
  minWidth: 58,
  height: 42,
  paddingHorizontal: 10,
  borderRadius: 21,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#eeeeee',
},
zoomResetButtonText: {
  fontSize: 13,
  fontWeight: '900',
  color: '#111',
},
photoButton: {
  paddingVertical: 11,
  paddingHorizontal: 12,
  borderRadius: 12,
  alignItems: 'center',
  backgroundColor: '#e8f5ee',
  borderWidth: 1,
  borderColor: '#137333',
},
photoButtonText: {
  fontSize: 13,
  fontWeight: '900',
  color: '#137333',
},
evidencePreviewRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},
lastMilePhotoGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
},
lastMilePhotoItem: {
  position: 'relative',
},
removePhotoButton: {
  position: 'absolute',
  top: -7,
  right: -7,
  width: 24,
  height: 24,
  borderRadius: 12,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#B91C1C',
  borderWidth: 2,
  borderColor: '#FFFFFF',
},
removePhotoButtonText: {
  fontSize: 12,
  fontWeight: '900',
  color: '#FFFFFF',
},
evidenceSizeText: {
  fontSize: 11,
  fontWeight: '800',
  color: '#137333',
},
deviceThumbnailBox: {
  alignItems: 'center',
  gap: 4,
},
deviceEvidenceSizeText: {
  fontSize: 10,
  fontWeight: '800',
  color: '#555',
},
detailQuickActions: {
  flexDirection: 'row',
  gap: 8,
},
detailQuickActionButton: {
  flex: 1,
  minHeight: 48,
  borderRadius: 13,
  borderWidth: 1,
  borderColor: '#d7eadf',
  backgroundColor: '#f4fbf7',
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  gap: 6,
},
detailQuickActionText: {
  fontSize: 12,
  fontWeight: '900',
  color: '#137333',
},
gpsAuditText: {
  alignSelf: 'flex-start',
  paddingVertical: 4,
  paddingHorizontal: 8,
  borderRadius: 999,
  fontSize: 11,
  fontWeight: '900',
  marginTop: 4,
},
gpsAuditOk: {
  backgroundColor: '#e8f5ee',
  color: '#137333',
},
gpsAuditWarning: {
  backgroundColor: '#fff3df',
  color: '#9a6200',
},
gpsAuditDanger: {
  backgroundColor: '#fdecec',
  color: '#b42318',
},
historyText: {
  fontSize: 12,
  color: '#555',
  lineHeight: 17,
},
serialInputRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
serialInput: {
  flex: 1,
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 13,
  backgroundColor: '#fff',
},
scanButton: {
  minHeight: 44,
  paddingHorizontal: 12,
  borderRadius: 12,
  alignItems: 'center',
  justifyContent: 'center',
  flexDirection: 'row',
  gap: 5,
  backgroundColor: '#137333',
},
scanButtonText: {
  fontSize: 12,
  fontWeight: '900',
  color: '#fff',
},
scannerRoot: {
  flex: 1,
  backgroundColor: '#000',
},
scannerCamera: {
  flex: 1,
},
scannerOverlay: {
  ...StyleSheet.absoluteFill,
  padding: 22,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0,0,0,0.25)',
},
scannerTitle: {
  position: 'absolute',
  top: 54,
  fontSize: 22,
  fontWeight: '900',
  color: '#fff',
},
scannerHelp: {
  position: 'absolute',
  top: 88,
  paddingHorizontal: 24,
  fontSize: 13,
  lineHeight: 18,
  fontWeight: '700',
  color: '#fff',
  textAlign: 'center',
},
scannerFrame: {
  width: 280,
  height: 170,
  borderWidth: 3,
  borderColor: '#fff',
  borderRadius: 18,
  backgroundColor: 'rgba(255,255,255,0.05)',
},
scannerCancelButton: {
  position: 'absolute',
  bottom: 42,
  minWidth: 160,
  paddingVertical: 13,
  paddingHorizontal: 18,
  borderRadius: 999,
  alignItems: 'center',
  backgroundColor: '#fff',
},
scannerCancelText: {
  fontSize: 14,
  fontWeight: '900',
  color: '#111',
},
});
