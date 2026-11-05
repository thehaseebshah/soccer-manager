import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useClub } from '@/store/useClub';
import { useTheme } from '@/ui/theme';

export default function RootLayout() {
  const t = useTheme();
  const hydrated = useClub((s) => s.hydrated);
  const hasClub = useClub((s) => !!s.club);
  const segments = useSegments();
  const router = useRouter();
  const onWelcome = segments[0] === 'welcome';

  React.useEffect(() => {
    if (!hydrated) return;
    if (!hasClub && !onWelcome) router.replace('/welcome');
    else if (hasClub && onWelcome) router.replace('/');
  }, [hydrated, hasClub, onWelcome, router]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.primary} />
      </View>
    );
  }

  const header = {
    headerStyle: { backgroundColor: t.card },
    headerTintColor: t.text,
    headerTitleStyle: { fontWeight: '700' as const },
    contentStyle: { backgroundColor: t.bg },
  };

  return (
    <SafeAreaProvider>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={header}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Club settings', presentation: 'modal' }} />
        <Stack.Screen name="player/[id]" options={{ title: 'Player' }} />
        <Stack.Screen name="player/edit" options={{ title: 'Player', presentation: 'modal' }} />
        <Stack.Screen name="player/observe" options={{ title: 'New observation', presentation: 'modal' }} />
        <Stack.Screen name="fixture/[id]" options={{ title: 'Match plan' }} />
        <Stack.Screen name="fixture/edit" options={{ title: 'Fixture', presentation: 'modal' }} />
        <Stack.Screen name="fixture/live" options={{ title: 'Live match', gestureEnabled: false }} />
        <Stack.Screen name="training/[id]" options={{ title: 'Training' }} />
        <Stack.Screen name="scenario" options={{ title: 'Scenario lab' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
