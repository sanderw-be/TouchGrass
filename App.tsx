import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { enableScreens } from 'react-native-screens';
import 'expo-dev-client';
import { initDatabase, getSetting, setSetting } from './src/storage/database';
import i18n from './src/i18n';
import { initDetection } from './src/detection/index';
import { setupNotificationInfrastructure, scheduleDayReminders } from './src/notifications/notificationManager';
import AppNavigator from './src/navigation/AppNavigator';
import IntroScreen from './src/screens/IntroScreen';
import { colors } from './src/utils/theme';

enableScreens();

export default function App() {
  const [ready, setReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

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
          await scheduleDayReminders();
        } catch (e) {
          console.warn('Init error:', e);
        }
      }
    }
    init().then(() => setReady(true));
  }, []);

  const handleIntroComplete = async () => {
    setSetting('hasCompletedIntro', '1');
    setShowIntro(false);
    
    // Initialize detection after tutorial is complete
    try {
      await initDetection();
      await scheduleDayReminders();
    } catch (e) {
      console.warn('Post-tutorial init error:', e);
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

  return <AppNavigator />;
}
