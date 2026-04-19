import { renderHook, act } from '@testing-library/react-native';
import { useGoalTargets } from '../hooks/useGoalTargets';
import {
  getCurrentDailyGoalAsync,
  getCurrentWeeklyGoalAsync,
  setDailyGoalAsync,
  setWeeklyGoalAsync,
} from '../storage/database';
import { Alert } from 'react-native';

// Mock the database storage functions
jest.mock('../storage/database', () => ({
  getCurrentDailyGoalAsync: jest.fn(),
  getCurrentWeeklyGoalAsync: jest.fn(),
  setDailyGoalAsync: jest.fn(),
  setWeeklyGoalAsync: jest.fn(),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('useGoalTargets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useGoalTargets());
    expect(result.current.dailyTarget).toBe(30);
    expect(result.current.weeklyTarget).toBe(150);
    expect(result.current.editingDaily).toBe(false);
    expect(result.current.editingWeekly).toBe(false);
  });

  it('loads goals from the database', async () => {
    (getCurrentDailyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 45 });
    (getCurrentWeeklyGoalAsync as jest.Mock).mockResolvedValue({ targetMinutes: 200 });

    const { result } = renderHook(() => useGoalTargets());

    await act(async () => {
      await result.current.loadGoals();
    });

    expect(result.current.dailyTarget).toBe(45);
    expect(result.current.weeklyTarget).toBe(200);
  });

  it('saves daily goal and updates state', async () => {
    (setDailyGoalAsync as jest.Mock).mockResolvedValue(undefined);
    const { result } = renderHook(() => useGoalTargets());

    await act(async () => {
      await result.current.saveDaily(60);
    });

    expect(setDailyGoalAsync).toHaveBeenCalledWith(60);
    expect(result.current.dailyTarget).toBe(60);
    expect(result.current.editingDaily).toBe(false);
  });

  it('shows alert for invalid daily goal', async () => {
    const { result } = renderHook(() => useGoalTargets());

    await act(async () => {
      await result.current.saveDaily(0); // too small
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(setDailyGoalAsync).not.toHaveBeenCalled();
  });

  it('saves weekly goal and updates state', async () => {
    (setWeeklyGoalAsync as jest.Mock).mockResolvedValue(undefined);
    const { result } = renderHook(() => useGoalTargets());

    await act(async () => {
      await result.current.saveWeekly(300);
    });

    expect(setWeeklyGoalAsync).toHaveBeenCalledWith(300);
    expect(result.current.weeklyTarget).toBe(300);
    expect(result.current.editingWeekly).toBe(false);
  });

  it('shows alert for invalid weekly goal', async () => {
    const { result } = renderHook(() => useGoalTargets());

    await act(async () => {
      await result.current.saveWeekly(10000); // too large
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(setWeeklyGoalAsync).not.toHaveBeenCalled();
  });
});
