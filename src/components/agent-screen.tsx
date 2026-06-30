// src/components/agent-screen.tsx

import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AgentSideMenu } from '@/components/agent-side-menu';
import { TextIcon } from '@/components/text-icon';

type AgentScreenProps = {
  active: 'dashboard' | 'tasks' | 'managed' | 'profile';
  title: string;
  subtitle?: string;
  children: ReactNode;

  isRefreshing?: boolean;
  onRefresh?: () => Promise<void> | void;

  showSyncButton?: boolean;
  isSyncing?: boolean;
  onSyncPress?: () => Promise<void> | void;

  onMenuSynced?: () => Promise<void> | void;
};

export function AgentScreen({
  active,
  title,
  subtitle,
  children,
  isRefreshing = false,
  onRefresh,
  showSyncButton = true,
  isSyncing = false,
  onSyncPress,
  onMenuSynced,
}: AgentScreenProps) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.fixedHeader}>
        <AgentSideMenu active={active} onSynced={onMenuSynced} />

        <View style={styles.headerText}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>

          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {showSyncButton ? (
          <View style={styles.headerActions}>
            <Pressable
              style={styles.homeIconButton}
              onPress={() => router.push('/agent-dashboard' as Href)}
            >
              <TextIcon name="home" size={22} color="#137333" />
            </Pressable>

            <Pressable
              style={[
                styles.syncButton,
                isSyncing || !onSyncPress ? styles.syncButtonDisabled : null,
              ]}
              disabled={isSyncing || !onSyncPress}
              onPress={onSyncPress}
            >
              <TextIcon name="sync" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.syncPlaceholder} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fixedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
    backgroundColor: '#fff',
    zIndex: 10,
    elevation: 4,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 23,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.7,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  homeIconButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFE6CE',
    backgroundColor: '#F2FBF6',
  },
  syncButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#137333',
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncPlaceholder: {
    width: 92,
    height: 42,
  },
  content: {
    padding: 20,
    gap: 16,
  },
});
