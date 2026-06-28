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
import { listTaskManagementsByTask } from '@/infrastructure/db/repositories/taskManagementRepository';
import { getDisplayZone } from '@/shared/zones';
import { runDevSyncSimulation } from '@/sync/syncEngine';
import { Ionicons } from '@expo/vector-icons';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type TaskFilter = 'all' | 'pending' | 'completed' | 'unsuccessful';

type RouteGroup = {
  routeNumber: string;
  tasks: TaskListItem[];
};

export default function AgentTasksScreen() {
  const params = useLocalSearchParams<{ filter?: string }>();
  const initialFilter: TaskFilter =
    params.filter === 'all' ||
    params.filter === 'completed' ||
    params.filter === 'unsuccessful'
      ? params.filter
      : 'pending';
  const selectedOperation = getSelectedFieldOperation() ?? 'inverse';

  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [partialTaskIds, setPartialTaskIds] = useState<Set<string>>(new Set());
  const [expandedRoutes, setExpandedRoutes] = useState<Record<string, boolean>>(
    {}
  );
  const [activeFilter, setActiveFilter] = useState<TaskFilter>(initialFilter);
  const [searchText, setSearchText] = useState('');
  const [pendingLiquidationCount, setPendingLiquidationCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  async function handleError(error: unknown) {
    const fieldError = classifyFieldError(error);

    await appLogger.error({
      scope: 'AGENT_TASKS',
      message: fieldError.message,
      error,
      payload: { fieldError },
    });

    Alert.alert(fieldError.title, fieldError.message);
  }

  async function getPartialTaskIds(
    visibleTasks: TaskListItem[]
  ): Promise<Set<string>> {
    const checks = await Promise.all(
      visibleTasks.map(async (task) => {
        const managements = await listTaskManagementsByTask(task.id);
        const latestManagement = managements[0];
        const partialText = [
          latestManagement?.reason,
          latestManagement?.observation,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return partialText.includes('parcial') ? task.id : null;
      })
    );

    return new Set(checks.filter((taskId): taskId is string => taskId !== null));
  }

  function buildRouteGroups(visibleTasks: TaskListItem[]): RouteGroup[] {
    const groups = new Map<string, TaskListItem[]>();

    for (const task of visibleTasks) {
      const routeNumber = task.routeNumber?.trim() || 'Sin ruta';
      groups.set(routeNumber, [...(groups.get(routeNumber) ?? []), task]);
    }

    return [...groups.entries()].map(([routeNumber, routeTasks]) => ({
      routeNumber,
      tasks: routeTasks,
    }));
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

        const result = await listCachedTasks({
          status: filter === 'all' ? undefined : filter,
          search: trimmedSearch || undefined,
          fieldOperationType: operation,
        });

        setTasks(result);
        setPartialTaskIds(await getPartialTaskIds(result));
        setActiveFilter(filter);
      } catch (error) {
        await handleError(error);
      } finally {
        setIsLoading(false);
      }
    },
    [activeFilter, searchText, selectedOperation]
  );

  useFocusEffect(
    useCallback(() => {
      loadTasks(activeFilter, searchText);
    }, [loadTasks, activeFilter, searchText])
  );

  async function syncNow() {
    try {
      setIsLoading(true);

      const syncResult = await runDevSyncSimulation({
        limit: 100,
        forceFail: false,
      });

      const downloadResult = await downloadDevTasksToLocalCache();

      await loadTasks(activeFilter, searchText, selectedOperation);

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

  function openTask(taskId: string) {
    router.push(`/agent-task-detail?taskId=${encodeURIComponent(taskId)}` as Href);
  }

  async function callCustomer(phone?: string) {
    const cleanPhone = phone?.trim();

    if (!cleanPhone) {
      Alert.alert('Sin telefono', 'Esta tarea no tiene telefono registrado.');
      return;
    }

    await Linking.openURL(`tel:${cleanPhone}`);
  }

  async function messageCustomer(phone?: string) {
    const cleanPhone = phone?.replace(/\D/g, '');

    if (!cleanPhone) {
      Alert.alert('Sin telefono', 'Esta tarea no tiene telefono registrado.');
      return;
    }

    const whatsappPhone =
      cleanPhone.startsWith('51') ? cleanPhone : `51${cleanPhone}`;

    await Linking.openURL(`https://wa.me/${whatsappPhone}`);
  }

  async function openMap(task: TaskListItem) {
    const lat = Number(task.latitude);
    const lng = Number(task.longitude);
    const query =
      Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
        ? `${lat},${lng}`
        : [task.address, task.district, 'Peru'].filter(Boolean).join(', ');

    if (!query.trim()) {
      Alert.alert(
        'Sin ubicacion',
        'Esta tarea no tiene direccion ni coordenadas registradas.'
      );
      return;
    }

    await Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        query
      )}`
    );
  }

  function applySearch(text: string) {
    setSearchText(text);
    loadTasks(activeFilter, text, selectedOperation);
  }

  function toggleRoute(routeNumber: string, defaultExpanded: boolean) {
    setExpandedRoutes((current) => ({
      ...current,
      [routeNumber]: !(current[routeNumber] ?? defaultExpanded),
    }));
  }

  const routeGroups = buildRouteGroups(tasks);

  return (
    <AgentScreen
      active="tasks"
      title="Mis tareas"
      subtitle="Tareas por ruta"
      isRefreshing={isLoading}
      onRefresh={() => loadTasks(activeFilter, searchText, selectedOperation)}
      isSyncing={isLoading}
      onSyncPress={syncNow}
      onMenuSynced={() => loadTasks(activeFilter, searchText, selectedOperation)}
    >
      <TextInput
        value={searchText}
        onChangeText={applySearch}
        placeholder="Buscar por tarea, cliente, distrito, direccion..."
        style={styles.searchInput}
        autoCapitalize="none"
      />

      <View style={styles.filterContainer}>
        <FilterChip
          label="Todas"
          active={activeFilter === 'all'}
          onPress={() => loadTasks('all', searchText, selectedOperation)}
        />
        <FilterChip
          label="Pendientes"
          active={activeFilter === 'pending'}
          onPress={() => loadTasks('pending', searchText, selectedOperation)}
        />
        <FilterChip
          label="Exitosas"
          active={activeFilter === 'completed'}
          onPress={() => loadTasks('completed', searchText, selectedOperation)}
        />
        <FilterChip
          label="No exitosas"
          active={activeFilter === 'unsuccessful'}
          onPress={() => loadTasks('unsuccessful', searchText, selectedOperation)}
        />
      </View>

      {pendingLiquidationCount > 0 ? (
        <Pressable
          style={styles.liquidationAlert}
          onPress={() => router.push('/agent-liquidations' as Href)}
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
          Filtro: {getFilterLabel(activeFilter)} | Total mostrado: {tasks.length}
        </Text>
      </View>

      <View style={styles.listContainer}>
        {tasks.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No hay tareas para mostrar</Text>
            <Text style={styles.emptyText}>
              Sin tareas con el filtro o busqueda actual.
            </Text>
          </View>
        ) : (
          routeGroups.map((group) => {
            const defaultExpanded = routeGroups.length === 1;
            const isExpanded =
              expandedRoutes[group.routeNumber] ?? defaultExpanded;

            return (
              <View key={group.routeNumber} style={styles.routeGroupCard}>
                <Pressable
                  style={styles.routeGroupHeader}
                  onPress={() => toggleRoute(group.routeNumber, defaultExpanded)}
                >
                  <View style={styles.routeGroupTitleWrap}>
                    <Text style={styles.groupChevron}>
                      {isExpanded ? '▼' : '▶'}
                    </Text>
                    <Text style={styles.routeGroupTitle}>
                      Ruta {group.routeNumber}
                    </Text>
                  </View>
                  <Text style={styles.routeGroupCount}>
                    {group.tasks.length}
                  </Text>
                </Pressable>

                {isExpanded
                  ? group.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isPartial={partialTaskIds.has(task.id)}
                        onCall={() => callCustomer(task.customerPhone)}
                        onMessage={() => messageCustomer(task.customerPhone)}
                        onMap={() => openMap(task)}
                        onOpen={() => openTask(task.id)}
                      />
                    ))
                  : null}
              </View>
            );
          })
        )}
      </View>
    </AgentScreen>
  );
}

function getStatusLabel(status: TaskListItem['status'], isPartial: boolean) {
  if (status === 'completed') return 'Exitosa';
  if (status === 'unsuccessful') return 'No exitosa';
  if (status === 'rescheduled') return 'Reprogramada';
  if (status === 'in_progress') return 'En progreso';
  if (status === 'cancelled') return 'Cancelada';
  return 'Pendiente';
}

function getStatusBadgeStyle(status: TaskListItem['status'], isPartial: boolean) {
  if (status === 'completed' && isPartial) return styles.statusPartial;
  if (status === 'completed') return styles.statusCompleted;
  if (status === 'unsuccessful') return styles.statusUnsuccessful;
  return styles.statusPending;
}

function getTaskTypeLabel(task: TaskListItem): string {
  if (task.lastMileTaskType === 'delivery' || task.taskType === 'last_mile_delivery') {
    return 'Entrega';
  }

  if (task.lastMileTaskType === 'pickup' || task.taskType === 'last_mile_pickup') {
    return 'Recojo';
  }

  return task.taskType ?? 'Tarea';
}

function getFilterLabel(filter: TaskFilter): string {
  if (filter === 'pending') return 'Pendientes';
  if (filter === 'completed') return 'Exitosas';
  if (filter === 'unsuccessful') return 'No exitosas';
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
  isPartial,
  onCall,
  onMessage,
  onMap,
  onOpen,
}: {
  task: TaskListItem;
  isPartial: boolean;
  onCall: () => void;
  onMessage: () => void;
  onMap: () => void;
  onOpen: () => void;
}) {
  const location = getDisplayZone({
    zone: task.zone,
    department: task.department,
    province: task.province,
    district: task.district,
  });

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
        <Text
          style={[
            styles.statusBadge,
            getStatusBadgeStyle(task.status, isPartial),
          ]}
        >
          {getStatusLabel(task.status, isPartial)}
        </Text>
      </View>

      <Text style={styles.customerName} numberOfLines={1}>
        {task.customerName ?? 'Cliente sin nombre'}
      </Text>

      <Text style={styles.taskType}>{getTaskTypeLabel(task)}</Text>

      <Text style={styles.taskMeta} numberOfLines={1}>
        Cuenta/Proyecto: {task.orderCode ?? '-'} / {task.project ?? '-'}
      </Text>

      <Text style={styles.taskMeta} numberOfLines={1}>
        Telefono: {task.customerPhone ?? '-'}
      </Text>

      <Text style={styles.taskMeta} numberOfLines={1}>
        Ubicacion: {location}
      </Text>

      <Text style={styles.addressText} numberOfLines={2}>
        Direccion: {task.address ?? 'Direccion no registrada'}
      </Text>

      <Text style={styles.taskMeta} numberOfLines={1}>
        Cantidad bultos/items: {task.packageCount ?? '-'}
      </Text>

      {task.hasPendingLiquidation ? (
        <Text style={styles.dangerText}>
          Pedido con items pendiente de liquidar
        </Text>
      ) : null}

      {task.isDirty ? (
        <Text style={styles.warningText}>
          Tiene cambios pendientes de sincronizacion.
        </Text>
      ) : null}

      <View style={styles.quickActions}>
        <QuickAction iconName="call-outline" onPress={onCall} />
        <QuickAction iconName="logo-whatsapp" onPress={onMessage} />
        <QuickAction iconName="location-outline" onPress={onMap} />
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
  routeGroupCard: {
    gap: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#DDE3EA',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
  },
  routeGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routeGroupTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  groupChevron: {
    fontSize: 13,
    fontWeight: '900',
    color: '#061A44',
  },
  routeGroupTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#061A44',
  },
  routeGroupCount: {
    minWidth: 28,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#137333',
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '900',
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
  taskCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }],
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
    overflow: 'hidden',
  },
  statusPending: {
    backgroundColor: '#eeeeee',
    color: '#333333',
  },
  statusCompleted: {
    backgroundColor: '#e8f5ee',
    color: '#137333',
  },
  statusPartial: {
    backgroundColor: '#fff3df',
    color: '#9a6200',
  },
  statusUnsuccessful: {
    backgroundColor: '#fdecec',
    color: '#b42318',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '900',
  },
  taskType: {
    fontSize: 13,
    fontWeight: '900',
    color: '#061A44',
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
});
