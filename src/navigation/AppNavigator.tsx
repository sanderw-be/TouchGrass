import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import EventsScreen from '../screens/EventsScreen';
import GoalsScreen from '../screens/GoalsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ScheduledNotificationsScreen from '../screens/ScheduledNotificationsScreen';
import { colors, spacing } from '../utils/theme';
import { t } from '../i18n';

const Tab = createBottomTabNavigator();
const SettingsStack = createNativeStackNavigator();

const icons: Record<string, string> = {
  Home: '🌿',
  History: '📊',
  Events: '📋',
  Goals: '🎯',
  Settings: '⚙️',
};

function SettingsNavigator() {
  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.mist },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <SettingsStack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ title: t('nav_settings') }}
      />
      <SettingsStack.Screen
        name="ScheduledNotifications"
        component={ScheduledNotificationsScreen}
        options={{ title: t('scheduled_notifications_title') }}
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
        component={SettingsNavigator}
        options={{ title: t('nav_settings'), headerShown: false }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <TabNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
