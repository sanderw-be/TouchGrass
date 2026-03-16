import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import 'expo-dev-client';
import { initDatabase, getSetting, setSetting } from './src/storage/database';
import i18n from './src/i18n';
import { initDetection } from './src/detection/index';
import { setupNotificationInfrastructure, scheduleDayReminders, scheduleDailyPlannerWakeup, dismissDailyPlannerNotifications } from './src/notifications/notificationManager';
import { cleanupTouchGrassCalendars } from './src/calendar/calendarService';

import AppNavigator from './src/navigation/AppNavigator';
import IntroScreen from './src/screens/IntroScreen';
import { IntroContext } from './src/context/IntroContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { LanguageContext } from './src/context/LanguageContext';
import { ReminderFeedbackProvider } from './src/context/ReminderFeedbackContext';
import ReminderFeedbackModal from './src/components/ReminderFeedbackModal';
import ErrorBoundary from './src/components/ErrorBoundary';

enableScreens();

function AppContent() {
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [locale, setLocaleState] = useState(i18n.locale);
  const savedNavState = useRef<object | undefined>(undefined);
  const appState = useRef(AppState.currentState);

  const setLocale = useCallback((code: string) => {
    i18n.locale = code;
    setSetting('language', code);
    setLocaleState(code);
  }, []);

  // On app foreground: run calendar cleanup as a fallback for missed background tasks
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current !== 'active' && nextAppState === 'active') {
        const hasCompletedIntro = getSetting('hasCompletedIntro', '0') === '1';
        if (hasCompletedIntro) {
          cleanupTouchGrassCalendars().catch((e) => console.warn('TouchGrass: foreground calendar cleanup error:', e));
          // Calendar events are only created by scheduleDayReminders() at planned
          // half-hour slots. Do NOT call maybeAddOutdoorTimeToCalendar(new Date())
          // here — it would create events at arbitrary foreground-wake times.
        }
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    async function init() {
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

      // Always set up notification infrastructure (needed for GPS background tracking)
      // but don't request permissions yet
      try {
        await setupNotificationInfrastructure();
      } catch (e) {
        console.warn('Notification infrastructure setup error:', e);
      }

      // Only initialize detection if tutorial is complete
      // Otherwise, permissions will be requested during tutorial
      if (hasCompletedIntro) {
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
          const { scheduleAllScheduledNotifications } = await import('./src/notifications/scheduledNotifications');
          await scheduleAllScheduledNotifications();
        } catch (e) {
          console.warn('Scheduled notifications init error:', e);
        }

        // Schedule the 3 AM daily planner wake-up (survives force-close via AlarmManager)
        try {
          await scheduleDailyPlannerWakeup();
        } catch (e) {
          console.warn('Daily planner wakeup scheduling error:', e);
        }

        // Dismiss any daily planner notification still in the tray — scheduling
        // work is now complete so the notification has served its purpose.
        try {
          await dismissDailyPlannerNotifications();
        } catch (e) {
          console.warn('Daily planner dismiss error:', e);
        }

        // Register weather background fetch for hourly updates
        try {
          const { registerWeatherBackgroundFetch } = await import('./src/weather/weatherBackgroundTask');
          await registerWeatherBackgroundFetch();
        } catch (e) {
          console.warn('Weather background fetch error:', e);
        }
      }
    }
    init().then(() => setReady(true));
  }, []);

  const handleShowIntro = () => {
    setSetting('hasCompletedIntro', '0');
    setShowIntro(true);
  };

  const handleIntroComplete = async () => {
    setSetting('hasCompletedIntro', '1');
    setShowIntro(false);
    
    // Initialize detection after tutorial is complete
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
    
    try {
      const { scheduleAllScheduledNotifications } = await import('./src/notifications/scheduledNotifications');
      await scheduleAllScheduledNotifications();
    } catch (e) {
      console.warn('Scheduled notifications init error:', e);
    }

    // Schedule the 3 AM daily planner wake-up (survives force-close via AlarmManager)
    try {
      await scheduleDailyPlannerWakeup();
    } catch (e) {
      console.warn('Daily planner wakeup scheduling error:', e);
    }

    // Dismiss any daily planner notification still in the tray — scheduling
    // work is now complete so the notification has served its purpose.
    try {
      await dismissDailyPlannerNotifications();
    } catch (e) {
      console.warn('Daily planner dismiss error:', e);
    }

    // Register weather background fetch for hourly updates
    try {
      const { registerWeatherBackgroundFetch } = await import('./src/weather/weatherBackgroundTask');
      await registerWeatherBackgroundFetch();
    } catch (e) {
      console.warn('Weather background fetch error:', e);
    }
  };

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.mist }}>
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
          onStateChange={(state) => { savedNavState.current = state; }}
        />
      </IntroContext.Provider>
    </LanguageContext.Provider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <ReminderFeedbackProvider>
            <AppContent />
            <ReminderFeedbackModal />
          </ReminderFeedbackProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
