import React, { useRef, useEffect, useCallback } from 'react';
import type { InitialState } from '@react-navigation/native';
import { View, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { enableScreens } from 'react-native-screens';
import 'expo-dev-client';

import AppNavigator from './src/navigation/AppNavigator';
import { useForegroundSync } from './src/hooks/useForegroundSync';
import IntroScreen from './src/screens/IntroScreen';
import UpdateSplashScreen from './src/components/UpdateSplashScreen';
import { useOTAUpdates } from './src/hooks/useOTAUpdates';
import { AppProviders } from './src/components/AppProviders';
import { useAppStore } from './src/store/useAppStore';

enableScreens();

function AppContent() {
  const colors = useAppStore((state) => state.colors);
  const isReady = useAppStore((state) => state.isReady);
  const showIntro = useAppStore((state) => state.showIntro);
  const handleIntroComplete = useAppStore((state) => state.handleIntroComplete);
  const initialize = useAppStore((state) => state.initialize);
  const setSystemColorScheme = useAppStore((state) => state.setSystemColorScheme);

  const systemColorScheme = useColorScheme();
  const { updateStatus } = useOTAUpdates();
  const savedNavState = useRef<InitialState | undefined>(undefined);

  const handleStateChange = useCallback((state: InitialState | undefined) => {
    savedNavState.current = state;
  }, []);

  // Initialize store on mount
  useEffect(() => {
    initialize(systemColorScheme);
  }, [initialize, systemColorScheme]);

  // Sync system theme changes to store
  useEffect(() => {
    setSystemColorScheme(systemColorScheme);
  }, [setSystemColorScheme, systemColorScheme]);

  useForegroundSync();

  if (updateStatus !== 'ready') {
    return <UpdateSplashScreen status={updateStatus} />;
  }

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.mist,
        }}
      >
        <ActivityIndicator size="large" color={colors.grass} />
      </View>
    );
  }

  if (showIntro) {
    return <IntroScreen onComplete={handleIntroComplete} />;
  }

  return <AppNavigator initialState={savedNavState.current} onStateChange={handleStateChange} />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={appStyles.fontLoadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

const appStyles = StyleSheet.create({
  fontLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
