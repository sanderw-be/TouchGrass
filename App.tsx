import 'expo-dev-client';
import React, { useEffect } from 'react';
import { enableScreens } from 'react-native-screens';
import { initDatabase } from './src/storage/database';
import { initDetection } from './src/detection/index';
import { setupNotifications, scheduleDayReminders } from './src/notifications/notificationManager';
import AppNavigator from './src/navigation/AppNavigator';

enableScreens();

export default function App() {
  useEffect(() => {
    initDatabase();

    const timer = setTimeout(async () => {
      // Init detection sources (Health Connect + GPS)
      await initDetection().catch((e) => console.warn('Detection init error:', e));

      // Set up notifications and schedule today's reminders
      await setupNotifications().catch((e) => console.warn('Notifications setup error:', e));
      await scheduleDayReminders().catch((e) => console.warn('Schedule reminders error:', e));
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return <AppNavigator />;
}
