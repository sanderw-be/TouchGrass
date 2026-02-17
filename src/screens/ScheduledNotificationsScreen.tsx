import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Modal, TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

// Validation helpers
function isValidHour(hour: number): boolean {
  return !isNaN(hour) && hour >= 0 && hour <= 23;
}

function isValidMinute(minute: number): boolean {
  return !isNaN(minute) && minute >= 0 && minute <= 59;
}

// Day ordering: Display Monday-Sunday (1-6, 0) to match common calendar convention
// Uses JavaScript Date.getDay() numbering: 0=Sunday, 1=Monday, ..., 6=Saturday
const DAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ScheduledNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([]);
  const [editingNotification, setEditingNotification] = useState<ScheduledNotification | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadNotifications = useCallback(() => {
    setNotifications(getScheduledNotifications());
  }, []);

  useFocusEffect(useCallback(() => {
    loadNotifications();
  }, [loadNotifications]));

  const handleToggle = async (id: number, enabled: boolean) => {
    toggleScheduledNotification(id, enabled);
    loadNotifications();
    await scheduleAllScheduledNotifications();
  };

  const handleAdd = () => {
    setEditingNotification({
      hour: 10,
      minute: 0,
      daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri by default (using JavaScript Date.getDay(): 0=Sun, 1=Mon, ..., 6=Sat)
      enabled: 1,
      label: '',
    });
    setShowEditModal(true);
  };

  const handleEdit = (notification: ScheduledNotification) => {
    setEditingNotification({ ...notification });
    setShowEditModal(true);
  };

  const handleDelete = (notification: ScheduledNotification) => {
    Alert.alert(
      t('scheduled_notif_delete_title'),
      t('scheduled_notif_delete_body'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            if (notification.id) {
              deleteScheduledNotification(notification.id);
              loadNotifications();
              await scheduleAllScheduledNotifications();
            }
          },
        },
      ]
    );
  };

  const handleSave = async (notification: ScheduledNotification) => {
    if (notification.id) {
      updateScheduledNotification(notification);
    } else {
      insertScheduledNotification(notification);
    }
    loadNotifications();
    setShowEditModal(false);
    await scheduleAllScheduledNotifications();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {notifications.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>{t('scheduled_notif_empty')}</Text>
            <Text style={styles.emptySub}>{t('scheduled_notif_empty_sub')}</Text>
          </View>
        )}

        {notifications.map((notif, index) => (
          <View key={notif.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.cardTime}>
                  {formatTime(notif.hour, notif.minute)}
                </Text>
                {notif.label && <Text style={styles.cardLabel}>{notif.label}</Text>}
              </View>
              <Switch
                value={notif.enabled === 1}
                onValueChange={(value) => {
                  if (notif.id) handleToggle(notif.id, value);
                }}
                trackColor={{ false: colors.fog, true: colors.grassLight }}
                thumbColor={notif.enabled === 1 ? colors.grass : colors.inactive}
              />
            </View>

            <Text style={styles.cardDays}>{formatDays(notif.daysOfWeek)}</Text>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleEdit(notif)}
              >
                <Text style={styles.actionBtnText}>{t('edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDanger]}
                onPress={() => handleDelete(notif)}
              >
                <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>
                  {t('delete')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>+ {t('scheduled_notif_add')}</Text>
        </TouchableOpacity>
      </View>

      {editingNotification && (
        <EditNotificationModal
          visible={showEditModal}
          notification={editingNotification}
          onClose={() => setShowEditModal(false)}
          onSave={handleSave}
        />
      )}
    </View>
  );
}

interface EditModalProps {
  visible: boolean;
  notification: ScheduledNotification;
  onClose: () => void;
  onSave: (notification: ScheduledNotification) => void;
}

function EditNotificationModal({ visible, notification, onClose, onSave }: EditModalProps) {
  const [hour, setHour] = useState(notification.hour);
  const [minute, setMinute] = useState(notification.minute);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(notification.daysOfWeek);
  const [label, setLabel] = useState(notification.label || '');
  const [editingTime, setEditingTime] = useState(false);
  const [hourInput, setHourInput] = useState(notification.hour.toString());
  const [minuteInput, setMinuteInput] = useState(notification.minute.toString());

  const toggleDay = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter(d => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  const selectAllDays = () => {
    setDaysOfWeek([0, 1, 2, 3, 4, 5, 6]);
  };

  const selectWeekdays = () => {
    setDaysOfWeek([1, 2, 3, 4, 5]);
  };

  const handleTimeEdit = () => {
    setHourInput(hour.toString());
    setMinuteInput(minute.toString());
    setEditingTime(true);
  };

  const handleTimeBlur = () => {
    const newHour = parseInt(hourInput, 10);
    const newMinute = parseInt(minuteInput, 10);
    
    if (!isValidHour(newHour)) {
      Alert.alert(t('error'), t('scheduled_notif_invalid_hour'));
      setHourInput(hour.toString());
    } else if (!isValidMinute(newMinute)) {
      Alert.alert(t('error'), t('scheduled_notif_invalid_minute'));
      setMinuteInput(minute.toString());
    } else {
      setHour(newHour);
      setMinute(newMinute);
    }
    setEditingTime(false);
  };

  const handleSave = () => {
    if (daysOfWeek.length === 0) {
      Alert.alert(t('error'), t('scheduled_notif_no_days'));
      return;
    }

    const trimmedLabel = label.trim();
    onSave({
      ...notification,
      hour,
      minute,
      daysOfWeek,
      label: trimmedLabel || undefined,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {notification.id ? t('scheduled_notif_edit') : t('scheduled_notif_add')}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.label}>{t('scheduled_notif_time')}</Text>
            
            {!editingTime ? (
              <TouchableOpacity
                style={styles.timeButton}
                onPress={handleTimeEdit}
              >
                <Text style={styles.timeButtonText}>{formatTime(hour, minute)}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.timeInputRow}>
                <TextInput
                  style={styles.timeInput}
                  value={hourInput}
                  onChangeText={setHourInput}
                  onBlur={handleTimeBlur}
                  keyboardType="number-pad"
                  maxLength={2}
                  autoFocus
                />
                <Text style={styles.timeInputSeparator}>:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={minuteInput}
                  onChangeText={setMinuteInput}
                  onBlur={handleTimeBlur}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            )}

            <Text style={styles.label}>{t('scheduled_notif_days')}</Text>
            <View style={styles.daySelector}>
              {DAY_DISPLAY_ORDER.map(day => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayBtn,
                    daysOfWeek.includes(day) && styles.dayBtnActive,
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[
                    styles.dayBtnText,
                    daysOfWeek.includes(day) && styles.dayBtnTextActive,
                  ]}>
                    {getDayLabel(day)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.quickDays}>
              <TouchableOpacity
                style={styles.quickDayBtn}
                onPress={selectWeekdays}
              >
                <Text style={styles.quickDayBtnText}>{t('scheduled_notif_weekdays')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDayBtn}
                onPress={selectAllDays}
              >
                <Text style={styles.quickDayBtnText}>{t('scheduled_notif_all_days')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t('scheduled_notif_label_optional')}</Text>
            <TextInput
              style={styles.labelInput}
              value={label}
              onChangeText={setLabel}
              placeholder={t('scheduled_notif_label_placeholder')}
              placeholderTextColor={colors.textMuted}
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnSecondary]}
              onPress={onClose}
            >
              <Text style={styles.modalBtnTextSecondary}>{t('cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnPrimary]}
              onPress={handleSave}
            >
              <Text style={styles.modalBtnTextPrimary}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function formatDays(days: number[]): string {
  if (days.length === 7) return t('scheduled_notif_every_day');
  if (days.length === 0) return t('scheduled_notif_no_days_selected');
  
  const sortedDays = [...days].sort((a, b) => {
    // Sort Monday-Sunday (1-6, 0)
    const orderA = a === 0 ? 7 : a;
    const orderB = b === 0 ? 7 : b;
    return orderA - orderB;
  });

  return sortedDays.map(getDayLabel).join(', ');
}

function getDayLabel(day: number): string {
  const keys = ['day_sun', 'day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat'];
  return t(keys[day]);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.mist },
  content: { padding: spacing.md, paddingBottom: 100 },

  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: { fontSize: 64, marginBottom: spacing.md },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  card: {
    backgroundColor: colors.textInverse,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardHeaderLeft: { flex: 1 },
  cardTime: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardDays: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.grassPale,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  actionBtnDanger: {
    backgroundColor: '#FEE2E2',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.grass,
  },
  actionBtnTextDanger: {
    color: colors.error,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.mist,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.fog,
  },
  addBtn: {
    backgroundColor: colors.grass,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.textInverse,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.fog,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalClose: {
    fontSize: 24,
    color: colors.textMuted,
  },
  modalBody: {
    padding: spacing.md,
    maxHeight: 400,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  timeButton: {
    backgroundColor: colors.grassPale,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.grass,
  },
  daySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  dayBtn: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: colors.fog,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnActive: {
    backgroundColor: colors.grass,
  },
  dayBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  dayBtnTextActive: {
    color: colors.textInverse,
  },
  quickDays: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  quickDayBtn: {
    flex: 1,
    backgroundColor: colors.grassPale,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  quickDayBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.grass,
  },
  inputContainer: {
    backgroundColor: colors.fog,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  input: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.grassPale,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  timeInput: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.grass,
    textAlign: 'center',
    width: 60,
  },
  timeInputSeparator: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.grass,
    marginHorizontal: spacing.xs,
  },
  labelInput: {
    backgroundColor: colors.fog,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.fog,
  },
  modalBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalBtnSecondary: {
    backgroundColor: colors.fog,
  },
  modalBtnPrimary: {
    backgroundColor: colors.grass,
  },
  modalBtnTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalBtnTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
});
