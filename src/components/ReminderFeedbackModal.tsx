import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useReminderFeedback } from '../context/ReminderFeedbackContext';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius } from '../utils/theme';
import { t } from '../i18n';
import { uses24HourClock, normalizeAmPm } from '../utils/helpers';
import { insertReminderFeedbackAsync, getSettingAsync, setSettingAsync } from '../storage/database';

export default function ReminderFeedbackModal() {
  const { visible, data, dismiss } = useReminderFeedback();
  const { colors, shadows } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows), [colors, shadows]);
  const [showFewerConfirmation, setShowFewerConfirmation] = useState(false);
  const [fewerConfirmationMessage, setFewerConfirmationMessage] = useState('');

  if (!visible || !data) return null;

  // Format a time respecting the device's 12/24h setting
  const formatTime = (h: number, m: number) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    const raw = d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: !uses24HourClock(),
    });
    return uses24HourClock() ? raw : normalizeAmPm(raw);
  };

  const time = formatTime(data.hour, data.minute);

  // ── 'less_often' shows a two-choice picker ──────────────
  if (data.action === 'less_often') {
    // After choosing "fewer reminders" we show a brief confirmation before the
    // user manually dismisses.
    if (showFewerConfirmation) {
      return (
        <Modal
          visible={visible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setShowFewerConfirmation(false);
            dismiss();
          }}
        >
          <View style={styles.overlay}>
            <View style={styles.card}>
              <Text style={styles.title}>{t('notif_confirm_title')}</Text>
              <Text style={styles.confirmBody}>{fewerConfirmationMessage}</Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => {
                  setShowFewerConfirmation(false);
                  dismiss();
                }}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>{t('notif_feedback_dismiss')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      );
    }

    const handleBadTime = async () => {
      try {
        await insertReminderFeedbackAsync({
          timestamp: Date.now(),
          action: 'bad_time',
          scheduledHour: data.hour,
          scheduledMinute: data.minute >= 30 ? 30 : 0,
          dayOfWeek: new Date().getDay(),
        });
      } catch (error) {
        console.error('[ReminderFeedbackModal.handleBadTime] Error:', error);
      }
      dismiss();
    };

    const handleFewerReminders = async () => {
      try {
        const catchupCount = parseInt(
          await getSettingAsync('smart_catchup_reminders_count', '2'),
          10
        );
        if (catchupCount > 0) {
          await setSettingAsync('smart_catchup_reminders_count', String(catchupCount - 1));
          setFewerConfirmationMessage(t('notif_fewer_reminders_confirm_generic'));
        } else {
          const currentCount = parseInt(await getSettingAsync('smart_reminders_count', '2'), 10);
          const newCount = Math.max(1, currentCount - 1);
          await setSettingAsync('smart_reminders_count', String(newCount));
          setFewerConfirmationMessage(
            t('notif_fewer_reminders_confirm', { newCount, oldCount: currentCount })
          );
        }
        setShowFewerConfirmation(true);
      } catch (error) {
        console.error('[ReminderFeedbackModal.handleFewerReminders] Error:', error);
      }
    };

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.title}>{t('notif_less_often_title')}</Text>
              <TouchableOpacity
                onPress={dismiss}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel={t('notif_feedback_dismiss')}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.choiceButton}
              onPress={handleBadTime}
              accessibilityRole="button"
            >
              <Text style={styles.choiceButtonText}>{t('notif_less_often_bad_time')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.choiceButton, styles.choiceButtonSecondary]}
              onPress={handleFewerReminders}
              accessibilityRole="button"
            >
              <Text style={styles.choiceButtonText}>{t('notif_less_often_fewer_reminders')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Standard confirmation view (went_outside / snoozed) ──
  const confirmBody = data.confirmBodyKey ? t(data.confirmBodyKey) : '';

  // For the snooze case: the next reminder slot is 30 minutes later
  const snoozeDate = new Date();
  snoozeDate.setHours(data.hour, data.minute + 30, 0, 0);
  const snoozeTime = formatTime(snoozeDate.getHours(), snoozeDate.getMinutes());

  let detailText = '';
  if (data.action === 'went_outside') {
    detailText = t('notif_feedback_went_outside_detail', { time });
  } else if (data.action === 'snoozed') {
    detailText = t('notif_feedback_snoozed_detail', { time, snoozeTime });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('notif_confirm_title')}</Text>
          <Text style={styles.confirmBody}>{confirmBody}</Text>
          {detailText !== '' && <Text style={styles.detailBody}>{detailText}</Text>}
          <TouchableOpacity style={styles.button} onPress={dismiss} accessibilityRole="button">
            <Text style={styles.buttonText}>{t('notif_feedback_dismiss')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(
  colors: ReturnType<typeof useTheme>['colors'],
  shadows: ReturnType<typeof useTheme>['shadows']
) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      width: '100%',
      maxWidth: 360,
      ...shadows.medium,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      flex: 1,
    },
    closeButton: {
      marginLeft: spacing.sm,
      padding: spacing.xs,
    },
    closeButtonText: {
      fontSize: 16,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    confirmBody: {
      fontSize: 15,
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    detailBody: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    button: {
      backgroundColor: colors.grass,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    buttonText: {
      color: colors.textInverse,
      fontWeight: '600',
      fontSize: 15,
    },
    choiceButton: {
      backgroundColor: colors.grass,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    choiceButtonSecondary: {
      backgroundColor: colors.textSecondary,
    },
    choiceButtonText: {
      color: colors.textInverse,
      fontWeight: '600',
      fontSize: 15,
    },
  });
}
