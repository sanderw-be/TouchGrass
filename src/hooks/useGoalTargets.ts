import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  getCurrentDailyGoalAsync,
  getCurrentWeeklyGoalAsync,
  setDailyGoalAsync,
  setWeeklyGoalAsync,
} from '../storage/database';
import { t } from '../i18n';

export const DAILY_PRESETS = [15, 20, 30, 45, 60, 90];
export const WEEKLY_PRESETS = [60, 90, 120, 150, 210, 300];

export function useGoalTargets() {
  const [dailyTarget, setDailyTargetState] = useState(30);
  const [weeklyTarget, setWeeklyTargetState] = useState(150);
  const [editingDaily, setEditingDaily] = useState(false);
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [customDaily, setCustomDaily] = useState('');
  const [customWeekly, setCustomWeekly] = useState('');

  const loadGoals = useCallback(async () => {
    try {
      const [dailyGoal, weeklyGoal] = await Promise.all([
        getCurrentDailyGoalAsync(),
        getCurrentWeeklyGoalAsync(),
      ]);
      setDailyTargetState(dailyGoal?.targetMinutes ?? 30);
      setWeeklyTargetState(weeklyGoal?.targetMinutes ?? 150);
    } catch (error) {
      console.error('[useGoalTargets.loadGoals] Error:', error);
    }
  }, []);

  const saveDaily = async (minutes: number) => {
    if (isNaN(minutes) || minutes < 1 || minutes > 720) {
      Alert.alert(t('goals_invalid_title'), t('goals_invalid_daily'));
      return;
    }
    try {
      await setDailyGoalAsync(minutes);
      setDailyTargetState(minutes);
      setEditingDaily(false);
    } catch (error) {
      console.error('[useGoalTargets.saveDaily] Error:', error);
    }
  };

  const saveWeekly = async (minutes: number) => {
    if (isNaN(minutes) || minutes < 1 || minutes > 5040) {
      Alert.alert(t('goals_invalid_title'), t('goals_invalid_weekly'));
      return;
    }
    try {
      await setWeeklyGoalAsync(minutes);
      setWeeklyTargetState(minutes);
      setEditingWeekly(false);
    } catch (error) {
      console.error('[useGoalTargets.saveWeekly] Error:', error);
    }
  };

  return {
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
  };
}
