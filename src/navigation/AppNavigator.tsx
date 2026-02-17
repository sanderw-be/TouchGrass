import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import EventsScreen from '../screens/EventsScreen';
import GoalsScreen from '../screens/GoalsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WeatherSettingsScreen from '../screens/WeatherSettingsScreen';
import { fetchWeatherForecast, isWeatherDataAvailable } from '../weather/weatherService';
import { getSetting } from '../storage/database';
import { colors, spacing } from '../utils/theme';
import { t } from '../i18n';

export type SettingsStackParamList = {
  SettingsMain: undefined;
  WeatherSettings: undefined;
};

const Tab = createBottomTabNavigator();
const SettingsStack = createStackNavigator<SettingsStackParamList>();

const icons: Record<string, string> = {
  Home: '🌿',
  History: '📊',
  Events: '📋',
  Goals: '🎯',
  Settings: '⚙️',
};

function SettingsStackNavigator() {
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
        component={WeatherSettingsScreen}
        options={{ title: t('nav_weather_settings') }}
      />
    </SettingsStack.Navigator>
  );
}

function TabNavigator() {
  const insets = useSafeAreaInsets();

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
          backgroundColor: '#FFFFFF',
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

export default function AppNavigator() {
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
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
