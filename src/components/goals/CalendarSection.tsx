import React, { useMemo } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';
import { PermissionToggleRow, SettingRow, Divider, makeStyles, Card } from './GoalsShared';

interface CalendarSectionProps {
  calendarEnabled: boolean;
  calendarPermissionGranted: boolean;
  calendarBuffer: number;
  calendarDuration: number;
  calendarSelectedId: string;
  calendarOptions: { id: string; title: string }[];
  onToggleCalendar: (value: boolean) => void;
  onCycleCalendarBuffer: () => void;
  onCycleCalendarDuration: () => void;
  onSelectCalendar: () => void;
  onShowCalendarPermissionSheet: () => void;
}

export default function CalendarSection({
  calendarEnabled,
  calendarPermissionGranted,
  calendarBuffer,
  calendarDuration,
  calendarSelectedId,
  calendarOptions,
  onToggleCalendar,
  onCycleCalendarBuffer,
  onCycleCalendarDuration,
  onSelectCalendar,
  onShowCalendarPermissionSheet,
}: CalendarSectionProps) {
  const colors = useAppStore((state) => state.colors);
  const shadows = useAppStore((state) => state.shadows);
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);

  const hasAlternativeCalendars = calendarOptions.some(
    (c) => !c.title.toLowerCase().includes('touchgrass')
  );

  const calendarSelectedTitle = (): string => {
    if (!calendarSelectedId) return t('settings_calendar_select_touchgrass');
    const match = calendarOptions.find((c) => c.id === calendarSelectedId);
    return match?.title ?? t('settings_calendar_select_touchgrass');
  };

  return (
    <>
      <Text style={styles.sectionHeader}>{t('settings_section_calendar')}</Text>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <PermissionToggleRow
          icon={<Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />}
          label={t('settings_calendar_integration')}
          desc={t('settings_calendar_integration_desc')}
          permissionMissingLabel={t('settings_calendar_permission_missing')}
          enabled={calendarEnabled}
          permissionGranted={calendarPermissionGranted}
          onToggle={onToggleCalendar}
          onPermissionFix={onShowCalendarPermissionSheet}
        />
        {calendarEnabled && calendarPermissionGranted && (
          <>
            <Divider />
            <TouchableOpacity onPress={onCycleCalendarBuffer}>
              <SettingRow
                icon={<Ionicons name="timer-outline" size={20} color={colors.textSecondary} />}
                label={t('settings_calendar_buffer')}
                sublabel={t('settings_calendar_buffer_desc')}
                right={
                  <Text style={styles.valueChip}>
                    {t('settings_calendar_buffer_minutes', { minutes: calendarBuffer })}
                  </Text>
                }
              />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity onPress={onCycleCalendarDuration}>
              <SettingRow
                icon={<Ionicons name="time-outline" size={20} color={colors.textSecondary} />}
                label={t('settings_calendar_duration')}
                sublabel={t('settings_calendar_duration_desc')}
                right={
                  <Text style={styles.valueChip}>
                    {calendarDuration === 0
                      ? t('settings_calendar_duration_off')
                      : t('settings_calendar_duration_minutes', { minutes: calendarDuration })}
                  </Text>
                }
              />
            </TouchableOpacity>
            <Divider />
            <TouchableOpacity onPress={onSelectCalendar} disabled={!hasAlternativeCalendars}>
              <SettingRow
                icon={<Ionicons name="list-outline" size={20} color={colors.textSecondary} />}
                label={t('settings_calendar_select')}
                sublabel={t('settings_calendar_select_desc')}
                right={<Text style={styles.valueChip}>{calendarSelectedTitle()}</Text>}
              />
            </TouchableOpacity>
          </>
        )}
      </Card>
    </>
  );
}
