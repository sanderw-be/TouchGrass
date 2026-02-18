import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  Modal, TextInput, Platform, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
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

const DAY_LABELS = ['day_sun', 'day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat'];

export default function ScheduledNotificationsScreen() {
  const [schedules, setSchedules] = useState<ScheduledNotification[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledNotification | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Form state
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [label, setLabel] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);

  const loadSchedules = () => {
    const loaded = getScheduledNotifications();
    setSchedules(loaded);
  };

  useFocusEffect(
    useCallback(() => {
      loadSchedules();
    }, [])
  );

  const handleAdd = () => {
    const now = new Date();
    now.setHours(10, 0, 0, 0); // Default to 10:00 AM
    setSelectedTime(now);
    setSelectedDays([1, 2, 3, 4, 5]); // Weekdays by default
    setLabel('');
    setEditingSchedule(null);
    setIsModalVisible(true);
  };

  const handleEdit = (schedule: ScheduledNotification) => {
    const time = new Date();
    time.setHours(schedule.hour, schedule.minute, 0, 0);
    setSelectedTime(time);
    setSelectedDays([...schedule.daysOfWeek]);
    setLabel(schedule.label);
    setEditingSchedule(schedule);
    setIsModalVisible(true);
  };

  const handleDelete = (schedule: ScheduledNotification) => {
    if (!schedule.id) return;

    Alert.alert(
      t('scheduled_delete_confirm_title'),
      t('scheduled_delete_confirm_body'),
      [
        { text: t('scheduled_delete_cancel'), style: 'cancel' },
        {
          text: t('scheduled_delete_confirm'),
          style: 'destructive',
          onPress: async () => {
            deleteScheduledNotification(schedule.id!);
            await scheduleAllScheduledNotifications();
            loadSchedules();
          },
        },
      ]
    );
  };

  const handleToggle = async (schedule: ScheduledNotification, value: boolean) => {
    if (!schedule.id) return;
    toggleScheduledNotification(schedule.id, value);
    await scheduleAllScheduledNotifications();
    loadSchedules();
  };

  const handleSave = async () => {
    if (selectedDays.length === 0) {
      Alert.alert(t('scheduled_error_title'), t('scheduled_error_no_days'));
      return;
    }

    const hour = selectedTime.getHours();
    const minute = selectedTime.getMinutes();

    const notification: ScheduledNotification = {
      hour,
      minute,
      daysOfWeek: selectedDays,
      enabled: 1,
      label: label.trim(),
    };

    if (editingSchedule?.id) {
      notification.id = editingSchedule.id;
      updateScheduledNotification(notification);
    } else {
      insertScheduledNotification(notification);
    }

    await scheduleAllScheduledNotifications();
    setIsModalVisible(false);
    loadSchedules();
  };

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day].sort((a, b) => a - b));
    }
  };

  const selectAllDays = () => {
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
  };

  const formatTime = (hour: number, minute: number): string => {
    const h = hour.toString().padStart(2, '0');
    const m = minute.toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  const formatDays = (days: number[]): string => {
    if (days.length === 7) return t('scheduled_all_days');
    if (days.length === 5 && JSON.stringify(days) === JSON.stringify([1, 2, 3, 4, 5])) {
      return t('scheduled_weekdays');
    }
    return days.map(d => t(DAY_LABELS[d])).join(', ');
  };

  const onTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (date) {
      setSelectedTime(date);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {schedules.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('scheduled_empty')}</Text>
            <Text style={styles.emptyHint}>{t('scheduled_empty_hint')}</Text>
          </View>
        ) : (
          schedules.map(schedule => (
            <View key={schedule.id} style={styles.scheduleCard}>
              <View style={styles.scheduleHeader}>
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleTime}>
                    {formatTime(schedule.hour, schedule.minute)}
                  </Text>
                  {schedule.label ? (
                    <Text style={styles.scheduleLabel}>{schedule.label}</Text>
                  ) : null}
                  <Text style={styles.scheduleDays}>{formatDays(schedule.daysOfWeek)}</Text>
                </View>
                <Switch
                  value={schedule.enabled === 1}
                  onValueChange={(value) => handleToggle(schedule, value)}
                  trackColor={{ false: colors.fog, true: colors.grassLight }}
                  thumbColor={schedule.enabled === 1 ? colors.grass : colors.inactive}
                />
              </View>
              <View style={styles.scheduleActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEdit(schedule)}
                >
                  <Text style={styles.actionButtonText}>{t('scheduled_edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(schedule)}
                >
                  <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                    {t('scheduled_delete')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
        <Text style={styles.addButtonText}>+ {t('scheduled_add')}</Text>
      </TouchableOpacity>

      {/* Edit Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingSchedule ? t('scheduled_edit_title') : t('scheduled_add_title')}
            </Text>

            {/* Time Picker */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('scheduled_time')}</Text>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  display="spinner"
                  onChange={onTimeChange}
                  style={styles.timePicker}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={styles.timeButtonText}>
                      {formatTime(selectedTime.getHours(), selectedTime.getMinutes())}
                    </Text>
                  </TouchableOpacity>
                  {showTimePicker && (
                    <DateTimePicker
                      value={selectedTime}
                      mode="time"
                      is24Hour={true}
                      display="default"
                      onChange={onTimeChange}
                    />
                  )}
                </>
              )}
            </View>

            {/* Days Selector */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{t('scheduled_days')}</Text>
                <TouchableOpacity onPress={selectAllDays}>
                  <Text style={styles.selectAllText}>{t('scheduled_select_all')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.daysRow}>
                {[0, 1, 2, 3, 4, 5, 6].map(day => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      selectedDays.includes(day) && styles.dayButtonSelected,
                    ]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        selectedDays.includes(day) && styles.dayButtonTextSelected,
                      ]}
                    >
                      {t(DAY_LABELS[day])}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Label Input */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('scheduled_label')}</Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder={t('scheduled_label_placeholder')}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>{t('scheduled_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>{t('scheduled_save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl + spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTime: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs / 2,
  },
  scheduleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.grass,
    marginBottom: spacing.xs / 2,
  },
  scheduleDays: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  scheduleActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.fog,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.grass,
  },
  deleteButton: {
    backgroundColor: '#FFE5E5',
  },
  deleteButtonText: {
    color: '#D32F2F',
  },
  addButton: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.grass,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    ...shadows.medium,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  formGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.grass,
  },
  timePicker: {
    alignSelf: 'flex-start',
  },
  timeButton: {
    backgroundColor: colors.fog,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.fog,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: colors.grass,
  },
  dayButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayButtonTextSelected: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: colors.fog,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.fog,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveButton: {
    backgroundColor: colors.grass,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
