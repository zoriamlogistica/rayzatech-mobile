// src/app/agent-dashboard.tsx

import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { classifyFieldError } from '@/application/errors/fieldError.service';
import { appLogger } from '@/application/logging/appLogger.service';
import { downloadDevTasksToLocalCache } from '@/application/tasks/taskDownload.service';
import { getAgentTaskSummary } from '@/application/tasks/taskQuery.service';
import { AgentScreen } from '@/components/agent-screen';
import { getSyncQueueCounters } from '@/infrastructure/db/repositories/syncQueueRepository';
import { addAutoSyncListener } from '@/sync/autoSyncService';
import { runDevSyncSimulation } from '@/sync/syncEngine';

type DashboardState = {
  totalTasks: number;
  pending: number;
  inProgress: number;
  completed: number;
  rescheduled: number;
  unsuccessful: number;
  sync: {
    totalPending: number;
    eligible: number;
    waitingRetry: number;
    conflicts: number;
  };
  loadedAt: string;
};

type OperationFilter = 'inverse' | 'last_mile';

function emptyDashboardState(): DashboardState {
  return {
  totalTasks: 0,
  pending: 0,
  inProgress: 0,
  completed: 0,
  rescheduled: 0,
  unsuccessful: 0,
    sync: {
      totalPending: 0,
      eligible: 0,
      waitingRetry: 0,
      conflicts: 0,
    },
    loadedAt: new Date().toISOString(),
  };
}



function formatDateTime(value: string): string {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function AgentDashboardScreen() {
  const [dashboard, setDashboard] = useState<DashboardState>(
    emptyDashboardState()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [operationFilter, setOperationFilter] = useState<OperationFilter>('inverse');

  async function handleError(error: unknown) {
    const fieldError = classifyFieldError(error);

    await appLogger.error({
      scope: 'AGENT_DASHBOARD',
      message: fieldError.message,
      error,
      payload: {
        fieldError,
      },
    });

    Alert.alert(fieldError.title, fieldError.message);
  }

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);

      const summary = await getAgentTaskSummary({
        fieldOperationType: operationFilter,
      });
      const syncCounters = await getSyncQueueCounters();

      setDashboard({
  totalTasks: summary.totalTasks,
  pending: summary.byStatus.pending,
inProgress: summary.byStatus.inProgress,
completed: summary.byStatus.completed,
rescheduled: summary.byStatus.rescheduled,
unsuccessful: summary.byStatus.unsuccessful,
  sync: syncCounters,
  loadedAt: new Date().toISOString(),
});
    } catch (error) {
      await handleError(error);
    } finally {
      setIsLoading(false);
    }
  }, [operationFilter]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useFocusEffect(
  useCallback(() => {
    loadDashboard();
  }, [loadDashboard])
);

  useEffect(() => {
  const unsubscribe = addAutoSyncListener((event) => {
    if (
      event.type === 'SYNC_FINISHED' ||
      event.type === 'SYNC_ERROR'
    ) {
      loadDashboard();
    }
  });

  return unsubscribe;
}, [loadDashboard]);

  async function syncNow() {
    try {
      setIsLoading(true);

      const downloadResult = await downloadDevTasksToLocalCache();

      const syncResult = await runDevSyncSimulation({
        limit: 100,
        forceFail: false,
      });

      await loadDashboard();

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

  const isSynced = dashboard.sync.totalPending === 0;
  const isLastMile = operationFilter === 'last_mile';

  return (
    <AgentScreen
      active="dashboard"
      title="RAYZATECH"
      subtitle="Panel del agente"
      isRefreshing={isLoading}
      onRefresh={loadDashboard}
      isSyncing={isLoading}
      onSyncPress={syncNow}
      onMenuSynced={loadDashboard}
    >
      <View style={styles.operationSelector}>
        <OperationChip
          label="Logistica inversa"
          active={operationFilter === 'inverse'}
          onPress={() => setOperationFilter('inverse')}
        />
        <OperationChip
          label="Ultima milla"
          active={operationFilter === 'last_mile'}
          onPress={() => setOperationFilter('last_mile')}
        />
      </View>

      <View
        style={[
          styles.statusCard,
          isSynced ? styles.statusCardOk : styles.statusCardWarning,
        ]}
      >
        <View style={styles.statusIconWrap}>
          <Text style={styles.statusIcon}>{isSynced ? '✓' : '!'}</Text>
        </View>

        <View style={styles.statusTextWrap}>
          <Text
            style={[
              styles.statusTitle,
              isSynced ? styles.statusTitleOk : styles.statusTitleWarning,
            ]}
          >
            {isSynced ? 'Todo al día' : 'Pendiente de sincronizar'}
          </Text>

          <Text style={styles.statusSubtitle}>
            {isSynced
              ? 'Tus datos están sincronizados'
              : `${dashboard.sync.totalPending} item(s) pendientes`}
          </Text>

          <Text style={styles.statusDate}>
            Última lectura: {formatDateTime(dashboard.loadedAt)}
          </Text>
        </View>
      </View>

      <View style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <View style={styles.cardIconWrap}>
              <Text style={styles.cardIcon}>📊</Text>
            </View>

            <Text style={styles.cardTitle}>
              {isLastMile ? 'Resumen ultima milla' : 'Resumen operativo'}
            </Text>
          </View>

          <Pressable
            style={styles.detailsButton}
            onPress={() => router.push('/agent-tasks' as Href)}
          >
            <Text style={styles.detailsButtonText}>Ver detalles ›</Text>
          </Pressable>
        </View>

        <View style={styles.metricsGrid}>
          <MetricCard
  label="Total"
  value={dashboard.totalTasks}
  icon="▣"
  tone="blue"
/>
<MetricCard
  label="Pendientes"
  value={dashboard.pending}
  icon="⏱"
  tone="amber"
/>
<MetricCard
  label="En progreso"
  value={dashboard.inProgress}
  icon="▶"
  tone="blue"
/>
<MetricCard
  label="Completadas"
  value={dashboard.completed}
  icon="✓"
  tone="green"
/>
<MetricCard
  label="Reprogramadas"
  value={dashboard.rescheduled}
  icon="↻"
  tone="amber"
/>
<MetricCard
  label="No exitosas"
  value={dashboard.unsuccessful}
  icon="×"
  tone="red"
/>
        </View>
      </View>

      <View style={styles.syncMiniCard}>
        <Text style={styles.syncMiniTitle}>Sincronización</Text>

        <View style={styles.syncMiniGrid}>
          <MiniSync label="Pendientes" value={dashboard.sync.totalPending} />
          <MiniSync label="Elegibles" value={dashboard.sync.eligible} />
          <MiniSync label="Reintento" value={dashboard.sync.waitingRetry} />
          <MiniSync label="Conflictos" value={dashboard.sync.conflicts} />
        </View>
      </View>
    </AgentScreen>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: string;
  tone: 'blue' | 'amber' | 'green' | 'red' | 'purple';
}) {
  const toneStyle = {
    blue: {
      icon: styles.metricIconBlue,
      value: styles.metricValueBlue,
    },
    amber: {
      icon: styles.metricIconAmber,
      value: styles.metricValueAmber,
    },
    green: {
      icon: styles.metricIconGreen,
      value: styles.metricValueGreen,
    },
    red: {
      icon: styles.metricIconRed,
      value: styles.metricValueRed,
    },
    purple: {
      icon: styles.metricIconPurple,
      value: styles.metricValuePurple,
    },
  }[tone];

  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIconWrap, toneStyle.icon]}>
        <Text style={styles.metricIcon}>{icon}</Text>
      </View>

      <Text style={[styles.metricValue, toneStyle.value]}>{value}</Text>
      <Text numberOfLines={1} style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  );
}

function MiniSync({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.syncMiniItem}>
      <Text style={styles.syncMiniValue}>{value}</Text>
      <Text style={styles.syncMiniLabel}>{label}</Text>
    </View>
  );
}

function OperationChip({
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
      style={[styles.operationChip, active ? styles.operationChipActive : null]}
    >
      <Text
        style={[
          styles.operationChipText,
          active ? styles.operationChipTextActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  operationSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  operationChip: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDE3EA',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  operationChipActive: {
    borderColor: '#137333',
    backgroundColor: '#E8F5EE',
  },
  operationChipText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#4B5563',
  },
  operationChipTextActive: {
    color: '#137333',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderRadius: 18,
    backgroundColor: '#F2FBF6',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statusCardOk: {
    borderColor: '#CFE8D9',
    backgroundColor: '#F2FBF6',
  },
  statusCardWarning: {
    borderColor: '#F4D79C',
    backgroundColor: '#FFF8E8',
  },
  statusIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: '#BFE6CE',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  statusIcon: {
    fontSize: 32,
    fontWeight: '900',
    color: '#11823B',
  },
  statusTextWrap: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  statusTitleOk: {
    color: '#11823B',
  },
  statusTitleWarning: {
    color: '#9A6200',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#4B5563',
  },
  statusDate: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
  mainCard: {
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF1FF',
  },
  cardIcon: {
    fontSize: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#061A44',
  },
  detailsButton: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D7E3FA',
    backgroundColor: '#F4F7FF',
  },
  detailsButtonText: {
    color: '#0B4FD8',
    fontSize: 12,
    fontWeight: '800',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '30.8%',
    minHeight: 112,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  metricIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIcon: {
    fontSize: 17,
    fontWeight: '900',
  },
  metricIconBlue: {
    backgroundColor: '#EAF1FF',
  },
  metricIconAmber: {
    backgroundColor: '#FFF3DF',
  },
  metricIconGreen: {
    backgroundColor: '#E8F8EF',
  },
  metricIconRed: {
    backgroundColor: '#FEECEC',
  },
  metricIconPurple: {
    backgroundColor: '#F2EAFE',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  metricValueBlue: {
    color: '#0B4FD8',
  },
  metricValueAmber: {
    color: '#F59E0B',
  },
  metricValueGreen: {
    color: '#11823B',
  },
  metricValueRed: {
    color: '#B42318',
  },
  metricValuePurple: {
    color: '#7C3AED',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
    textAlign: 'center',
  },
  syncMiniCard: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  syncMiniTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#061A44',
  },
  syncMiniGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  syncMiniItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F7F9FC',
  },
  syncMiniValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#061A44',
  },
  syncMiniLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
});
