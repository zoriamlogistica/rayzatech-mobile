// src/components/agent-bottom-nav.tsx

import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type AgentBottomNavProps = {
  active: 'tasks' | 'managed' | 'profile';
};

export function AgentBottomNav({ active }: AgentBottomNavProps) {
  return (
    <View style={styles.container}>
      <NavItem
        label="Tareas"
        isActive={active === 'tasks'}
        onPress={() => router.push('/agent-tasks' as Href)}
      />

      <NavItem
        label="Gestionadas"
        isActive={active === 'managed'}
        onPress={() => router.push('/agent-managed-tasks' as unknown as Href)}
      />

      <NavItem
        label="Perfil"
        isActive={active === 'profile'}
        onPress={() => router.push('/agent-profile' as unknown as Href)}
      />
    </View>
  );
}

function NavItem({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.item, isActive ? styles.itemActive : null]}
    >
      <Text style={[styles.label, isActive ? styles.labelActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#f3f3f3',
  },
  itemActive: {
    backgroundColor: '#137333',
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#333',
  },
  labelActive: {
    color: '#fff',
  },
});