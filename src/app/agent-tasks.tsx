// src/app/agent-tasks.tsx

import { classifyFieldError } from '@/application/errors/fieldError.service';
import { appLogger } from '@/application/logging/appLogger.service';
import { downloadDevTasksToLocalCache } from '@/application/tasks/taskDownload.service';
import { getSelectedFieldOperation } from '@/application/tasks/operationSelection.service';
import {
  listCachedTasks,
  type TaskListItem,
} from '@/application/tasks/taskQuery.service';
import { AgentScreen } from '@/components/agent-screen';
import { getDisplayZone } from '@/shared/zones';
import { runDevSyncSimulation } from '@/sync/syncEngine';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type TaskFilter = 'pending' | 'in_progress' | 'completed' | 'all';

type CompletedGroupKey = 'completed' | 'unsuccessful' | 'rescheduled';

type CompletedGroup = {
  key: CompletedGroupKey;
  title: string;
  tasks: TaskListItem[];
};

export default function AgentTasksScreen() {
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [completedGroups, setCompletedGroups] = useState<CompletedGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<
    Record<CompletedGroupKey, boolean>
  >({
    completed: true,
    unsuccessful: false,
    rescheduled: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('pending');
  const selectedOperation = getSelectedFieldOperation() ?? 'inverse';
  const [searchText, setSearchText] = useState('');
  const [pendingLiquidationCount, setPendingLiquidationCount] = useState(0);

  async function handleError(error: unknown) {
    const fieldError = classifyFieldError(error);

    await appLogger.error({
      scope: 'AGENT_TASKS',
      message: fieldError.message,
      error,
      payload: {
        fieldError,
      },
    });

    Alert.alert(fieldError.title, fieldError.message);
  }

  function buildCompletedGroups(allTasks: TaskListItem[]): CompletedGroup[] {
    return [
      {
        key: 'completed',
        title: 'Exitosas / Completadas',
        tasks: allTasks.filter((task) => task.status === 'completed'),
      },
      {
        key: 'unsuccessful',
        title: 'No exitosas',
        tasks: allTasks.filter((task) => task.status === 'unsuccessful'),
      },
      {
        key: 'rescheduled',
        title: 'Reprogramadas',
        tasks: allTasks.filter((task) => task.status === 'rescheduled'),
      },
    ];
  }

  const loadTasks = useCallback(
    async (
      filter: TaskFilter = activeFilter,
      search: string = searchText,
      operation = selectedOperation
    ) => {
      try {
        setIsLoading(true);

        const trimmedSearch = search.trim();
        const allVisibleTasks = await listCachedTasks({
          search: trimmedSearch || undefined,
          fieldOperationType: operation,
        });

        setPendingLiquidationCount(
          allVisibleTasks.filter((task) => task.hasPendingLiquidation).length
        );

        if (filter === 'completed') {
          const result = await listCachedTasks({
            search: trimmedSearch || undefined,
            fieldOperationType: operation,
          });

          setCompletedGroups(buildCompletedGroups(result));
          setTasks([]);
          setActiveFilter(filter);
          return;
        }

        const result = await listCachedTasks({
          status: filter === 'all' ? undefined : filter,
          search: trimmedSearch || undefined,
          fieldOperationType: operation,
        });

        setTasks(result);
        setCompletedGroups([]);
        setActiveFilter(filter);
      } catch (error) {
        await handleError(error);
      } finally {
        setIsLoading(false);
      }
    },
    [activeFilter, selectedOperation, searchText]
  );

  useEffect(() => {
  loadTasks('pending', '');
}, [loadTasks]);

useFocusEffect(
  useCallback(() => {
    loadTasks(activeFilter, searchText);
  }, [loadTasks, activeFilter, searchText])
);

  async function syncNow() {
    try {
      setIsLoading(true);

      const downloadResult = await downloadDevTasksToLocalCache();

      const syncResult = await runDevSyncSimulation({
        limit: 100,
        forceFail: false,
      });

      await loadTasks(activeFilter, searchText, selectedOperation);

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

  function getStatusLabel(status: TaskListItem['status']): string {
    if (status === 'pending') {
      return 'Pendiente';
    }

    if (status === 'in_progress') {
      return 'En progreso';
    }

    if (status === 'completed') {
      return 'Completada';
    }

    if (status === 'unsuccessful') {
      return 'No exitosa';
    }

    if (status === 'rescheduled') {
      return 'Reprogramada';
    }

    if (status === 'cancelled') {
      return 'Cancelada';
    }

    return status;
  }

  function getPriorityLabel(priority?: TaskListItem['priority']): string {
    if (priority === 'urgent') {
      return 'Urgente';
    }

    if (priority === 'high') {
      return 'Alta';
    }

    if (priority === 'low') {
      return 'Baja';
    }

    return 'Normal';
  }

  function openTask(taskId: string) {
    router.push(`/agent-task-detail?taskId=${encodeURIComponent(taskId)}` as Href);
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

    const whatsappPhone =
      cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;

    await Linking.openURL(`https://wa.me/${whatsappPhone}`);
  }

  function hasValidCoordinates(
  latitude?: string | number | null,
  longitude?: string | number | null
): boolean {
  const lat = Number(latitude);
  const lng = Number(longitude);

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0
  );
}

async function openMap(task: TaskListItem) {
  const query = hasValidCoordinates(task.latitude, task.longitude)
    ? `${task.latitude},${task.longitude}`
    : [task.address, task.district, 'Perú'].filter(Boolean).join(', ');

  if (!query.trim()) {
    Alert.alert(
      'Sin ubicación',
      'Esta tarea no tiene dirección ni coordenadas registradas.'
    );
    return;
  }

  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;

  await Linking.openURL(url);
}

  function applySearch(text: string) {
    setSearchText(text);
    loadTasks(activeFilter, text, selectedOperation);
  }

  function toggleGroup(groupKey: CompletedGroupKey) {
    setExpandedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }));
  }

  const totalCompletedGrouped = completedGroups.reduce(
    (total, group) => total + group.tasks.length,
    0
  );

  return (
    <AgentScreen
      active="tasks"
      title="Mis tareas"
      subtitle="Tareas pendientes por ruta"
      isRefreshing={isLoading}
      onRefresh={() => loadTasks(activeFilter, searchText, selectedOperation)}
      isSyncing={isLoading}
      onSyncPress={syncNow}
      onMenuSynced={() => loadTasks(activeFilter, searchText, selectedOperation)}
    >
      <TextInput
        value={searchText}
        onChangeText={applySearch}
        placeholder="Buscar por tarea, cliente, distrito, dirección..."
        style={styles.searchInput}
        autoCapitalize="none"
      />

      <View style={styles.filterContainer}>
        <FilterChip
          label="Pendientes"
          active={activeFilter === 'pending'}
          onPress={() => loadTasks('pending', searchText, selectedOperation)}
        />
        <FilterChip
          label="En progreso"
          active={activeFilter === 'in_progress'}
          onPress={() => loadTasks('in_progress', searchText, selectedOperation)}
        />
      </View>

      {pendingLiquidationCount > 0 ? (
        <Pressable
          style={styles.liquidationAlert}
          onPress={() => router.push('/agent-managed-tasks' as unknown as Href)}
        >
          <Text style={styles.liquidationAlertTitle}>
            Tienes mercaderia pendiente de liquidar
          </Text>
          <Text style={styles.liquidationAlertText}>
            {pendingLiquidationCount} pedido(s) requieren cierre en almacen.
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.summaryBox}>
        <Text style={styles.summaryText}>
          Filtro: {getFilterLabel(activeFilter)} | Total mostrado:{' '}
          {activeFilter === 'completed' ? totalCompletedGrouped : tasks.length}
        </Text>
      </View>

      {activeFilter === 'completed' ? (
        <View style={styles.groupList}>
          {completedGroups.map((group) => {
            const isExpanded = expandedGroups[group.key];

            return (
              <View key={group.key} style={styles.groupCard}>
                <Pressable
                  onPress={() => toggleGroup(group.key)}
                  style={styles.groupHeader}
                >
                  <View style={styles.groupTitleWrap}>
                    <Text style={styles.groupChevron}>
                      {isExpanded ? '▼' : '▶'}
                    </Text>
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
                      <TaskCard
                        key={task.id}
                        task={task}
                        getStatusLabel={getStatusLabel}
                        getPriorityLabel={getPriorityLabel}
                        onCall={() => callCustomer(task.customerPhone)}
                        onMessage={() => messageCustomer(task.customerPhone)}
                        onMap={() => openMap(task)}
                        onOpen={() => openTask(task.id)}
                      />
                    ))
                  )
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.listContainer}>
          {tasks.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No hay tareas para mostrar</Text>
              <Text style={styles.emptyText}>
                Sin tareas con el filtro o búsqueda actual.
              </Text>
            </View>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                getStatusLabel={getStatusLabel}
                getPriorityLabel={getPriorityLabel}
                onCall={() => callCustomer(task.customerPhone)}
                onMessage={() => messageCustomer(task.customerPhone)}
                onMap={() => openMap(task)}
                onOpen={() => openTask(task.id)}
              />
            ))
          )}
        </View>
      )}

      <Pressable
        style={styles.homeButton}
        onPress={() => router.push('/agent-dashboard' as unknown as Href)}
      >
        <Text style={styles.homeButtonText}>Inicio</Text>
      </Pressable>
    </AgentScreen>
  );
}

function getStatusBadgeStyle(status: TaskListItem['status']) {
  if (status === 'completed') {
    return styles.statusCompleted;
  }

  if (status === 'unsuccessful') {
    return styles.statusUnsuccessful;
  }

  if (status === 'rescheduled') {
    return styles.statusRescheduled;
  }

  return styles.statusPending;
}

function getFilterLabel(filter: TaskFilter): string {
  if (filter === 'pending') {
    return 'Pendientes';
  }

  if (filter === 'in_progress') {
    return 'En progreso';
  }

  if (filter === 'completed') {
    return 'Completadas';
  }

  return 'Todas';
}

function FilterChip({
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
      onPress={onPress}
      style={[styles.filterChip, active ? styles.filterChipActive : null]}
    >
      <Text
        style={[
          styles.filterChipText,
          active ? styles.filterChipTextActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TaskCard({
  task,
  getStatusLabel,
  getPriorityLabel,
  onCall,
  onMessage,
  onMap,
  onOpen,
}: {
  task: TaskListItem;
  getStatusLabel: (status: TaskListItem['status']) => string;
  getPriorityLabel: (priority?: TaskListItem['priority']) => string;
  onCall: () => void;
  onMessage: () => void;
  onMap: () => void;
  onOpen: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.taskCard,
        pressed ? styles.taskCardPressed : null,
      ]}
      onPress={onOpen}
    >
      <View style={styles.taskHeader}>
        <Text style={styles.taskNumber}>{task.taskNumber ?? task.id}</Text>

        <Text style={[styles.statusBadge, getStatusBadgeStyle(task.status)]}>
  {getStatusLabel(task.status)}
</Text>
      </View>

            <Text style={styles.customerName} numberOfLines={1}>
        {task.customerName ?? 'Cliente sin nombre'}
      </Text>

      <Text style={styles.taskMeta} numberOfLines={1}>
        Proyecto/Tipo: {task.project ?? '-'} / {task.taskType ?? '-'}
      </Text>

      <View style={styles.infoRow}>
        {task.routeNumber ? (
          <Text style={styles.infoPill}>Ruta: {task.routeNumber}</Text>
        ) : null}

        {task.lastMileTaskType ? (
          <Text style={styles.infoPill}>
            {task.lastMileTaskType === 'delivery' ? 'Entrega' : 'Recojo'}
          </Text>
        ) : null}

        {task.packageCount ? (
          <Text style={styles.infoPill}>{task.packageCount} bultos/items</Text>
        ) : null}
      </View>

      <Text style={styles.taskMeta} numberOfLines={1}>
  Teléfono: {task.customerPhone ?? '-'}
</Text>

      <Text style={styles.taskMeta} numberOfLines={1}>
        Ubicación: {task.department ?? '-'} / {task.province ?? '-'} /{' '}
        {task.district ?? '-'}
      </Text>

      <Text style={styles.addressText} numberOfLines={2}>
        Dirección: {task.address ?? 'Dirección no registrada'}
      </Text>

      <Text style={styles.taskMeta} numberOfLines={1}>
        Zona: {getDisplayZone({
    zone: task.zone,
    department: task.department,
    province: task.province,
    district: task.district,
  })}
      </Text>

      {task.isDirty ? (
        <Text style={styles.warningText}>
          Tiene cambios locales pendientes de sincronización.
        </Text>
      ) : null}

      {task.isLocked ? (
        <Text style={styles.dangerText}>
          Bloqueada: {task.lockReason ?? 'Sin motivo registrado'}
        </Text>
      ) : null}

      {task.hasPendingLiquidation ? (
        <Text style={styles.dangerText}>
          Pedido con items pendiente de liquidar
        </Text>
      ) : null}

            <View style={styles.quickActions}>
        <QuickAction iconName="call-outline" onPress={onCall} />
        <QuickAction iconName="logo-whatsapp" onPress={onMessage} />
        <QuickAction iconName="location-outline" onPress={onMap} />
        <QuickAction iconName="eye-outline" onPress={onOpen} />
      </View>
    </Pressable>
  );
}

function QuickAction({
  iconName,
  onPress,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickActionButton} onPress={onPress}>
      <Ionicons name={iconName} size={18} color="#137333" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#eeeeee',
  },
  filterChipActive: {
    backgroundColor: '#137333',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#333',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  summaryBox: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f4f4f4',
  },
  summaryText: {
    fontSize: 13,
    opacity: 0.75,
  },
  liquidationAlert: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#f3b5b5',
    borderRadius: 12,
    backgroundColor: '#fff5f5',
    gap: 3,
  },
  liquidationAlertTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#9b1c1c',
  },
  liquidationAlertText: {
    fontSize: 12,
    color: '#9b1c1c',
  },
  listContainer: {
    gap: 12,
  },
  groupList: {
    gap: 12,
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
    padding: 18,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    gap: 6,
    backgroundColor: '#fff',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
    opacity: 0.7,
    lineHeight: 18,
  },
    taskCard: {
    padding: 11,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 13,
    backgroundColor: '#fff',
    gap: 5,
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
  fontSize: 12,
  fontWeight: '900',
  paddingVertical: 4,
  paddingHorizontal: 8,
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
    customerName: {
    fontSize: 15,
    fontWeight: '900',
  },
    taskMeta: {
    fontSize: 11,
    opacity: 0.78,
    lineHeight: 15,
  },
    addressText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoPill: {
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#f2f2f2',
  },
  warningText: {
    fontSize: 12,
    color: '#8a5a00',
    lineHeight: 17,
  },
  dangerText: {
    fontSize: 12,
    color: '#9b1c1c',
    lineHeight: 17,
  },
    quickActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 3,
  },
  quickActionButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#f3f3f3',
  },
  
  homeButton: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#eeeeee',
  },
  homeButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  
    taskCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }],
  },
});
