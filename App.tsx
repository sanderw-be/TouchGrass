import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import 'expo-dev-client';
import { initDatabase, getSetting, setSetting } from './src/storage/database';
import i18n from './src/i18n';
import { initDetection } from './src/detection/index';
import { setupNotificationInfrastructure, scheduleDayReminders } from './src/notifications/notificationManager';
import { cleanupTouchGrassCalendars, maybeAddOutdoorTimeToCalendar } from './src/calendar/calendarService';

import AppNavigator from './src/navigation/AppNavigator';
import IntroScreen from './src/screens/IntroScreen';
import { IntroContext } from './src/context/IntroContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

enableScreens();

function AppContent() {
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const appState = useRef(AppState.currentState);

  // On app foreground: run calendar cleanup and write as a fallback for missed background tasks
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current !== 'active' && nextAppState === 'active') {
        const hasCompletedIntro = getSetting('hasCompletedIntro', '0') === '1';
        if (hasCompletedIntro) {
          cleanupTouchGrassCalendars().catch((e) => console.warn('TouchGrass: foreground calendar cleanup error:', e));
          maybeAddOutdoorTimeToCalendar(new Date()).catch((e) => console.warn('TouchGrass: foreground calendar write error:', e));
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
    return <IntroScreen onComplete={handleIntroComplete} />;
  }

  return (
    <IntroContext.Provider value={handleShowIntro}>
      <AppNavigator />
    </IntroContext.Provider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
