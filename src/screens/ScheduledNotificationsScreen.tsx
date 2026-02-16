import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, Modal, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getScheduledNotifications,
  insertScheduledNotification,
  updateScheduledNotification,
  deleteScheduledNotification,
  toggleScheduledNotification,
  ScheduledNotification,
} from '../storage/database';
import { scheduleAllScheduledNotifications } from '../notifications/scheduledNotifications';
import { colors, spacing, radius, shadows } from '../utils/theme';
import { t } from '../i18n';

const DAYS_OF_WEEK = [
  { value: 0, label: 'day_sunday', short: 'day_sun' },
  { value: 1, label: 'day_monday', short: 'day_mon' },
  { value: 2, label: 'day_tuesday', short: 'day_tue' },
  { value: 3, label: 'day_wednesday', short: 'day_wed' },
  { value: 4, label: 'day_thursday', short: 'day_thu' },
  { value: 5, label: 'day_friday', short: 'day_fri' },
  { value: 6, label: 'day_saturday', short: 'day_sat' },
];

export default function ScheduledNotificationsScreen() {
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([]);
  const [editingNotification, setEditingNotification] = useState<ScheduledNotification | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const loadNotifications = useCallback(() => {
    const loaded = getScheduledNotifications();
    setNotifications(loaded);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const handleAddNotification = () => {
    setEditingNotification({
      hour: 9,
      minute: 0,
      daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
      enabled: true,
      label: '',
    });
    setIsCreating(true);
  };

  const handleEditNotification = (notification: ScheduledNotification) => {
    setEditingNotification({ ...notification });
    setIsCreating(false);
  };

  const handleToggle = (id: number, enabled: boolean) => {
    toggleScheduledNotification(id, enabled);
    loadNotifications();
    // Re-schedule all notifications
    scheduleAllScheduledNotifications();
  };

  const handleDelete = (notification: ScheduledNotification) => {
    Alert.alert(
      t('scheduled_notification_delete_confirm_title'),
      t('scheduled_notification_delete_confirm_body'),
      [
        { text: t('scheduled_notification_delete_cancel'), style: 'cancel' },
        {
          text: t('scheduled_notification_delete'),
          style: 'destructive',
          onPress: () => {
            if (notification.id) {
              deleteScheduledNotification(notification.id);
              loadNotifications();
              // Re-schedule all notifications
              scheduleAllScheduledNotifications();
            }
          },
        },
      ]
    );
  };

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const formatDays = (daysOfWeek: number[]) => {
    if (daysOfWeek.length === 7) {
      return t('scheduled_notification_all_days');
    }
    
    // Sort days and get short labels
    const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
    return sortedDays
      .map(day => t(DAYS_OF_WEEK[day].short))
      .join(', ');
  };

  return (
    <>
      <EditNotificationModal
        visible={editingNotification !== null}
        notification={editingNotification}
        isCreating={isCreating}
        onClose={() => setEditingNotification(null)}
        onSave={loadNotifications}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          {t('scheduled_notifications_empty')}
        </Text>

        {notifications.map((notification) => (
          <View key={notification.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.leftContent}>
                <Text style={styles.time}>
                  {formatTime(notification.hour, notification.minute)}
                </Text>
                {notification.label && (
                  <Text style={styles.label}>{notification.label}</Text>
                )}
                <Text style={styles.days}>{formatDays(notification.daysOfWeek)}</Text>
              </View>
              <View style={styles.rightContent}>
                <Switch
                  value={notification.enabled}
                  onValueChange={(value) => handleToggle(notification.id!, value)}
                  trackColor={{ false: colors.fog, true: colors.grassLight }}
                  thumbColor={notification.enabled ? colors.grass : colors.inactive}
                />
              </View>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => handleEditNotification(notification)}
              >
                <Text style={styles.editBtnText}>{t('settings_location_edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(notification)}
              >
                <Text style={styles.deleteBtnText}>{t('scheduled_notification_delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={handleAddNotification}>
          <Text style={styles.addButtonText}>+ {t('scheduled_notifications_add')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

// ── Edit Notification Modal ──────────────────────────────────────────────

interface EditModalProps {
  visible: boolean;
  notification: ScheduledNotification | null;
  isCreating: boolean;
  onClose: () => void;
  onSave: () => void;
}

function EditNotificationModal({ visible, notification, isCreating, onClose, onSave }: EditModalProps) {
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [label, setLabel] = useState('');
  const [hourText, setHourText] = useState('09');
  const [minuteText, setMinuteText] = useState('00');

  React.useEffect(() => {
    if (notification) {
      setHour(notification.hour);
      setMinute(notification.minute);
      setHourText(notification.hour.toString().padStart(2, '0'));
      setMinuteText(notification.minute.toString().padStart(2, '0'));
      setDaysOfWeek([...notification.daysOfWeek]);
      setLabel(notification.label || '');
    }
  }, [notification]);

  const handleSave = () => {
    if (daysOfWeek.length === 0) {
      Alert.alert(
        t('settings_error_title'),
        t('scheduled_notification_validation_no_days')
      );
      return;
    }

    const notificationData: ScheduledNotification = {
      hour,
      minute,
      daysOfWeek,
      enabled: true,
      label: label.trim() || undefined,
    };

    try {
      if (isCreating) {
        insertScheduledNotification(notificationData);
      } else if (notification?.id) {
        notificationData.id = notification.id;
        notificationData.enabled = notification.enabled;
        updateScheduledNotification(notificationData);
      }
      onSave();
      onClose();
      // Re-schedule all notifications
      scheduleAllScheduledNotifications();
    } catch (error) {
      console.error('Error saving scheduled notification:', error);
      Alert.alert(t('settings_error_title'), String(error));
    }
  };

  const toggleDay = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort((a, b) => a - b));
    }
  };

  const toggleAllDays = () => {
    if (daysOfWeek.length === 7) {
      setDaysOfWeek([]);
    } else {
      setDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
    }
  };

  if (!notification) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>{t('scheduled_notification_cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isCreating ? t('scheduled_notifications_add') : t('scheduled_notification_edit')}
          </Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.modalSave}>{t('scheduled_notification_save')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Time picker */}
          <Text style={styles.sectionLabel}>{t('scheduled_notification_time')}</Text>
          <View style={styles.timePickerContainer}>
            <View style={styles.timePicker}>
              <TextInput
                style={styles.timeInput}
                value={hourText}
                onChangeText={(text) => {
                  setHourText(text);
                  const value = parseInt(text, 10);
                  if (!isNaN(value) && value >= 0 && value < 24) {
                    setHour(value);
                  }
                }}
                onBlur={() => {
                  // Ensure proper formatting when user leaves the field
                  const value = parseInt(hourText, 10);
                  if (isNaN(value) || value < 0 || value >= 24) {
                    setHourText(hour.toString().padStart(2, '0'));
                  } else {
                    setHourText(value.toString().padStart(2, '0'));
                    setHour(value);
                  }
                }}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
              <Text style={styles.timeSeparator}>:</Text>
              <TextInput
                style={styles.timeInput}
                value={minuteText}
                onChangeText={(text) => {
                  setMinuteText(text);
                  const value = parseInt(text, 10);
                  if (!isNaN(value) && value >= 0 && value < 60) {
                    setMinute(value);
                  }
                }}
                onBlur={() => {
                  // Ensure proper formatting when user leaves the field
                  const value = parseInt(minuteText, 10);
                  if (isNaN(value) || value < 0 || value >= 60) {
                    setMinuteText(minute.toString().padStart(2, '0'));
                  } else {
                    setMinuteText(value.toString().padStart(2, '0'));
                    setMinute(value);
                  }
                }}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
              />
            </View>
          </View>

          {/* Days of week */}
          <Text style={styles.sectionLabel}>{t('scheduled_notification_days')}</Text>
          <View style={styles.daysContainer}>
            <TouchableOpacity
              style={[styles.allDaysBtn, daysOfWeek.length === 7 && styles.allDaysBtnActive]}
              onPress={toggleAllDays}
            >
              <Text style={[styles.allDaysText, daysOfWeek.length === 7 && styles.allDaysTextActive]}>
                {t('scheduled_notification_all_days')}
              </Text>
            </TouchableOpacity>
            {DAYS_OF_WEEK.map((day) => (
              <TouchableOpacity
                key={day.value}
                style={[
                  styles.dayButton,
                  daysOfWeek.includes(day.value) && styles.dayButtonActive,
                ]}
                onPress={() => toggleDay(day.value)}
              >
                <Text
                  style={[
                    styles.dayButtonText,
                    daysOfWeek.includes(day.value) && styles.dayButtonTextActive,
                  ]}
                >
                  {t(day.label)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Optional label */}
          <Text style={styles.sectionLabel}>{t('scheduled_notification_label')}</Text>
          <TextInput
            style={styles.labelInput}
            value={label}
            onChangeText={setLabel}
            placeholder={t('scheduled_notification_label_placeholder')}
            placeholderTextColor={colors.textMuted}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Styles ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  content: {
    padding: spacing.md,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.sand,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  leftContent: {
    flex: 1,
  },
  rightContent: {
    marginLeft: spacing.md,
  },
  time: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  days: {
    fontSize: 13,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.fog,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  editBtnText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  deleteBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.sand,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 14,
    color: colors.error,
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: colors.grass,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadows.soft,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.fog,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalCancel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalSave: {
    fontSize: 16,
    color: colors.grass,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: spacing.md,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  timePickerContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sand,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.soft,
  },
  timeInput: {
    fontSize: 48,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    width: 90,
    padding: spacing.sm,
  },
  timeSeparator: {
    fontSize: 48,
    fontWeight: '600',
    color: colors.textPrimary,
    marginHorizontal: spacing.xs,
  },
  daysContainer: {
    gap: spacing.sm,
  },
  allDaysBtn: {
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: colors.fog,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  allDaysBtnActive: {
    borderColor: colors.grass,
    backgroundColor: colors.grassLight,
  },
  allDaysText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  allDaysTextActive: {
    color: colors.grass,
  },
  dayButton: {
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: colors.fog,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  dayButtonActive: {
    borderColor: colors.grass,
    backgroundColor: colors.grassLight,
  },
  dayButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  dayButtonTextActive: {
    color: colors.grass,
    fontWeight: '600',
  },
  labelInput: {
    backgroundColor: colors.sand,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.fog,
  },
});
