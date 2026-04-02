import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { updateSessionTimes, OutsideSession } from '../storage/database';
import { spacing, radius, shadows } from '../utils/theme';
import { useTheme } from '../context/ThemeContext';
import { formatMinutes, uses24HourClock } from '../utils/helpers';
import { t, formatLocalDate, formatLocalTime } from '../i18n';

interface Props {
  visible: boolean;
  session: OutsideSession | null;
  onClose: () => void;
  onSessionUpdated: () => void;
}

export default function EditSessionSheet({ visible, session, onClose, onSessionUpdated }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    if (visible && session) {
      setStartTime(new Date(session.startTime));
      setEndTime(new Date(session.endTime));
      setShowStartPicker(false);
      setShowEndPicker(false);
    }
  }, [visible, session]);

  const onStartTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    if (date) {
      setStartTime(date);
      if (date.getTime() >= endTime.getTime()) {
        setEndTime(new Date(date.getTime() + 30 * 60 * 1000));
      }
    }
  };

  const onEndTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    if (date) {
      setEndTime(date);
      if (date.getTime() <= startTime.getTime()) {
        setStartTime(new Date(date.getTime() - 30 * 60 * 1000));
      }
    }
  };

  const handleSave = () => {
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = durationMs / 60000;

    if (durationMs <= 0 || durationMinutes > 720) {
      Alert.alert(t('manual_invalid_title'), t('manual_invalid_body'));
      return;
    }

    updateSessionTimes(session!.id!, startTime.getTime(), endTime.getTime());
    onSessionUpdated();
    onClose();
  };

  const calculatedDuration = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

  if (!session) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('session_edit_title')}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Hint */}
          <View style={styles.hint}>
            <Text style={styles.hintText}>{t('session_edit_hint')}</Text>
          </View>

          {/* Start Time */}
          <Text style={styles.sectionLabel}>{t('manual_start_time')}</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={startTime}
              mode="time"
              display="spinner"
              onChange={onStartTimeChange}
              style={styles.timePicker}
            />
          ) : (
            <>
              <TouchableOpacity style={styles.timeButton} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.timeButtonText}>{formatLocalTime(startTime.getTime())}</Text>
              </TouchableOpacity>
              {showStartPicker && (
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  is24Hour={uses24HourClock()}
                  display="default"
                  onChange={onStartTimeChange}
                />
              )}
            </>
          )}

          {/* End Time */}
          <Text style={styles.sectionLabel}>{t('manual_end_time')}</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={endTime}
              mode="time"
              display="spinner"
              onChange={onEndTimeChange}
              style={styles.timePicker}
            />
          ) : (
            <>
              <TouchableOpacity style={styles.timeButton} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.timeButtonText}>{formatLocalTime(endTime.getTime())}</Text>
              </TouchableOpacity>
              {showEndPicker && (
                <DateTimePicker
                  value={endTime}
                  mode="time"
                  is24Hour={uses24HourClock()}
                  display="default"
                  onChange={onEndTimeChange}
                />
              )}
            </>
          )}

          {/* Preview */}
          {calculatedDuration > 0 && (
            <View style={styles.preview}>
              <Text style={styles.previewLabel}>{t('manual_preview')}</Text>
              <Text style={styles.previewTime}>
                {formatLocalTime(startTime.getTime())} – {formatLocalTime(endTime.getTime())}
              </Text>
              <Text style={styles.previewDuration}>{formatMinutes(calculatedDuration)}</Text>
              <Text style={styles.previewDate}>
                {formatLocalDate(startTime.getTime(), {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          )}

          {/* Save button */}
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSave}>
            <Text style={styles.primaryBtnText}>{t('session_edit_save')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      backgroundColor: colors.mist,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      maxHeight: '85%',
      ...shadows.medium,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.fog,
      borderRadius: radius.full,
      alignSelf: 'center',
      marginTop: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      paddingBottom: spacing.sm,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.fog,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    hint: {
      backgroundColor: colors.grassPale,
      borderRadius: radius.md,
      padding: spacing.sm,
      marginBottom: spacing.sm,
    },
    hintText: {
      fontSize: 13,
      color: colors.grassDark,
      textAlign: 'center',
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    timePicker: {
      alignSelf: 'flex-start',
      marginBottom: spacing.md,
    },
    timeButton: {
      backgroundColor: colors.fog,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    timeButtonText: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    preview: {
      backgroundColor: colors.grassPale,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      alignItems: 'center',
    },
    previewLabel: {
      fontSize: 11,
      color: colors.grassDark,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    previewTime: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.grassDark,
    },
    previewDate: {
      fontSize: 13,
      color: colors.grass,
      marginTop: 2,
    },
    previewDuration: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.grass,
      marginTop: spacing.xs,
    },
    primaryBtn: {
      backgroundColor: colors.grass,
      borderRadius: radius.md,
      padding: spacing.md,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    primaryBtnText: {
      color: colors.textInverse,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
