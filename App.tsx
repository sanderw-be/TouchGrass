import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { InitialState } from '@react-navigation/native';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  AppState,
  AppStateStatus,
  InteractionManager,
} from 'react-native';
import { useFonts } from 'expo-font';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import 'expo-dev-client';
import { initDatabase, getSetting, setSetting } from './src/storage/database';
import i18n from './src/i18n';
import { initDetection } from './src/detection/index';
import {
  setupNotificationInfrastructure,
  scheduleDayReminders,
  processReminderQueue,
} from './src/notifications/notificationManager';
import { cleanupTouchGrassCalendars } from './src/calendar/calendarService';
import { registerUnifiedBackgroundTask } from './src/background/unifiedBackgroundTask';
import { scheduleNextAlarmPulse } from './src/background/alarmTiming';

import AppNavigator from './src/navigation/AppNavigator';
import IntroScreen from './src/screens/IntroScreen';
import { IntroContext } from './src/context/IntroContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { LanguageContext } from './src/context/LanguageContext';
import { ReminderFeedbackProvider } from './src/context/ReminderFeedbackContext';
import ReminderFeedbackModal from './src/components/ReminderFeedbackModal';
import ErrorBoundary from './src/components/ErrorBoundary';
import { refreshBatteryOptimizationSetting } from './src/utils/batteryOptimization';

enableScreens();

function AppContent() {
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [locale, setLocaleState] = useState(i18n.locale);
  const savedNavState = useRef<InitialState | undefined>(undefined);
  const appState = useRef(AppState.currentState);
  const deferredInitDone = useRef(false);

  const setLocale = useCallback((code: string) => {
    i18n.locale = code;
    setSetting('language', code);
    setLocaleState(code);
  }, []);

  // On app foreground: run day planning and goal-reached check as a catch-up
  // for missed background wakes, plus calendar cleanup.
  // Deferred via InteractionManager so the resumed UI frame renders first.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current !== 'active' && nextAppState === 'active') {
        const hasCompletedIntro = getSetting('hasCompletedIntro', '0') === '1';
        if (hasCompletedIntro) {
          refreshBatteryOptimizationSetting().catch((e) =>
            console.warn('Battery optimization status check error:', e)
          );
          InteractionManager.runAfterInteractions(() => {
            scheduleDayReminders().catch((e) =>
              console.warn('TouchGrass: foreground scheduleDayReminders error:', e)
            );
            processReminderQueue().catch((e) =>
              console.warn('TouchGrass: foreground processReminderQueue error:', e)
            );
            cleanupTouchGrassCalendars().catch((e) =>
              console.warn('TouchGrass: foreground calendar cleanup error:', e)
            );
            // Re-arm the Pulsar alarm chain on every foreground wake.
            // This keeps the chain alive and resets the timer from "now" so
            // the next tick fires ~15 min after the user last used the app.
            scheduleNextAlarmPulse().catch((e) =>
              console.warn('TouchGrass: foreground alarm re-arm error:', e)
            );
          });
          // Calendar events are only created by scheduleDayReminders() at planned
          // half-hour slots. Do NOT call maybeAddOutdoorTimeToCalendar(new Date())
          // here — it would create events at arbitrary foreground-wake times.
        }
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  // Critical-path init: only what is required before the first render.
  // Everything else is deferred to the post-render effect below.
  useEffect(() => {
    // Database must be ready before anything else
    initDatabase();

    // Apply stored language preference if available
    const storedLanguage = getSetting('language', '');
    if (['en', 'nl'].includes(storedLanguage)) {
      i18n.locale = storedLanguage;
      setLocaleState(storedLanguage);
    } else if (!storedLanguage) {
      setSetting('language', i18n.locale);
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
