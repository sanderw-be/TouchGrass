import { renderHook, act } from '@testing-library/react-native';
import { AppState, InteractionManager } from 'react-native';
import { useForegroundSync } from '../hooks/useForegroundSync';
import { getSettingAsync } from '../storage/database';
import { scheduleDayReminders, processReminderQueue } from '../notifications/notificationManager';
import { cleanupTouchGrassCalendars } from '../calendar/calendarService';
import { scheduleNextAlarmPulse } from '../background/alarmTiming';
import { refreshBatteryOptimizationSetting } from '../utils/batteryOptimization';
import { requestWidgetRefresh } from '../utils/widgetHelper';

// Mock React Native APIs
jest.mock('react-native', () => {
  const mockAddEventListener = jest.fn();
  return {
    AppState: {
      currentState: 'background',
      addEventListener: mockAddEventListener,
    },
    InteractionManager: {
      // Execute the callback immediately for synchronous testing
      runAfterInteractions: jest.fn((cb) => cb()),
    },
  };
});

// Mock internal dependencies
jest.mock('../storage/database', () => ({ getSettingAsync: jest.fn() }));
jest.mock('../notifications/notificationManager', () => ({
  scheduleDayReminders: jest.fn().mockResolvedValue(undefined),
  processReminderQueue: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../calendar/calendarService', () => ({
  cleanupTouchGrassCalendars: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../background/alarmTiming', () => ({
  scheduleNextAlarmPulse: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../utils/batteryOptimization', () => ({
  refreshBatteryOptimizationSetting: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../utils/widgetHelper', () => ({
  requestWidgetRefresh: jest.fn().mockResolvedValue(undefined),
}));

describe('useForegroundSync', () => {
  let appStateChangeHandler: (state: string) => void;
  let mockRemove: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRemove = jest.fn();

    // Capture the registered event listener so we can trigger it in tests
    (AppState.addEventListener as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'change') {
        appStateChangeHandler = handler;
      }
      return { remove: mockRemove };
    });
  });

  it('should register AppState listener on mount and remove on unmount', () => {
    const { unmount } = renderHook(() => useForegroundSync());

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('should not run sync functions if transitioning to a non-active state', async () => {
    renderHook(() => useForegroundSync());

    await act(async () => {
      appStateChangeHandler('inactive'); // transitioning to inactive, not active
    });

    expect(getSettingAsync).not.toHaveBeenCalled();
    expect(refreshBatteryOptimizationSetting).not.toHaveBeenCalled();
  });

  it('should not run sync functions if intro is not completed', async () => {
    (getSettingAsync as jest.Mock).mockResolvedValue('0'); // Intro not completed
    renderHook(() => useForegroundSync());

    await act(async () => {
      appStateChangeHandler('active');
    });

    expect(getSettingAsync).toHaveBeenCalledWith('hasCompletedIntro', '0');
    expect(refreshBatteryOptimizationSetting).not.toHaveBeenCalled();
    expect(scheduleDayReminders).not.toHaveBeenCalled();
  });

  it('should run sync functions deferred by InteractionManager when intro is completed and foregrounded', async () => {
    (getSettingAsync as jest.Mock).mockResolvedValue('1'); // Intro completed
    renderHook(() => useForegroundSync());

    await act(async () => {
      appStateChangeHandler('active');
    });

    expect(refreshBatteryOptimizationSetting).toHaveBeenCalled();
    expect(InteractionManager.runAfterInteractions).toHaveBeenCalled();
    expect(scheduleDayReminders).toHaveBeenCalled();
    expect(processReminderQueue).toHaveBeenCalled();
    expect(cleanupTouchGrassCalendars).toHaveBeenCalled();
    expect(scheduleNextAlarmPulse).toHaveBeenCalled();
    expect(requestWidgetRefresh).toHaveBeenCalled();
  });
});
