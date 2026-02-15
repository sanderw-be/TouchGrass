import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getCurrentDailyGoal, getCurrentWeeklyGoal,
  setDailyGoal, setWeeklyGoal,
} from '../storage/database';
import { colors, spacing, radius, shadows } from '../utils/theme';
import { formatMinutes } from '../utils/helpers';
import { t } from '../i18n';

const DAILY_PRESETS = [15, 20, 30, 45, 60, 90];
const WEEKLY_PRESETS = [60, 90, 120, 150, 210, 300];

export default function GoalsScreen() {
  const [dailyTarget, setDailyTargetState] = useState(30);
  const [weeklyTarget, setWeeklyTargetState] = useState(150);
  const [editingDaily, setEditingDaily] = useState(false);
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [customDaily, setCustomDaily] = useState('');
  const [customWeekly, setCustomWeekly] = useState('');

  useFocusEffect(useCallback(() => {
    setDailyTargetState(getCurrentDailyGoal()?.targetMinutes ?? 30);
    setWeeklyTargetState(getCurrentWeeklyGoal()?.targetMinutes ?? 150);
  }, []));

  const saveDaily = (minutes: number) => {
    if (isNaN(minutes) || minutes < 1 || minutes > 720) {
      Alert.alert(t('goals_invalid_title'), t('goals_invalid_daily'));
      return;
    }
    setDailyGoal(minutes);
    setDailyTargetState(minutes);
    setEditingDaily(false);
  };

  const saveWeekly = (minutes: number) => {
    if (isNaN(minutes) || minutes < 1 || minutes > 5040) {
      Alert.alert(t('goals_invalid_title'), t('goals_invalid_weekly'));
      return;
    }
    setWeeklyGoal(minutes);
    setWeeklyTargetState(minutes);
    setEditingWeekly(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Daily goal */}
      <View style={styles.card}>
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
            <Text style={styles.editButtonText}>{editingDaily ? t('goals_cancel') : t('goals_edit')}</Text>
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
      </View>

      {/* Weekly goal */}
      <View style={styles.card}>
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
            <Text style={styles.editButtonText}>{editingWeekly ? t('goals_cancel') : t('goals_edit')}</Text>
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
                  <Text style={[styles.presetText, weeklyTarget === p && styles.presetTextActive]}>
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
      </View>

      {/* WHO recommendation note */}
      <View style={styles.tipCard}>
        <Text style={styles.tipIcon}>💡</Text>
        <Text style={styles.tipText}>
          {t('goals_who_tip')}
        </Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.mist },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  card: {
    backgroundColor: colors.textInverse,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { fontSize: 13, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  cardValue: { fontSize: 32, fontWeight: '700', color: colors.textPrimary, marginTop: 2, letterSpacing: -1 },

  editButton: {
    backgroundColor: colors.grassPale,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  editButtonText: { fontSize: 13, fontWeight: '600', color: colors.grass },

  editor: { marginTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.fog, paddingTop: spacing.lg },
  editorLabel: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },

  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.lg },
  preset: {
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.fog,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  presetActive: { backgroundColor: colors.grass, borderColor: colors.grass },
  presetText: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  presetTextActive: { color: colors.textInverse, fontWeight: '700' },

  customRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.fog,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.mist,
  },
  saveButton: {
    backgroundColor: colors.grass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  saveButtonText: { color: colors.textInverse, fontWeight: '700', fontSize: 15 },

  tipCard: {
    flexDirection: 'row',
    backgroundColor: colors.grassPale,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  tipIcon: { fontSize: 18 },
  tipText: { flex: 1, fontSize: 13, color: colors.grassDark, lineHeight: 20 },
});
