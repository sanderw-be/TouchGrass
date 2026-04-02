import React, { useEffect, useRef, useState, useCallback, Suspense, lazy } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import type { InitialState } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { AppState, ActivityIndicator, View, Image, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import EventsScreen from '../screens/EventsScreen';
import GoalsScreen from '../screens/GoalsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { fetchWeatherForecast, isWeatherDataAvailable } from '../weather/weatherService';
import { getSetting, countProposedSessions } from '../storage/database';
import { countPermissionIssues } from '../utils/permissionIssues';
import { spacing } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { t } from '../i18n';
import { onSessionsChanged } from '../utils/sessionsChangedEmitter';
const WeatherSettingsScreen = lazy(() => import('../screens/WeatherSettingsScreen'));
const ScheduledNotificationsScreen = lazy(() => import('../screens/ScheduledNotificationsScreen'));
const KnownLocationsScreen = lazy(() => import('../screens/KnownLocationsScreen'));
const FeedbackSupportScreen = lazy(() => import('../screens/FeedbackSupportScreen'));

export type GoalsStackParamList = {
  GoalsMain: undefined;
  WeatherSettings: undefined;
  ScheduledNotifications: undefined;
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  KnownLocations: undefined;
  FeedbackSupport: undefined;
};

const Tab = createBottomTabNavigator();
const GoalsStack = createStackNavigator<GoalsStackParamList>();
const SettingsStack = createStackNavigator<SettingsStackParamList>();

function ScreenFallback() {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.mist,
      }}
    >
      <ActivityIndicator color={colors.grass} />
    </View>
  );
}

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'leaf-outline',
  History: 'bar-chart-outline',
  Events: 'list-outline',
  Goals: 'trophy-outline',
  Settings: 'settings-outline',
};

function HomeHeaderTitle() {
  const { colors } = useTheme();
  return (
    <View style={headerStyles.row}>
      <Image
        source={require('../../assets/seedling.png')}
        style={headerStyles.seedling}
        resizeMode="contain"
      />
      <Text style={[headerStyles.title, { color: colors.textPrimary }]}>TouchGrass</Text>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  seedling: { width: 22, height: 22 },
  title: { fontSize: 17, fontWeight: '700' },
});

function GoalsStackNavigator() {
  const { colors } = useTheme();
  return (
    <GoalsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.mist },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
        headerTintColor: colors.grass,
      }}
    >
      <GoalsStack.Screen
        name="GoalsMain"
        component={GoalsScreen}
        options={{ headerShown: false }}
      />
      <GoalsStack.Screen name="WeatherSettings" options={{ title: t('nav_weather_settings') }}>
        {() => (
          <Suspense fallback={<ScreenFallback />}>
            <WeatherSettingsScreen />
          </Suspense>
        )}
      </GoalsStack.Screen>
      <GoalsStack.Screen
        name="ScheduledNotifications"
        options={{ title: t('settings_scheduled_reminders') }}
      >
        {() => (
          <Suspense fallback={<ScreenFallback />}>
            <ScheduledNotificationsScreen />
          </Suspense>
        )}
      </GoalsStack.Screen>
    </GoalsStack.Navigator>
  );
}

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
      <SettingsStack.Screen name="KnownLocations" options={{ title: t('nav_known_locations') }}>
        {() => (
          <Suspense fallback={<ScreenFallback />}>
            <KnownLocationsScreen />
          </Suspense>
        )}
      </SettingsStack.Screen>
      <SettingsStack.Screen name="FeedbackSupport" options={{ title: t('nav_feedback_support') }}>
        {() => (
          <Suspense fallback={<ScreenFallback />}>
            <FeedbackSupportScreen />
          </Suspense>
        )}
      </SettingsStack.Screen>
    </SettingsStack.Navigator>
  );
}

function TabNavigator({
  goalsBadge,
  settingsBadge,
  eventsBadge,
}: {
  goalsBadge?: number;
  settingsBadge?: number;
  eventsBadge?: number;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => (
          <Ionicons name={icons[route.name]} size={focused ? 24 : 22} color={color} />
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
        options={{ title: t('nav_home'), headerTitle: () => <HomeHeaderTitle /> }}
      />
      <Tab.Screen
        name="Events"
        component={EventsScreen}
        options={{ title: t('nav_events'), tabBarBadge: eventsBadge }}
      />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: t('nav_history') }} />
      <Tab.Screen
        name="Goals"
        component={GoalsStackNavigator}
        options={{
          title: t('nav_goals'),
          headerShown: false,
          tabBarBadge: goalsBadge,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{
          title: t('nav_settings'),
          headerShown: false,
          tabBarBadge: settingsBadge,
        }}
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
  const [goalsBadge, setGoalsBadge] = useState<number | undefined>(undefined);
  const [settingsBadge, setSettingsBadge] = useState<number | undefined>(undefined);
  const [eventsBadge, setEventsBadge] = useState<number | undefined>(undefined);

  const refreshEventsBadge = useCallback(() => {
    try {
      const count = countProposedSessions();
      setEventsBadge(count > 0 ? count : undefined);
    } catch {
      // Badge refresh is best-effort; never crash the navigator
    }
  }, []);

  const refreshPermissionBadges = useCallback(async () => {
    try {
      const { goals, settings } = await countPermissionIssues();
      setGoalsBadge(goals > 0 ? goals : undefined);
      setSettingsBadge(settings > 0 ? settings : undefined);
    } catch (error) {
      // Permission checks are best-effort; never crash the navigator
      if (__DEV__) {
        console.warn('Permission badge refresh failed:', error);
      }
    }
  }, []);

  useEffect(() => {
    // Initial badge check
    refreshPermissionBadges();
    refreshEventsBadge();

    // Refresh events badge whenever sessions change (e.g. background sync)
    const unsubscribe = onSessionsChanged(refreshEventsBadge);

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // When app comes to foreground, refresh weather if stale and recheck permission badges
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const weatherEnabled = getSetting('weather_enabled', '1') === '1';
        if (weatherEnabled && !isWeatherDataAvailable()) {
          try {
            await fetchWeatherForecast();
          } catch (error) {
            console.warn('Foreground weather refresh error:', error);
          }
        }
        refreshPermissionBadges();
        refreshEventsBadge();
      }
      appState.current = nextAppState;
    });

    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, [refreshPermissionBadges, refreshEventsBadge]);

  return (
    <NavigationContainer initialState={initialState} onStateChange={onStateChange}>
      <TabNavigator
        goalsBadge={goalsBadge}
        settingsBadge={settingsBadge}
        eventsBadge={eventsBadge}
      />
    </NavigationContainer>
  );
}
