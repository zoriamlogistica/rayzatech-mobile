// src/app/agent-managed-tasks.tsx

import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { classifyFieldError } from '@/application/errors/fieldError.service';
import { appLogger } from '@/application/logging/appLogger.service';
import { downloadDevTasksToLocalCache } from '@/application/tasks/taskDownload.service';
import { getSelectedFieldOperation } from '@/application/tasks/operationSelection.service';
import {
  listCachedTasks,
  type TaskListItem,
} from '@/application/tasks/taskQuery.service';
import { AgentSideMenu } from '@/components/agent-side-menu';
import { TextIcon, type TextIconName } from '@/components/text-icon';
import { runDevSyncSimulation } from '@/sync/syncEngine';
import { SafeAreaView } from 'react-native-safe-area-context';

type ManagedGroupKey = 'completed' | 'unsuccessful' | 'rescheduled';

type ManagedGroup = {
  key: ManagedGroupKey;
  title: string;
  status: TaskListItem['status'];
  tasks: TaskListItem[];
};

export default function AgentManagedTasksScreen() {
  const [groups, setGroups] = useState<ManagedGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const selectedOperation = getSelectedFieldOperation() ?? 'inverse';
  const [searchText, setSearchText] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<ManagedGroupKey, boolean>>({
    completed: true,
    unsuccessful: false,
    rescheduled: false,
  });

  async function handleError(error: unknown) {
    const fieldError = classifyFieldError(error);

    await appLogger.error({
      scope: 'AGENT_MANAGED_TASKS',
      message: fieldError.message,
      error,
      payload: {
        fieldError,
      },
    });

    Alert.alert(fieldError.title, fieldError.message);
  }

  const loadManagedTasks = useCallback(async (search: string = searchText) => {
    try {
      setIsLoading(true);

      const allTasks = await listCachedTasks({
        search: search.trim() || undefined,
        fieldOperationType: selectedOperation,
      });

      const completed = allTasks.filter((task) => task.status === 'completed');
      const unsuccessful = allTasks.filter((task) => task.status === 'unsuccessful');
      const rescheduled = allTasks.filter((task) => task.status === 'rescheduled');

      setGroups([
        {
          key: 'completed',
          title: 'Exitosas / Completadas',
          status: 'completed',
          tasks: completed,
        },
        {
          key: 'unsuccessful',
          title: 'No exitosas',
          status: 'unsuccessful',
          tasks: unsuccessful,
        },
        {
          key: 'rescheduled',
          title: 'Reprogramadas',
          status: 'rescheduled',
          tasks: rescheduled,
        },
      ]);
    } catch (error) {
      await handleError(error);
    } finally {
      setIsLoading(false);
    }
  }, [searchText, selectedOperation]);

  useEffect(() => {
    loadManagedTasks('');
  }, []);

  async function syncNow() {
    try {
      setIsLoading(true);

      const downloadResult = await downloadDevTasksToLocalCache();

      const syncResult = await runDevSyncSimulation({
        limit: 100,
        forceFail: false,
      });

      await loadManagedTasks(searchText);

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

  function toggleGroup(groupKey: ManagedGroupKey) {
    setExpandedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }

  function openTask(taskId: string) {
    router.push(`/agent-task-detail?taskId=${encodeURIComponent(taskId)}` as Href);
  }

  function getSyncLabel(task: TaskListItem): string {
    if (task.syncStatus === 'synced') {
      return 'Sincronizada';
    }

    if (task.syncStatus === 'pending_sync') {
      return 'Pendiente de sincronizar';
    }

    if (task.syncStatus === 'syncing') {
      return 'Sincronizando';
    }

    if (task.syncStatus === 'sync_failed') {
      return 'Error de sincronización';
    }

    if (task.syncStatus === 'conflict') {
      return 'Conflicto';
    }

    return task.syncStatus;
  }

  async function callCustomer(phone?: string) {
    const cleanPhone = phone?.trim();

    if (!cleanPhone) {
      Alert.alert('Sin teléfono', 'Esta tarea no tiene teléfono registrado.');
      return;
    }

    await Linking.openURL(`tel:${cleanPhone}`);
  }

  async function messageCustomer(phone?: string) {
    const cleanPhone = phone?.replace(/\D/g, '');

    if (!cleanPhone) {
      Alert.alert('Sin teléfono', 'Esta tarea no tiene teléfono registrado.');
      return;
    }

    const whatsappPhone = cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;

    await Linking.openURL(`https://wa.me/${whatsappPhone}`);
  }

  async function openMap(task: TaskListItem) {
    const query = [task.address, task.district, 'Perú'].filter(Boolean).join(', ');

    if (!query.trim()) {
      Alert.alert('Sin dirección', 'Esta tarea no tiene dirección registrada.');
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      query
    )}`;

    await Linking.openURL(url);
  }

  function applySearch(text: string) {
    setSearchText(text);
    loadManagedTasks(text);
  }

  const totalManaged = groups.reduce((total, group) => total + group.tasks.length, 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => loadManagedTasks(searchText)} />
        }
      >
      <View style={styles.topBar}>
        <AgentSideMenu
          active="managed"
          onSynced={() => loadManagedTasks(searchText)}
        />

        <View style={styles.headerText}>
          <Text style={styles.title}>Tareas gestionadas</Text>
          <Text style={styles.subtitle}>
            Historial local agrupado por resultado.
          </Text>
        </View>

        <Pressable style={styles.syncButton} onPress={syncNow}>
          <Text style={styles.syncButtonText}>🔄</Text>
        </Pressable>
      </View>

      <TextInput
        value={searchText}
        onChangeText={applySearch}
        placeholder="Buscar por tarea, cliente, distrito, dirección..."
        style={styles.searchInput}
        autoCapitalize="none"
      />

      <View style={styles.summaryBox}>
        <Text style={styles.summaryText}>Total gestionadas: {totalManaged}</Text>
      </View>

      {groups.map((group) => {
        const isExpanded = expandedGroups[group.key];

        return (
          <View key={group.key} style={styles.groupCard}>
            <Pressable
              onPress={() => toggleGroup(group.key)}
              style={styles.groupHeader}
            >
              <View style={styles.groupTitleWrap}>
                <Text style={styles.groupChevron}>{isExpanded ? '▼' : '▶'}</Text>
                <Text style={styles.groupTitle}>{group.title}</Text>
              </View>

              <Text style={styles.groupCount}>{group.tasks.length}</Text>
            </Pressable>

            {isExpanded ? (
              group.tasks.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyText}>
                    No hay tareas en este grupo.
                  </Text>
                </View>
              ) : (
                group.tasks.map((task) => (
                  <View key={task.id} style={styles.taskCard}>
                    <View style={styles.taskHeader}>
                      <Text style={styles.taskNumber}>
                        {task.taskNumber ?? task.id}
                      </Text>

                      <Text style={styles.statusBadge}>{getSyncLabel(task)}</Text>
                    </View>

                    <Text style={styles.customerName}>
                      {task.customerName ?? 'Cliente sin nombre'}
                    </Text>

                    <Text style={styles.taskMeta}>
                      DNI/RUC: {task.customerDocument ?? '-'} | Tel:{' '}
                      {task.customerPhone ?? '-'}
                    </Text>

                    <Text style={styles.taskMeta}>
                      Distrito: {task.district ?? '-'}
                    </Text>

                    <Text style={styles.addressText}>
                      {task.address ?? 'Dirección no registrada'}
                    </Text>

                    {task.isDirty ? (
                      <Text style={styles.warningText}>
                        Gestión guardada localmente. Pendiente de sincronización.
                      </Text>
                    ) : null}

                    {task.syncStatus === 'synced' ? (
                      <Text style={styles.successText}>
                        Gestión sincronizada correctamente.
                      </Text>
                    ) : null}

                    <View style={styles.quickActions}>
                      <QuickAction
                        iconName="call"
                        label="Llamar"
                        onPress={() => callCustomer(task.customerPhone)}
                      />

                      <QuickAction
                        iconName="whatsapp"
                        label="WhatsApp"
                        onPress={() => messageCustomer(task.customerPhone)}
                      />

                      <QuickAction
                        iconName="location"
                        label="Mapa"
                        onPress={() => openMap(task)}
                      />

                      <QuickAction
                        iconName="eye"
                        label="Detalle"
                        onPress={() => openTask(task.id)}
                      />
                    </View>
                  </View>
                ))
              )
            ) : null}
          </View>
        );
      })}

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Volver</Text>
      </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  iconName,
  label,
  onPress,
}: {
  iconName: TextIconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickActionButton} onPress={onPress}>
      <TextIcon name={iconName} size={20} color="#137333" />
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 20,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 25,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.75,
    lineHeight: 18,
  },
  syncButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#137333',
  },
  syncButtonText: {
    fontSize: 20,
    color: '#fff',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  summaryBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f4f4f4',
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  groupCard: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 14,
    backgroundColor: '#fff',
    gap: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  groupChevron: {
    fontSize: 14,
    fontWeight: '900',
  },
  groupTitle: {
    fontSize: 17,
    fontWeight: '900',
    flex: 1,
  },
  groupCount: {
    fontSize: 13,
    fontWeight: '900',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#eee',
  },
  emptyBox: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f7f7f7',
  },
  emptyText: {
    fontSize: 13,
    opacity: 0.75,
  },
  taskCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fafafa',
    gap: 8,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  taskNumber: {
    fontSize: 16,
    fontWeight: '900',
    flex: 1,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#eee',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '800',
  },
  taskMeta: {
    fontSize: 12,
    opacity: 0.75,
  },
  addressText: {
    fontSize: 13,
    lineHeight: 18,
  },
  warningText: {
    fontSize: 12,
    color: '#8a5a00',
    lineHeight: 17,
  },
  successText: {
    fontSize: 12,
    color: '#137333',
    lineHeight: 17,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#f3f3f3',
  },
  quickActionIcon: {
    fontSize: 18,
  },
  quickActionLabel: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.75,
  },
  backButton: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#eeeeee',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
