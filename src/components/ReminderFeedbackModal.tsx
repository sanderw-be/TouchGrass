import React, { useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useReminderFeedback } from '../context/ReminderFeedbackContext';
import { useTheme } from '../context/ThemeContext';
import { spacing, radius, shadows } from '../utils/theme';
import { t } from '../i18n';

export default function ReminderFeedbackModal() {
  const { visible, data, dismiss } = useReminderFeedback();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!visible || !data) return null;

  const confirmBody = t(data.confirmBodyKey);

  // Format a time as zero-padded HH:MM
  const formatTime = (h: number, m: number) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  const time = formatTime(data.hour, data.minute);

  // For the snooze case: the next reminder slot is 30 minutes later
  const snoozeDate = new Date();
  snoozeDate.setHours(data.hour, data.minute + 30, 0, 0);
  const snoozeTime = formatTime(snoozeDate.getHours(), snoozeDate.getMinutes());

  let detailText = '';
  if (data.action === 'went_outside') {
    detailText = t('notif_feedback_went_outside_detail', { time });
  } else if (data.action === 'snoozed') {
    detailText = t('notif_feedback_snoozed_detail', { time, snoozeTime });
  } else if (data.action === 'less_often') {
    detailText = t('notif_feedback_less_often_detail', { time });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('notif_confirm_title')}</Text>
          <Text style={styles.confirmBody}>{confirmBody}</Text>
          {detailText !== '' && (
            <Text style={styles.detailBody}>{detailText}</Text>
          )}
          <TouchableOpacity style={styles.button} onPress={dismiss} accessibilityRole="button">
            <Text style={styles.buttonText}>{t('notif_feedback_dismiss')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
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
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.sm,
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
  });
}
