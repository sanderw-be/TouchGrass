import React, { useMemo } from 'react';
import { Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { SettingRow, Divider, makeStyles, CATCHUP_REMINDERS_OPTIONS, Card } from './GoalsShared';

interface RemindersSectionProps {
  smartRemindersCount: number;
  catchupRemindersCount: number;
  notificationPermissionGranted: boolean;
  batteryOptimizationGranted: boolean;
  onCycleSmartReminders: () => void;
  onCycleCatchupReminders: () => void;
  onNavigateScheduledNotifications: () => void;
  onShowNotificationPermissionSheet: () => void;
  onShowBatteryPermissionSheet: () => void;
}

export default function RemindersSection({
  smartRemindersCount,
  catchupRemindersCount,
  notificationPermissionGranted,
  batteryOptimizationGranted,
  onCycleSmartReminders,
  onCycleCatchupReminders,
  onNavigateScheduledNotifications,
  onShowNotificationPermissionSheet,
  onShowBatteryPermissionSheet,
}: RemindersSectionProps) {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  const catchupRemindersLabels = useMemo<Record<number, string>>(
    () => ({
      [CATCHUP_REMINDERS_OPTIONS[0]]: t('settings_catchup_off'),
      [CATCHUP_REMINDERS_OPTIONS[1]]: t('settings_catchup_mellow'),
      [CATCHUP_REMINDERS_OPTIONS[2]]: t('settings_catchup_medium'),
      [CATCHUP_REMINDERS_OPTIONS[3]]: t('settings_catchup_aggressive'),
    }),
    []
  );

  return (
    <>
      <Text style={styles.sectionHeader}>{t('settings_section_reminders')}</Text>
      <Card variant="flat" style={{ padding: 0, overflow: 'hidden' }}>
        <TouchableOpacity
          onPress={
            smartRemindersCount > 0 && !notificationPermissionGranted
              ? onShowNotificationPermissionSheet
              : onCycleSmartReminders
          }
          testID="smart-reminders-row"
        >
          <SettingRow
            icon={<Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />}
            label={t('settings_reminders_label')}
            sublabel={
              smartRemindersCount > 0 && !notificationPermissionGranted ? (
                <Text style={{ color: colors.error }}>
                  {t('settings_notification_permission_missing')}
                </Text>
              ) : (
                t('settings_reminders_sublabel')
              )
            }
            right={
              <Text style={styles.valueChip}>
                {smartRemindersCount === 0
                  ? t('settings_reminders_count_off')
                  : t('settings_reminders_count_per_day', { count: smartRemindersCount })}
              </Text>
            }
          />
        </TouchableOpacity>
        <Divider />
        <TouchableOpacity onPress={onCycleCatchupReminders}>
          <SettingRow
            icon={<Ionicons name="flag-outline" size={20} color={colors.textSecondary} />}
            label={t('settings_catchup_label')}
            sublabel={t('settings_catchup_sublabel')}
            right={
              <Text style={styles.valueChip}>
                {catchupRemindersLabels[catchupRemindersCount] ?? t('settings_catchup_medium')}
              </Text>
            }
          />
        </TouchableOpacity>
        <Divider />
        <TouchableOpacity onPress={onNavigateScheduledNotifications}>
          <SettingRow
            icon={<Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />}
            label={t('settings_scheduled_reminders')}
            sublabel={t('settings_scheduled_reminders_sublabel')}
            right={<Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
          />
        </TouchableOpacity>
        {Platform.OS === 'android' && (
          <>
            <Divider />
            <TouchableOpacity
              onPress={onShowBatteryPermissionSheet}
              disabled={batteryOptimizationGranted}
              testID="battery-optimization-row"
              style={batteryOptimizationGranted && styles.disabledRow}
            >
              <SettingRow
                icon={
                  <Ionicons
                    name="battery-charging-outline"
                    size={20}
                    color={colors.textSecondary}
                  />
                }
                label={t('settings_battery_optimization')}
                sublabel={t('settings_battery_optimization_sublabel')}
                right={
                  batteryOptimizationGranted ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.grass} />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  )
                }
              />
            </TouchableOpacity>
          </>
        )}
      </Card>
    </>
  );
}
