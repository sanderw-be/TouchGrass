import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { enableScreens } from 'react-native-screens';
import 'expo-dev-client';
import { initDatabase } from './src/storage/database';
import { initDetection } from './src/detection/index';
import { setupNotifications, scheduleDayReminders } from './src/notifications/notificationManager';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/utils/theme';

enableScreens();

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      // Database must be ready before anything else
      initDatabase();

      // Everything else can init after render
      try {
        await initDetection();
        await setupNotifications();
        await scheduleDayReminders();
      } catch (e) {
        console.warn('Init error:', e);
      }
    }
    init().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.mist }}>
        <ActivityIndicator size="large" color={colors.grass} />
      </View>
    );
  }

  return <AppNavigator />;
}
