// src/app/agent-liquidations.tsx

import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
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
  listCachedTasks,
  type TaskListItem,
} from '@/application/tasks/taskQuery.service';
import { createSuccessfulManagementOffline } from '@/application/tasks/taskManagement.service';
import { AgentScreen } from '@/components/agent-screen';
import { markTaskLiquidated } from '@/infrastructure/db/repositories/taskRepository';
import { captureCurrentLocation } from '@/infrastructure/gps/locationService';
import { runDevSyncSimulation } from '@/sync/syncEngine';

const MAX_EVIDENCE_PHOTOS = 10;

type EvidencePreview = {
  id: string;
  uri: string;
};

function formatTaskType(task: TaskListItem) {
  return task.lastMileTaskType === 'pickup' ||
    task.taskType === 'last_mile_pickup'
    ? 'Recojo'
    : 'Entrega';
}

function formatLocation(task: TaskListItem) {
  return [task.department, task.province, task.district]
    .filter(Boolean)
    .join(' / ');
}

export default function AgentLiquidationsScreen() {
  const params = useLocalSearchParams<{ taskId?: string }>();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskListItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [receiverName, setReceiverName] = useState('');
  const [receiverDocument, setReceiverDocument] = useState('');
  const [receiverArea, setReceiverArea] = useState('');
  const [observations, setObservations] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<EvidencePreview[]>([]);

  async function handleError(error: unknown) {
    const fieldError = classifyFieldError(error);

    await appLogger.error({
      scope: 'AGENT_LIQUIDATIONS',
      message: fieldError.message,
      error,
      payload: { fieldError },
    });

    Alert.alert(fieldError.title, fieldError.message);
  }

  const loadPendingLiquidations = useCallback(async () => {
    try {
      setIsLoading(true);

      const allTasks = await listCachedTasks({
        fieldOperationType: 'last_mile',
      });
      const pendingTasks = allTasks.filter(
        (task) =>
          task.hasPendingLiquidation ||
          task.liquidationStatus === 'pending'
      );

      setTasks(pendingTasks);

      if (params.taskId && !selectedTask) {
        const taskFromParam = pendingTasks.find((task) => task.id === params.taskId);
        if (taskFromParam) {
          setSelectedTask(taskFromParam);
        }
      }
    } catch (error) {
      await handleError(error);
    } finally {
      setIsLoading(false);
    }
  }, [params.taskId, selectedTask]);

  useEffect(() => {
    loadPendingLiquidations();
  }, [loadPendingLiquidations]);

  function resetForm() {
    setSelectedTask(null);
    setReceiverName('');
    setReceiverDocument('');
    setReceiverArea('');
    setObservations('');
    setEvidencePhotos([]);
  }

  async function syncNow() {
    try {
      setIsLoading(true);

      const syncResult = await runDevSyncSimulation({
        limit: 100,
        forceFail: false,
      });
      const downloadResult = await downloadDevTasksToLocalCache();

      await loadPendingLiquidations();

      Alert.alert(
        'Sincronizacion finalizada',
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

  async function addEvidencePhoto() {
    if (!selectedTask) {
      return;
    }

    if (evidencePhotos.length >= MAX_EVIDENCE_PHOTOS) {
      Alert.alert(
        'Limite alcanzado',
        `Solo puedes registrar hasta ${MAX_EVIDENCE_PHOTOS} fotos.`
      );
      return;
    }

    try {
      setIsLoading(true);

      const result = await captureRealEvidenceForTaskOffline({
        taskId: selectedTask.id,
        evidenceType: 'recovery_proof',
      });

      if (!result) {
        return;
      }

      setEvidencePhotos((current) => [
        ...current,
        {
          id: result.evidence.id,
          uri: result.evidence.localUri,
        },
      ]);
    } catch (error) {
      await handleError(error);
    } finally {
      setIsLoading(false);
    }
  }

  function removeEvidencePhoto(evidenceId: string) {
    setEvidencePhotos((current) =>
      current.filter((photo) => photo.id !== evidenceId)
    );
  }

  async function liquidateSelectedTask() {
    if (!selectedTask) {
      return;
    }

    if (isSavingRef.current) {
      return;
    }

    if (!receiverName.trim()) {
      Alert.alert('Dato requerido', 'Ingresa el nombre de quien recibe.');
      return;
    }

    if (!receiverArea.trim()) {
      Alert.alert('Dato requerido', 'Ingresa el area o almacen de recepcion.');
      return;
    }

    if (evidencePhotos.length === 0) {
      Alert.alert('Evidencia requerida', 'Agrega al menos una foto de sustento.');
      return;
    }

    try {
      isSavingRef.current = true;
      setIsSaving(true);
      setIsLoading(true);

      const location = await captureCurrentLocation();
      const observationParts = [
        'Resultado ultima milla: Liquidado',
        'Subestado: Mercaderia liquidada en almacen',
        `Evidencias gestion: ${evidencePhotos.map((photo) => photo.id).join(',')}`,
        `Persona recepciona almacen: ${receiverName.trim()}`,
        receiverDocument.trim()
          ? `Documento receptor: ${receiverDocument.trim()}`
          : null,
        `Area/almacen: ${receiverArea.trim()}`,
        observations.trim()
          ? `Observaciones agente: ${observations.trim()}`
          : null,
      ].filter(Boolean);

      await createSuccessfulManagementOffline({
        taskId: selectedTask.id,
        observation: observationParts.join('\n'),
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        mocked: location.mocked,
        generalEvidenceId: evidencePhotos[0]?.id,
        managedBy: 'dev_agent_001',
      });

      await markTaskLiquidated(selectedTask.id);

      const syncResult = await runDevSyncSimulation({
        limit: 100,
        forceFail: false,
      });

      await downloadDevTasksToLocalCache();
      resetForm();
      await loadPendingLiquidations();

      Alert.alert(
        'Liquidacion registrada',
        syncResult.remainingPending === 0
          ? 'La liquidacion fue registrada y sincronizada.'
          : 'La liquidacion quedo registrada y pendiente de sincronizar.'
      );
    } catch (error) {
      await handleError(error);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      setIsLoading(false);
    }
  }

  const shownTasks = selectedTask ? [selectedTask] : tasks;

  return (
    <AgentScreen
      active="tasks"
      title="Liquidacion"
      subtitle="Mercaderia pendiente"
      isRefreshing={isLoading}
      isSyncing={isLoading}
      onRefresh={loadPendingLiquidations}
      onSyncPress={syncNow}
      onMenuSynced={loadPendingLiquidations}
    >
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>
          Pendientes de liquidar: {tasks.length}
        </Text>
        <Text style={styles.summaryText}>
          Selecciona un pedido, registra quien recibe y adjunta evidencias.
        </Text>
      </View>

      {shownTasks.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Sin pendientes</Text>
          <Text style={styles.emptyText}>
            No tienes mercaderia pendiente de liquidar.
          </Text>
        </View>
      ) : (
        shownTasks.map((task) => (
          <View key={task.id} style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <View style={styles.taskHeaderText}>
                <Text style={styles.taskNumber}>
                  {task.taskNumber ?? task.id}
                </Text>
                <Text style={styles.customerName}>{task.customerName}</Text>
              </View>
              <Text style={styles.typeBadge}>{formatTaskType(task)}</Text>
            </View>

            <Text style={styles.metaText}>
              Cuenta/Proyecto: {[task.orderCode, task.project]
                .filter(Boolean)
                .join(' / ') || '-'}
            </Text>
            <Text style={styles.metaText}>
              Ruta: {task.routeNumber || '-'}
            </Text>
            <Text style={styles.metaText}>
              Ubicacion: {formatLocation(task) || '-'}
            </Text>
            <Text style={styles.metaText}>
              Direccion: {task.address || '-'}
            </Text>
            <Text style={styles.metaText}>
              Bultos/items: {task.packageCount ?? '-'}
            </Text>

            {!selectedTask ? (
              <View style={styles.taskActions}>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() =>
                    router.push(
                      `/agent-task-detail?taskId=${encodeURIComponent(task.id)}` as Href
                    )
                  }
                >
                  <Text style={styles.secondaryButtonText}>Ver detalle</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => setSelectedTask(task)}
                >
                  <Text style={styles.primaryButtonText}>Liquidar</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))
      )}

      {selectedTask ? (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>
            Liquidar pedido {selectedTask.taskNumber ?? selectedTask.id}
          </Text>

          <TextInput
            style={styles.input}
            value={receiverName}
            onChangeText={setReceiverName}
            placeholder="Persona que recepciona"
          />
          <TextInput
            style={styles.input}
            value={receiverDocument}
            onChangeText={setReceiverDocument}
            placeholder="Documento receptor"
          />
          <TextInput
            style={styles.input}
            value={receiverArea}
            onChangeText={setReceiverArea}
            placeholder="Area o almacen"
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={observations}
            onChangeText={setObservations}
            placeholder="Observaciones"
            multiline
          />

          <Pressable
            style={styles.photoButton}
            onPress={addEvidencePhoto}
            disabled={isLoading || evidencePhotos.length >= MAX_EVIDENCE_PHOTOS}
          >
            <Text style={styles.photoButtonText}>
              + Agregar foto ({evidencePhotos.length}/{MAX_EVIDENCE_PHOTOS})
            </Text>
          </Pressable>

          {evidencePhotos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={styles.photoRow}
            >
              {evidencePhotos.map((photo, index) => (
                <View key={photo.id} style={styles.photoBox}>
                  <Image source={{ uri: photo.uri }} style={styles.photo} />
                  <Text style={styles.photoLabel}>Foto {index + 1}</Text>
                  <Pressable
                    style={styles.removePhotoButton}
                    onPress={() => removeEvidencePhoto(photo.id)}
                  >
                    <Text style={styles.removePhotoText}>X</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.formActions}>
            <Pressable
              style={styles.cancelButton}
              onPress={resetForm}
              disabled={isSaving}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[
                styles.confirmButton,
                isSaving || isLoading ? styles.disabledButton : null,
              ]}
              onPress={liquidateSelectedTask}
              disabled={isSaving || isLoading}
            >
              <Text style={styles.confirmButtonText}>
                {isSaving ? 'Guardando...' : 'Confirmar liquidacion'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </AgentScreen>
  );
}

const styles = StyleSheet.create({
  summaryBox: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff8e5',
    borderWidth: 1,
    borderColor: '#ffd98a',
    gap: 4,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#7a4b00',
  },
  summaryText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#5f4600',
  },
  emptyBox: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#f6f7f9',
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  taskCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    gap: 8,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  taskHeaderText: {
    flex: 1,
    gap: 2,
  },
  taskNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#081f49',
  },
  customerName: {
    fontSize: 14,
    fontWeight: '900',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e9f7ef',
    color: '#137333',
    fontWeight: '900',
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#374151',
  },
  taskActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#137333',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '900',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#eef2f7',
  },
  secondaryButtonText: {
    color: '#081f49',
    fontWeight: '900',
  },
  formCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d8e2dc',
    backgroundColor: '#f8fffb',
    gap: 10,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#081f49',
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
    fontSize: 14,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  photoButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#137333',
    backgroundColor: '#ecfdf3',
  },
  photoButtonText: {
    color: '#137333',
    fontWeight: '900',
  },
  photoRow: {
    gap: 10,
    paddingVertical: 4,
  },
  photoBox: {
    width: 92,
    position: 'relative',
    alignItems: 'center',
    gap: 4,
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: '#ddd',
  },
  photoLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b42318',
  },
  removePhotoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#eef2f7',
  },
  cancelButtonText: {
    fontWeight: '900',
  },
  confirmButton: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#137333',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.55,
  },
});
