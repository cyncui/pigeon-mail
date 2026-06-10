import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Brand } from '@/constants/theme';
import { useAppFonts } from '@/hooks/use-app-fonts';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useAppFonts();

  // Cards and the stamp are dragged by our gestures; the browser must never
  // hijack a drag from an <img> into a native HTML5 image drag (its floating
  // ghost moves instead of the card). CSS `-webkit-user-drag: none` covers
  // Chromium/Safari (global.css); this covers Firefox.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener('dragstart', prevent);
    return () => document.removeEventListener('dragstart', prevent);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Brand.cream },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen
              name="create"
              options={{
                presentation: 'transparentModal',
                animation: 'none',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
