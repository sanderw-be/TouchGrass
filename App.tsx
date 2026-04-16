import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { InitialState } from '@react-navigation/native';
import { View, ActivityIndicator, StyleSheet, InteractionManager } from 'react-native';
import { useFonts } from 'expo-font';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import 'expo-dev-client';
import { initDatabase, getSetting, setSetting } from './src/storage/database';
import i18n, { getDeviceSupportedLocale, SUPPORTED_LOCALES } from './src/i18n';
import { initDetection } from './src/detection/index';
import {
  setupNotificationInfrastructure,
  scheduleDayReminders,
} from './src/notifications/notificationManager';
import { registerUnifiedBackgroundTask } from './src/background/unifiedBackgroundTask';
import { scheduleNextAlarmPulse } from './src/background/alarmTiming';

import AppNavigator from './src/navigation/AppNavigator';
import { useForegroundSync } from './src/hooks/useForegroundSync';
import IntroScreen from './src/screens/IntroScreen';
import { IntroContext } from './src/context/IntroContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { LanguageContext } from './src/context/LanguageContext';
import { ReminderFeedbackProvider } from './src/context/ReminderFeedbackContext';
import ReminderFeedbackModal from './src/components/ReminderFeedbackModal';
import ErrorBoundary from './src/components/ErrorBoundary';
import UpdateSplashScreen from './src/components/UpdateSplashScreen';
import { useOTAUpdates } from './src/hooks/useOTAUpdates';
import { refreshBatteryOptimizationSetting } from './src/utils/batteryOptimization';
import { requestWidgetRefresh } from './src/utils/widgetHelper';

enableScreens();

function AppContent() {
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [locale, setLocaleState] = useState('system');
  const { updateStatus } = useOTAUpdates();
  const savedNavState = useRef<InitialState | undefined>(undefined);
  const deferredInitDone = useRef(false);

  const setLocale = useCallback((code: string) => {
    const languagePreference = code === 'system' ? 'system' : code;
    i18n.locale = languagePreference === 'system' ? getDeviceSupportedLocale() : languagePreference;
    setSetting('language', languagePreference);
    setLocaleState(languagePreference);
  }, []);

  useForegroundSync();

  // Critical-path init: only what is required before the first render.
  // Everything else is deferred to the post-render effect below.
  useEffect(() => {
    // Database must be ready before anything else
    initDatabase();

    // Apply stored language preference if available
    const storedLanguage = getSetting('language', 'system');
    if (storedLanguage === 'system') {
      i18n.locale = getDeviceSupportedLocale();
      setLocaleState('system');
    } else if (SUPPORTED_LOCALES.includes(storedLanguage as (typeof SUPPORTED_LOCALES)[number])) {
      i18n.locale = storedLanguage;
      setLocaleState(storedLanguage);
    } else {
      i18n.locale = 'en';
      setLocaleState('en');
      setSetting('language', 'en');
    }

    // Check if user has completed intro
    const hasCompletedIntro = getSetting('hasCompletedIntro', '0') === '1';
    setShowIntro(!hasCompletedIntro);

    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    refreshBatteryOptimizationSetting().catch((e) =>
      console.warn('Battery optimization status check error:', e)
    );
  }, [ready]);

  // Non-critical init: runs after the first interactive frame so it does not
  // block the loading spinner → navigator transition.
  useEffect(() => {
    if (!ready || showIntro || deferredInitDone.current) return;

    InteractionManager.runAfterInteractions(() => {
      // Double-check inside the callback: if `ready` or `showIntro` changed between
      // scheduling this callback and it executing (e.g. user tapped Show Intro quickly),
      // skip to avoid a duplicate run after the next state transition.
      if (deferredInitDone.current) return;
      deferredInitDone.current = true;

      (async () => {
        // Always set up notification infrastructure (needed for GPS background tracking)
        // but don't request permissions yet
        try {
          await setupNotificationInfrastructure();
        } catch (e) {
          console.warn('Notification infrastructure setup error:', e);
        }

        // Only initialize detection if tutorial is complete
        // Otherwise, permissions will be requested during tutorial
        try {
          await initDetection();
        } catch (e) {
          console.warn('Detection init error:', e);
        }

        try {
          await scheduleDayReminders();
        } catch (e) {
          console.warn('Day reminders error:', e);
        }

        // Reschedule any scheduled notifications (handles past notifications and ensures they're set for next occurrence)
        try {
          const { scheduleAllScheduledNotifications } =
            await import('./src/notifications/scheduledNotifications');
          await scheduleAllScheduledNotifications();
        } catch (e) {
          console.warn('Scheduled notifications init error:', e);
        }

        // Register the unified background task (reminders + weather)
        try {
          await registerUnifiedBackgroundTask();
        } catch (e) {
          console.warn('Background task registration error:', e);
        }

        // Arm the Pulsar alarm chain — the primary reliable background path.
        // Uses setExactAndAllowWhileIdle which bypasses WorkManager quotas.
        try {
          await scheduleNextAlarmPulse();
        } catch (e) {
          console.warn('TouchGrass: Alarm chain init error:', e);
        }

        // Push an initial widget update so the widget shows current data
        // immediately after the app is opened (safety net for post-update blank).
        try {
          await requestWidgetRefresh();
        } catch (e) {
          console.warn('TouchGrass: Initial widget refresh error:', e);
        }
      })();
    });
  }, [ready, showIntro]);

  const handleShowIntro = () => {
    setSetting('hasCompletedIntro', '0');
    setShowIntro(true);
  };

  const handleIntroComplete = () => {
    setSetting('hasCompletedIntro', '1');
    setShowIntro(false);
    // deferredInitDone is still false because the deferred init effect was
    // blocked while showIntro was true. It will fire automatically once
    // showIntro becomes false and the navigator is visible.
  };

  if (updateStatus !== 'ready') {
    return <UpdateSplashScreen status={updateStatus} />;
  }

  if (!ready) {
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <BottomSheetModalProvider>
          <SafeAreaProvider>
            <ErrorBoundary>
              <ThemeProvider>
                <ReminderFeedbackProvider>
                  <AppContent />
                  <ReminderFeedbackModal />
                </ReminderFeedbackProvider>
              </ThemeProvider>
            </ErrorBoundary>
          </SafeAreaProvider>
        </BottomSheetModalProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const appStyles = StyleSheet.create({
  fontLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
