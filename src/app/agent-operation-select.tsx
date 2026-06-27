import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { classifyFieldError } from '@/application/errors/fieldError.service';
import { hardClearLocalAuth } from '@/application/auth/authSession.service';
import { downloadDevTasksToLocalCache } from '@/application/tasks/taskDownload.service';
import {
  getAgentOperationAvailability,
  type AgentOperationAvailability,
} from '@/application/tasks/taskQuery.service';
import {
  clearSelectedFieldOperation,
  setSelectedFieldOperation,
  type FieldOperationSelection,
} from '@/application/tasks/operationSelection.service';

export default function AgentOperationSelectScreen() {
  const [availability, setAvailability] = useState<AgentOperationAvailability>({
    inverse: 0,
    lastMile: 0,
  });
  const [selected, setSelected] = useState<FieldOperationSelection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadAvailability = useCallback(async () => {
    try {
      setIsLoading(true);

      const result = await getAgentOperationAvailability();

      setAvailability(result);

      if (result.inverse > 0 && result.lastMile === 0) {
        setSelected('inverse');
      } else if (result.lastMile > 0 && result.inverse === 0) {
        setSelected('last_mile');
      } else if (
        selected &&
        ((selected === 'inverse' && result.inverse === 0) ||
          (selected === 'last_mile' && result.lastMile === 0))
      ) {
        setSelected(null);
      }
    } catch (error) {
      const fieldError = classifyFieldError(error);
      Alert.alert(fieldError.title, fieldError.message);
    } finally {
      setIsLoading(false);
    }
  }, [selected]);

  useFocusEffect(
    useCallback(() => {
      loadAvailability();
    }, [loadAvailability])
  );

  function continueToDashboard() {
    if (!selected) {
      Alert.alert(
        'Seleccion requerida',
        'Elige el tipo de operacion que vas a realizar.'
      );
      return;
    }

    setSelectedFieldOperation(selected);
    router.replace('/agent-dashboard' as Href);
  }

  async function syncTasks() {
    try {
      setIsSyncing(true);

      const downloadResult = await downloadDevTasksToLocalCache();

      await loadAvailability();

      Alert.alert(
        'Tareas actualizadas',
        `Tareas recibidas: ${downloadResult.remoteTasksReceived}.\n` +
          `Insertadas: ${downloadResult.inserted}.\n` +
          `Actualizadas: ${downloadResult.updated}.`
      );
    } catch (error) {
      const fieldError = classifyFieldError(error);
      const detail = error instanceof Error ? error.message : String(error);

      Alert.alert(
        fieldError.title,
        `${fieldError.message}\n\nDetalle: ${detail}`
      );
    } finally {
      setIsSyncing(false);
    }
  }

  function confirmLogout() {
    Alert.alert(
      'Cerrar sesion',
      'Se cerrara la sesion local de este usuario.',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Cerrar sesion',
          style: 'destructive',
          onPress: async () => {
            try {
              clearSelectedFieldOperation();
              await hardClearLocalAuth();
              router.replace('/login' as Href);
            } catch (error) {
              const fieldError = classifyFieldError(error);
              Alert.alert(fieldError.title, fieldError.message);
            }
          },
        },
      ]
    );
  }

  const hasAnyTasks = availability.inverse > 0 || availability.lastMile > 0;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.card}>
        <Text style={styles.kicker}>RAYZATECH</Text>
        <Text style={styles.title}>Selecciona tu operacion</Text>
        <Text style={styles.subtitle}>
          Solo se habilitan las opciones donde tienes tareas cargadas para hoy o
          pendientes de liquidacion.
        </Text>

        <Pressable
          disabled={isSyncing || isLoading}
          style={[
            styles.syncButton,
            isSyncing || isLoading ? styles.syncButtonDisabled : null,
          ]}
          onPress={syncTasks}
        >
          {isSyncing ? (
            <ActivityIndicator color="#137333" />
          ) : (
            <Text style={styles.syncButtonText}>Sincronizar tareas</Text>
          )}
        </Pressable>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Revisando tareas asignadas...</Text>
          </View>
        ) : (
          <View style={styles.options}>
            <OperationCard
              title="Logistica inversa"
              description="Recupero de equipos y registro de series."
              count={availability.inverse}
              enabled={availability.inverse > 0}
              active={selected === 'inverse'}
              onPress={() => setSelected('inverse')}
            />

            <OperationCard
              title="Ultima milla"
              description="Recojos y entregas de mercaderia."
              count={availability.lastMile}
              enabled={availability.lastMile > 0}
              active={selected === 'last_mile'}
              onPress={() => setSelected('last_mile')}
            />
          </View>
        )}

        {!isLoading && !hasAnyTasks ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Sin tareas disponibles</Text>
            <Text style={styles.emptyText}>
              Sincroniza o solicita asignacion para continuar.
            </Text>
          </View>
        ) : null}

        <Pressable
          disabled={!selected || isLoading}
          style={[
            styles.primaryButton,
            !selected || isLoading ? styles.primaryButtonDisabled : null,
          ]}
          onPress={continueToDashboard}
        >
          <Text style={styles.primaryButtonText}>Continuar</Text>
        </Pressable>

        <Pressable style={styles.logoutButton} onPress={confirmLogout}>
          <Text style={styles.logoutButtonText}>Cerrar sesion</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function OperationCard({
  title,
  description,
  count,
  enabled,
  active,
  onPress,
}: {
  title: string;
  description: string;
  count: number;
  enabled: boolean;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={!enabled}
      onPress={onPress}
      style={[
        styles.operationCard,
        active ? styles.operationCardActive : null,
        !enabled ? styles.operationCardDisabled : null,
      ]}
    >
      <View style={styles.operationHeader}>
        <Text style={styles.operationTitle}>{title}</Text>
        <Text style={[styles.countBadge, active ? styles.countBadgeActive : null]}>
          {count}
        </Text>
      </View>
      <Text style={styles.operationDescription}>{description}</Text>
      <Text style={styles.operationStatus}>
        {enabled ? 'Disponible' : 'Sin tareas cargadas'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#F5F7F6',
  },
  card: {
    gap: 16,
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '900',
    color: '#137333',
    textAlign: 'center',
  },
  title: {
    fontSize: 25,
    fontWeight: '900',
    color: '#061A44',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#5C6675',
    textAlign: 'center',
  },
  syncButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFE6CE',
    borderRadius: 15,
    backgroundColor: '#F2FBF6',
  },
  syncButtonDisabled: {
    opacity: 0.65,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#137333',
  },
  loadingBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5C6675',
  },
  options: {
    gap: 10,
  },
  operationCard: {
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DDE3EA',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
  },
  operationCardActive: {
    borderColor: '#137333',
    backgroundColor: '#E8F5EE',
  },
  operationCardDisabled: {
    opacity: 0.45,
  },
  operationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  operationTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
  },
  countBadge: {
    minWidth: 32,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#EEF2F7',
    color: '#111827',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '900',
  },
  countBadgeActive: {
    backgroundColor: '#137333',
    color: '#FFFFFF',
  },
  operationDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4B5563',
  },
  operationStatus: {
    fontSize: 12,
    fontWeight: '900',
    color: '#137333',
  },
  emptyBox: {
    gap: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFF8E8',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#9A6200',
  },
  emptyText: {
    fontSize: 12,
    color: '#7A5200',
  },
  primaryButton: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#137333',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  logoutButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#EEEEEE',
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#333333',
  },
});
