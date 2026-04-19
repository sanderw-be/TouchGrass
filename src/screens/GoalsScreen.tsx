import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../utils/theme';
import { useAppStore } from '../store/useAppStore';
import { formatMinutes } from '../utils/helpers';
import { t } from '../i18n';
import type { GoalsStackParamList } from '../navigation/AppNavigator';
import PermissionExplainerSheet from '../components/PermissionExplainerSheet';
import RemindersSection from '../components/goals/RemindersSection';
import WeatherSection from '../components/goals/WeatherSection';
import CalendarSection from '../components/goals/CalendarSection';
import { makeStyles } from '../components/goals/GoalsShared';
import { useGoalTargets, DAILY_PRESETS, WEEKLY_PRESETS } from '../hooks/useGoalTargets';
import { useGoalIntegrations } from '../hooks/useGoalIntegrations';

import { Card } from '../components/ui';

export default function GoalsScreen() {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const locale = useAppStore((state) => state.locale);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const navigation = useNavigation<StackNavigationProp<GoalsStackParamList>>();

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: t('nav_goals') });
  }, [navigation, locale]);

  const insets = useSafeAreaInsets();

  const {
    dailyTarget,
    weeklyTarget,
    editingDaily,
    editingWeekly,
    customDaily,
    customWeekly,
    setEditingDaily,
    setEditingWeekly,
    setCustomDaily,
    setCustomWeekly,
    saveDaily,
    saveWeekly,
    loadGoals,
  } = useGoalTargets();

  const {
    smartRemindersCount,
    catchupRemindersCount,
    notificationPermissionGranted,
    batteryOptimizationGranted,
    weatherEnabled,
    weatherLocationGranted,
    calendarEnabled,
    calendarPermissionGranted,
    calendarBuffer,
    calendarDuration,
    calendarSelectedId,
    calendarOptions,
    permissionSheet,
    setPermissionSheet,
    goalsPermissionIssues,
    cycleSmartRemindersCount,
    cycleCatchupRemindersCount,
    toggleWeatherEnabled,
    showWeatherPermissionSheet,
    toggleCalendarIntegration,
    showCalendarPermissionSheet,
    cycleCalendarBuffer,
    cycleCalendarDuration,
    handleSelectCalendar,
    showNotificationPermissionSheet,
    showBatteryPermissionSheet,
  } = useGoalIntegrations();

  useFocusEffect(
    useCallback(() => {
      loadGoals();
    }, [loadGoals])
  );

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>{t('nav_goals')}</Text>
      </View>

      <KeyboardAwareScrollView style={styles.container} contentContainerStyle={styles.content}>
        {goalsPermissionIssues.length > 0 && (
          <View style={styles.permissionWarning}>
            <Text style={styles.permissionWarningText}>
              {t('permission_issues_banner', { features: goalsPermissionIssues.join(', ') })}
            </Text>
          </View>
        )}
        {/* WHO recommendation note */}
        <Card variant="tip" style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={18} color={colors.grassDark} style={styles.tipIcon} />
          <Text style={styles.tipText}>{t('goals_who_tip')}</Text>
        </Card>

        {/* Daily goal */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>{t('daily_goal')}</Text>
              <Text style={styles.cardValue}>{formatMinutes(dailyTarget)}</Text>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                setEditingDaily(!editingDaily);
                setEditingWeekly(false);
                setCustomDaily(String(dailyTarget));
              }}
            >
              <Text style={styles.editButtonText}>
                {editingDaily ? t('goals_cancel') : t('goals_edit')}
              </Text>
            </TouchableOpacity>
          </View>

          {editingDaily && (
            <View style={styles.editor}>
              <Text style={styles.editorLabel}>{t('goals_quick_select')}</Text>
              <View style={styles.presets}>
                {DAILY_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.preset, dailyTarget === p && styles.presetActive]}
                    onPress={() => saveDaily(p)}
                  >
                    <Text style={[styles.presetText, dailyTarget === p && styles.presetTextActive]}>
                      {formatMinutes(p)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.editorLabel}>{t('goals_custom_minutes')}</Text>
              <View style={styles.customRow}>
                <TextInput
                  style={styles.input}
                  value={customDaily}
                  onChangeText={setCustomDaily}
                  keyboardType="number-pad"
                  placeholder={t('goals_placeholder_daily')}
                  placeholderTextColor={colors.textMuted}
                  maxLength={4}
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={() => saveDaily(parseInt(customDaily, 10))}
                >
                  <Text style={styles.saveButtonText}>{t('goals_save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>

        {/* Weekly goal */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>{t('weekly_goal')}</Text>
              <Text style={styles.cardValue}>{formatMinutes(weeklyTarget)}</Text>
            </View>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                setEditingWeekly(!editingWeekly);
                setEditingDaily(false);
                setCustomWeekly(String(weeklyTarget));
              }}
            >
              <Text style={styles.editButtonText}>
                {editingWeekly ? t('goals_cancel') : t('goals_edit')}
              </Text>
            </TouchableOpacity>
          </View>

          {editingWeekly && (
            <View style={styles.editor}>
              <Text style={styles.editorLabel}>{t('goals_quick_select')}</Text>
              <View style={styles.presets}>
                {WEEKLY_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.preset, weeklyTarget === p && styles.presetActive]}
                    onPress={() => saveWeekly(p)}
                  >
                    <Text
                      style={[styles.presetText, weeklyTarget === p && styles.presetTextActive]}
                    >
                      {formatMinutes(p)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.editorLabel}>{t('goals_custom_minutes')}</Text>
              <View style={styles.customRow}>
                <TextInput
                  style={styles.input}
                  value={customWeekly}
                  onChangeText={setCustomWeekly}
                  keyboardType="number-pad"
                  placeholder={t('goals_placeholder_weekly')}
                  placeholderTextColor={colors.textMuted}
                  maxLength={5}
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={() => saveWeekly(parseInt(customWeekly, 10))}
                >
                  <Text style={styles.saveButtonText}>{t('goals_save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>

        {/* Reminders */}
        <RemindersSection
          smartRemindersCount={smartRemindersCount}
          catchupRemindersCount={catchupRemindersCount}
          notificationPermissionGranted={notificationPermissionGranted}
          batteryOptimizationGranted={batteryOptimizationGranted}
          onCycleSmartReminders={cycleSmartRemindersCount}
          onCycleCatchupReminders={cycleCatchupRemindersCount}
          onNavigateScheduledNotifications={() => navigation.navigate('ScheduledNotifications')}
          onShowNotificationPermissionSheet={showNotificationPermissionSheet}
          onShowBatteryPermissionSheet={showBatteryPermissionSheet}
        />

        {/* Weather */}
        <WeatherSection
          weatherEnabled={weatherEnabled}
          weatherLocationGranted={weatherLocationGranted}
          onToggleWeather={toggleWeatherEnabled}
          onShowWeatherPermissionSheet={showWeatherPermissionSheet}
          onNavigateWeatherSettings={() => navigation.navigate('WeatherSettings')}
        />

        {/* Calendar integration */}
        <CalendarSection
          calendarEnabled={calendarEnabled}
          calendarPermissionGranted={calendarPermissionGranted}
          calendarBuffer={calendarBuffer}
          calendarDuration={calendarDuration}
          calendarSelectedId={calendarSelectedId}
          calendarOptions={calendarOptions}
          onToggleCalendar={toggleCalendarIntegration}
          onCycleCalendarBuffer={cycleCalendarBuffer}
          onCycleCalendarDuration={cycleCalendarDuration}
          onSelectCalendar={handleSelectCalendar}
          onShowCalendarPermissionSheet={showCalendarPermissionSheet}
        />
      </KeyboardAwareScrollView>

      {permissionSheet && (
        <PermissionExplainerSheet
          visible
          title={permissionSheet.title}
          body={permissionSheet.body}
          openSettingsLabel={permissionSheet.openLabel}
          onOpenSettings={permissionSheet.onOpen}
          onDisable={permissionSheet.onDisable}
          disableLabel={permissionSheet.disableLabel}
          onCancel={permissionSheet.onCancel}
          onClose={() => setPermissionSheet(null)}
        />
      )}
    </>
  );
}
