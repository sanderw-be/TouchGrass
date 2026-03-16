import React, { useEffect, useRef, Suspense, lazy } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import type { InitialState } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, AppState, ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import EventsScreen from '../screens/EventsScreen';
import GoalsScreen from '../screens/GoalsScreen';
import SettingsScreen from '../screens/SettingsScreen';
const WeatherSettingsScreen = lazy(() => import('../screens/WeatherSettingsScreen'));
const ScheduledNotificationsScreen = lazy(() => import('../screens/ScheduledNotificationsScreen'));
const KnownLocationsScreen = lazy(() => import('../screens/KnownLocationsScreen'));
const FeedbackSupportScreen = lazy(() => import('../screens/FeedbackSupportScreen'));
import { fetchWeatherForecast, isWeatherDataAvailable } from '../weather/weatherService';
import { getSetting } from '../storage/database';
import { spacing } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { t } from '../i18n';

export type SettingsStackParamList = {
  SettingsMain: undefined;
  WeatherSettings: undefined;
  ScheduledNotifications: undefined;
  KnownLocations: undefined;
  FeedbackSupport: undefined;
};

const Tab = createBottomTabNavigator();
const SettingsStack = createStackNavigator<SettingsStackParamList>();

function ScreenFallback() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.mist }}>
      <ActivityIndicator color={colors.grass} />
    </View>
  );
}

const icons: Record<string, string> = {
  Home: '🌿',
  History: '📊',
  Events: '📋',
  Goals: '🎯',
  Settings: '⚙️',
};

function SettingsStackNavigator() {
  const { colors } = useTheme();
  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.mist },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
        headerTintColor: colors.grass,
      }}
    >
      <SettingsStack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen
        name="WeatherSettings"
        options={{ title: t('nav_weather_settings') }}
      >
        {() => (
          <Suspense fallback={<ScreenFallback />}>
            <WeatherSettingsScreen />
          </Suspense>
        )}
      </SettingsStack.Screen>
      <SettingsStack.Screen
        name="ScheduledNotifications"
        options={{ title: t('settings_scheduled_reminders') }}
      >
        {() => (
          <Suspense fallback={<ScreenFallback />}>
            <ScheduledNotificationsScreen />
          </Suspense>
        )}
      </SettingsStack.Screen>
      <SettingsStack.Screen
        name="KnownLocations"
        options={{ title: t('nav_known_locations') }}
      >
        {() => (
          <Suspense fallback={<ScreenFallback />}>
            <KnownLocationsScreen />
          </Suspense>
        )}
      </SettingsStack.Screen>
      <SettingsStack.Screen
        name="FeedbackSupport"
        options={{ title: t('nav_feedback_support') }}
      >
        {() => (
          <Suspense fallback={<ScreenFallback />}>
            <FeedbackSupportScreen />
          </Suspense>
        )}
      </SettingsStack.Screen>
    </SettingsStack.Navigator>
  );
}

function TabNavigator() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.5 }}>
            {icons[route.name]}
          </Text>
        ),
        tabBarActiveTintColor: colors.grass,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.fog,
          borderTopWidth: 1,
          paddingBottom: Math.max(insets.bottom, spacing.xs),
          height: 60 + Math.max(insets.bottom - spacing.xs, 0),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: { backgroundColor: colors.mist },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('nav_home'), headerTitle: '🌱 TouchGrass' }}
      />
      <Tab.Screen
        name="Events"
        component={EventsScreen}
        options={{ title: t('nav_events') }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: t('nav_history') }}
      />
      <Tab.Screen
        name="Goals"
        component={GoalsScreen}
        options={{ title: t('nav_goals') }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{ title: t('nav_settings'), headerShown: false }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator({
  initialState,
  onStateChange,
}: {
  initialState?: InitialState;
  onStateChange?: (state: InitialState | undefined) => void;
}) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // When app comes to foreground, refresh weather if stale
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const weatherEnabled = getSetting('weather_enabled', '1') === '1';
        if (weatherEnabled && !isWeatherDataAvailable()) {
          try {
            await fetchWeatherForecast();
          } catch (error) {
            console.warn('Foreground weather refresh error:', error);
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer initialState={initialState} onStateChange={onStateChange}>
        <TabNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
