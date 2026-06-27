// src/app/agent-profile.tsx

import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { classifyFieldError } from '@/application/errors/fieldError.service';
import { appLogger } from '@/application/logging/appLogger.service';
import { getCurrentLocalUserProfile } from '@/application/profile/userProfile.service';
import { downloadDevTasksToLocalCache } from '@/application/tasks/taskDownload.service';
import { getSelectedFieldOperation } from '@/application/tasks/operationSelection.service';

import { AgentScreen } from '@/components/agent-screen';
import { runDevSyncSimulation } from '@/sync/syncEngine';

type PeriodOption = {
  label: string;
  value: string;
};

type ProfileState = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  zone: string;

  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  unsuccessfulTasks: number;
  rescheduledTasks: number;
  recoveredDevices: number;

  loadedAt: string;
};

type RemoteProfileSummary = {
  period: string;
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  unsuccessfulTasks: number;
  rescheduledTasks: number;
  recoveredDevices: number;
  generatedAt: string;
};

function emptyProfileState(): ProfileState {
  return {
    fullName: 'Cargando perfil...',
    email: '-',
    phone: 'Pendiente backend',
    address: 'Pendiente backend',
    zone: 'Pendiente backend',

    totalTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    unsuccessfulTasks: 0,
    rescheduledTasks: 0,
    recoveredDevices: 0,

    loadedAt: new Date().toISOString(),
  };
}

function getLastTwelvePeriods(): PeriodOption[] {
  const formatter = new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    year: 'numeric',
  });

  const periods: PeriodOption[] = [];
  const current = new Date();

  for (let index = 0; index < 12; index += 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    const value = date.toISOString().slice(0, 7);

    const label = formatter.format(date).replace(/^\w/, (char) =>
      char.toUpperCase()
    );

    periods.push({
      label,
      value,
    });
  }

  return periods;
}


function calculatePercentage(value: number, total: number): string {
  if (total <= 0) {
    return '0%';
  }

  return `${Math.round((value / total) * 100)}%`;
}


async function fetchRemoteProfileSummary(
  accessToken: string,
  period: string
): Promise<RemoteProfileSummary> {
  const response = await fetch(
    `${process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL}/api/mobile/profile-summary?period=${encodeURIComponent(
      period
    )}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || 'No se pudo cargar el resumen operativo del perfil.'
    );
  }

  return data as RemoteProfileSummary;
}

export default function AgentProfileScreen() {
  const periods = useMemo(() => getLastTwelvePeriods(), []);
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]?.value ?? '');
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileState>(emptyProfileState());
  const [isLoading, setIsLoading] = useState(false);
  const selectedOperation = getSelectedFieldOperation() ?? 'inverse';
  const isLastMile = selectedOperation === 'last_mile';

  const selectedPeriodLabel =
    periods.find((period) => period.value === selectedPeriod)?.label ?? '-';

  async function handleError(error: unknown) {
    const fieldError = classifyFieldError(error);

    await appLogger.error({
      scope: 'AGENT_PROFILE',
      message: fieldError.message,
      error,
      payload: {
        fieldError,
      },
    });

    Alert.alert(fieldError.title, fieldError.message);
  }

  const loadProfile = useCallback(
    async (period: string = selectedPeriod) => {
      try {
        setIsLoading(true);

        const localProfile = await getCurrentLocalUserProfile();

if (!localProfile.session?.accessToken && !isLastMile) {
  throw new Error('No hay token activo para consultar el resumen operativo.');
}

const remoteSummary =
  !isLastMile && localProfile.session?.accessToken
    ? await fetchRemoteProfileSummary(localProfile.session.accessToken, period)
    : null;

        setProfile({
          fullName: localProfile.fullName,
          email: localProfile.email,
          phone: localProfile.user?.phone ?? '-',
address: localProfile.user?.address ?? '-',
zone: localProfile.user?.zone ?? '-',

          totalTasks: remoteSummary?.totalTasks ?? 0,
pendingTasks: remoteSummary?.pendingTasks ?? 0,
completedTasks: remoteSummary?.completedTasks ?? 0,
unsuccessfulTasks: remoteSummary?.unsuccessfulTasks ?? 0,
rescheduledTasks: remoteSummary?.rescheduledTasks ?? 0,
recoveredDevices: remoteSummary?.recoveredDevices ?? 0,

          loadedAt: new Date().toISOString(),
        });
      } catch (error) {
        await handleError(error);
      } finally {
        setIsLoading(false);
      }
    },
    [selectedPeriod, isLastMile]
  );

  useEffect(() => {
    loadProfile(selectedPeriod);
  }, [loadProfile, selectedPeriod]);

  async function syncNow() {
    try {
      setIsLoading(true);

      const downloadResult = await downloadDevTasksToLocalCache();

      const syncResult = await runDevSyncSimulation({
        limit: 100,
        forceFail: false,
      });

      await loadProfile(selectedPeriod);

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

  function selectPeriod(period: string) {
    setSelectedPeriod(period);
    setIsPeriodModalOpen(false);
    loadProfile(period);
  }

  function logoutLocalDev() {
    Alert.alert(
      'Cerrar sesión',
      'El cierre de sesión real se conectará al login final. Por ahora esta acción está pendiente de integración con backend.'
    );
  }

  return (
    <AgentScreen
      active="profile"
      title="Mi perfil"
      subtitle="Datos y resumen operativo"
      isRefreshing={isLoading}
      onRefresh={() => loadProfile(selectedPeriod)}
      isSyncing={isLoading}
      onSyncPress={syncNow}
      onMenuSynced={() => loadProfile(selectedPeriod)}
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos del agente</Text>

        <InfoRow label="Nombre" value={profile.fullName} />
        <InfoRow label="Correo" value={profile.email} />
        <InfoRow label="Teléfono" value={profile.phone} />
        <InfoRow label="Dirección" value={profile.address} />
        <InfoRow label="Zona" value={profile.zone} />
      </View>

      {!isLastMile ? (
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>Resumen operativo</Text>

          <Pressable
            style={styles.periodSelector}
            onPress={() => setIsPeriodModalOpen(true)}
          >
            <Text style={styles.periodSelectorText}>{selectedPeriodLabel}</Text>
            <Text style={styles.periodSelectorIcon}>▼</Text>
          </Pressable>
        </View>

        <View style={styles.summaryList}>
          <SummaryRow
            label="Total tareas"
            value={profile.totalTasks}
            total={profile.totalTasks}
            showPercentage={false}
          />

          <SummaryRow
            label="Pendientes"
            value={profile.pendingTasks}
            total={profile.totalTasks}
          />

          <SummaryRow
            label="Exitosas"
            value={profile.completedTasks}
            total={profile.totalTasks}
          />

          <SummaryRow
            label="No exitosas"
            value={profile.unsuccessfulTasks}
            total={profile.totalTasks}
          />

          <SummaryRow
            label="Reprogramadas"
            value={profile.rescheduledTasks}
            total={profile.totalTasks}
          />

          <SummaryRow
            label="Equipos recuperados"
            value={profile.recoveredDevices}
            total={profile.totalTasks}
            showPercentage={false}
          />
        </View>
      </View>
      ) : null}

      <View style={styles.actions}>
        <Button title="Cerrar sesión" onPress={logoutLocalDev} />
        <Button
          title="Inicio"
          onPress={() => router.push('/agent-dashboard' as unknown as Href)}
        />
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={isPeriodModalOpen}
        onRequestClose={() => setIsPeriodModalOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setIsPeriodModalOpen(false)}
          />

          <View style={styles.periodModal}>
            <Text style={styles.modalTitle}>Seleccionar periodo</Text>

            {periods.map((period) => (
              <Pressable
                key={period.value}
                style={[
                  styles.periodOption,
                  selectedPeriod === period.value
                    ? styles.periodOptionActive
                    : null,
                ]}
                onPress={() => selectPeriod(period.value)}
              >
                <Text
                  style={[
                    styles.periodOptionText,
                    selectedPeriod === period.value
                      ? styles.periodOptionTextActive
                      : null,
                  ]}
                >
                  {period.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </AgentScreen>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>
        {value || '-'}
      </Text>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  total,
  showPercentage = true,
}: {
  label: string;
  value: number;
  total: number;
  showPercentage?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>

      <View style={styles.summaryValueWrap}>
        <Text style={styles.summaryValue}>{value}</Text>

        {showPercentage ? (
          <Text style={styles.summaryPercent}>
            {calculatePercentage(value, total)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 14,
    backgroundColor: '#fff',
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  infoLabel: {
    width: 76,
    fontSize: 11,
    fontWeight: '800',
    opacity: 0.7,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 155,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#137333',
  },
  periodSelectorText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
  periodSelectorIcon: {
    fontSize: 10,
    color: '#fff',
  },
  summaryList: {
    gap: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  summaryValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  summaryPercent: {
    minWidth: 40,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
    color: '#137333',
  },
  actions: {
    gap: 8,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  periodModal: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fff',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },
  periodOption: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#f3f3f3',
  },
  periodOptionActive: {
    backgroundColor: '#137333',
  },
  periodOptionText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#222',
  },
  periodOptionTextActive: {
    color: '#fff',
  },
});
