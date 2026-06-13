// src/components/agent-side-menu.tsx

import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { logoutLocalSession } from '@/application/auth/authSession.service';
import { classifyFieldError } from '@/application/errors/fieldError.service';
import { appLogger } from '@/application/logging/appLogger.service';
import { getCurrentLocalUserProfile } from '@/application/profile/userProfile.service';
import { downloadDevTasksToLocalCache } from '@/application/tasks/taskDownload.service';
import { runDevSyncSimulation } from '@/sync/syncEngine';

type AgentSideMenuProps = {
  active: 'dashboard' | 'tasks' | 'managed' | 'profile';
  onSynced?: () => Promise<void> | void;
};

export function AgentSideMenu({ active, onSynced }: AgentSideMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [agentName, setAgentName] = useState('Agente');

  useEffect(() => {
    let isMounted = true;

    async function loadAgentProfile() {
      try {
        const profile = await getCurrentLocalUserProfile();

        if (!isMounted) {
          return;
        }

        setAgentName(profile.fullName || 'Agente');
      } catch (error) {
        await appLogger.error({
          scope: 'AGENT_SIDE_MENU',
          message: 'No se pudo cargar el perfil local del agente.',
          error,
        });

        if (isMounted) {
          setAgentName('Agente');
        }
      }
    }

    loadAgentProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  function closeMenu() {
    setIsOpen(false);
  }

  function confirmLogout() {
  Alert.alert(
    'Cerrar sesión',
    'Se cerrará la sesión local del agente en este dispositivo.',
    [
      {
        text: 'Cancelar',
        style: 'cancel',
      },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          try {
            await logoutLocalSession();

            closeMenu();

            router.replace('/login' as unknown as Href);
          } catch (error) {
            const fieldError = classifyFieldError(error);

            await appLogger.error({
              scope: 'AGENT_SIDE_MENU',
              message: fieldError.message,
              error,
              payload: {
                fieldError,
                action: 'logout',
              },
            });

            Alert.alert(fieldError.title, fieldError.message);
          }
        },
      },
    ]
  );
}

   function goTo(path: string) {
    closeMenu();
    router.push(path as unknown as Href);
  }

  async function syncNow() {
    try {
      setIsSyncing(true);

      const downloadResult = await downloadDevTasksToLocalCache();

      const syncResult = await runDevSyncSimulation({
        limit: 100,
        forceFail: false,
      });

      await onSynced?.();

      Alert.alert(
        'Sincronización finalizada',
        `Tareas recibidas: ${downloadResult.remoteTasksReceived}.\n` +
          `Insertadas: ${downloadResult.inserted}.\n` +
          `Actualizadas: ${downloadResult.updated}.\n` +
          `Sincronizadas: ${syncResult.success}.\n` +
          `Pendientes: ${syncResult.remainingPending}.`
      );

      closeMenu();
    } catch (error) {
      const fieldError = classifyFieldError(error);

      await appLogger.error({
        scope: 'AGENT_SIDE_MENU',
        message: fieldError.message,
        error,
        payload: {
          fieldError,
        },
      });

      Alert.alert(fieldError.title, fieldError.message);
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <>
      <Pressable style={styles.menuButton} onPress={() => setIsOpen(true)}>
        <Text style={styles.menuButtonText}>☰</Text>
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={isOpen}
        onRequestClose={closeMenu}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closeMenu} />

          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>RAYZATECH</Text>
              <Text style={styles.drawerSubtitle}>Menú del agente</Text>
            </View>

                        <View style={styles.navList}>
              <MenuItem
                label="Dashboard"
                isActive={active === 'dashboard'}
                onPress={() => goTo('/agent-dashboard')}
              />

              <MenuItem
                label="Mis tareas"
                isActive={active === 'tasks' || active === 'managed'}
                onPress={() => goTo('/agent-tasks')}
              />

              <MenuItem
                label="Mi perfil"
                isActive={active === 'profile'}
                onPress={() => goTo('/agent-profile')}
              />

              <View style={styles.separator} />

              <MenuItem
                label={isSyncing ? 'Sincronizando...' : 'Sincronizar ahora'}
                isActive={false}
                onPress={syncNow}
                disabled={isSyncing}
              />

            </View>

            <View style={styles.footerBlock}>
              <Text style={styles.agentNameText} numberOfLines={1}>
  {agentName}
</Text>
              <Text style={styles.versionText}>By Rayza-Tech · v1.6</Text>

              <Pressable style={styles.closeButton} onPress={confirmLogout}>
  <Text style={styles.closeButtonText}>Cerrar sesión</Text>
</Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function MenuItem({
  label,
  isActive,
  onPress,
  disabled,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.menuItem,
        isActive ? styles.menuItemActive : null,
        disabled ? styles.menuItemDisabled : null,
      ]}
    >
      <Text
        style={[
          styles.menuItemText,
          isActive ? styles.menuItemTextActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#137333',
  },
  menuButtonText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
    drawer: {
    width: '78%',
    maxWidth: 340,
    minHeight: '100%',
    padding: 18,
    backgroundColor: '#fff',
    gap: 18,
  },
  drawerHeader: {
    paddingTop: 18,
    gap: 4,
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: '900',
  },
  drawerSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
    navList: {
    gap: 10,
  },
  footerBlock: {
    marginTop: 'auto',
    gap: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
  },
  agentNameText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#222',
  },
  versionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#777',
  },
  menuItem: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#f3f3f3',
  },
  menuItemActive: {
    backgroundColor: '#137333',
  },
  menuItemDisabled: {
    opacity: 0.6,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#222',
  },
  menuItemTextActive: {
    color: '#fff',
  },
  separator: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 4,
  },
    closeButton: {
    paddingVertical: 13,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#eee',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
});