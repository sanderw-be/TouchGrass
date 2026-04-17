import React, { useRef } from 'react';
import type { InitialState } from '@react-navigation/native';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
import { IntroContext } from './src/context/IntroContext';
import { useTheme } from './src/context/ThemeContext';
import { LanguageContext } from './src/context/LanguageContext';
import UpdateSplashScreen from './src/components/UpdateSplashScreen';
import { useOTAUpdates } from './src/hooks/useOTAUpdates';
import { useAppInitialization } from './src/hooks/useAppInitialization';
import { AppProviders } from './src/components/AppProviders';

enableScreens();

function AppContent() {
  const { colors } = useTheme();
  const { updateStatus } = useOTAUpdates();
  const savedNavState = useRef<InitialState | undefined>(undefined);

  const { isReady, showIntro, locale, setLocale, handleShowIntro, handleIntroComplete } =
    useAppInitialization();

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
    return (
      <LanguageContext.Provider value={{ locale, setLocale }}>
        <IntroScreen key={locale} onComplete={handleIntroComplete} />
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      <IntroContext.Provider value={handleShowIntro}>
        <AppNavigator
          key={locale}
          initialState={savedNavState.current}
          onStateChange={(state) => {
            savedNavState.current = state;
          }}
        />
      </IntroContext.Provider>
    </LanguageContext.Provider>
  );
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
