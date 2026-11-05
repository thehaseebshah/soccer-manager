import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/ui/theme';
import { IconBtn, type IconName } from '@/ui/kit';

const tab = (name: string, title: string, icon: IconName, iconOff: IconName) => ({
  name,
  title,
  icon,
  iconOff,
});

const TABS = [
  tab('index', 'Home', 'home', 'home-outline'),
  tab('squad', 'Squad', 'people', 'people-outline'),
  tab('matchday', 'Matchday', 'football', 'football-outline'),
  tab('finance', 'Finance', 'cash', 'cash-outline'),
  tab('develop', 'Develop', 'trending-up', 'trending-up-outline'),
];

export default function TabsLayout() {
  const t = useTheme();
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.card },
        headerTintColor: t.text,
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => <IconBtn icon="settings-outline" label="Club settings" onPress={() => router.push('/settings')} />,
        headerRightContainerStyle: { paddingRight: 8 },
        tabBarActiveTintColor: t.primary,
        tabBarInactiveTintColor: t.textDim,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      {TABS.map((x) => (
        <Tabs.Screen
          key={x.name}
          name={x.name}
          options={{
            title: x.title,
            tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? x.icon : x.iconOff} size={size} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
