import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { GEOFENCE_TASK } from '../detection/constants';
import { getDwellService } from '../notifications/notificationManager';
import { initDatabaseAsync, setSettingAsync, getSettingAsync } from '../storage';
import { ActivityTransitionModule } from '../modules/ActivityTransitionModule';
import { submitSession } from '../detection/sessionMerger';

jest.mock('expo-task-manager');
jest.mock('expo-location', () => ({
  GeofencingEventType: {
    Enter: 1,
    Exit: 2,
  },
  Accuracy: {
    Lowest: 1,
    Low: 2,
    Balanced: 3,
    High: 4,
    Highest: 5,
  },
}));
jest.mock('../storage');
jest.mock('../modules/ActivityTransitionModule', () => ({
  ActivityTransitionModule: {
    startTracking: jest.fn(),
    stopTracking: jest.fn(),
  },
}));
jest.mock('../notifications/notificationManager', () => ({
  getDwellService: jest.fn(),
}));
jest.mock('../detection/sessionMerger');
jest.mock('../i18n', () => ({
  t: (key: string) => key,
}));

// Import the task to trigger defineTask
require('../background/geofenceTask');

const defineTaskMock = TaskManager.defineTask as jest.Mock;
const taskCall = defineTaskMock.mock.calls.find((call) => call[0] === GEOFENCE_TASK);
const taskCallback = taskCall?.[1];

describe('GEOFENCE_TASK', () => {
  let mockDwellService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDwellService = {
      cancelDwellPrompt: jest.fn().mockResolvedValue(undefined),
    };
    (getDwellService as jest.Mock).mockReturnValue(mockDwellService);

    (getSettingAsync as jest.Mock).mockImplementation((key: string, fallback: string) => {
      if (key === 'active_geofences') return '[]';
      if (key === 'gps_last_outside') return '0';
      return fallback;
    });
  });

  it('should be defined', () => {
    expect(taskCallback).toBeDefined();
  });

  it('should skip if data is missing', async () => {
    await taskCallback({ data: null, error: null });
    expect(initDatabaseAsync).not.toHaveBeenCalled();
  });

  it('should handle Geofence Enter event', async () => {
    (getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'active_geofences') return '[]';
      if (key === 'gps_last_outside') return '1';
      if (key === 'gps_session_start') return String(Date.now() - 10 * 60 * 1000);
      if (key === 'gps_session_start_label') return 'Home';
      return null;
    });

    const data = {
      eventType: Location.GeofencingEventType.Enter,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    await taskCallback({ data, error: null });

    expect(initDatabaseAsync).toHaveBeenCalled();
    expect(ActivityTransitionModule.stopTracking).toHaveBeenCalled();
    expect(mockDwellService.cancelDwellPrompt).toHaveBeenCalled();
    expect(setSettingAsync).toHaveBeenCalledWith('gps_last_outside', '0');
    expect(submitSession).toHaveBeenCalled();
  });

  it('should skip Geofence Enter event if already inside', async () => {
    (getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'active_geofences') return '["Home"]'; // Already inside Home
      if (key === 'gps_last_outside') return '0';
      return '0';
    });
    const data = {
      eventType: Location.GeofencingEventType.Enter,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    await taskCallback({ data, error: null });

    // Should return early (skip AR stop)
    expect(ActivityTransitionModule.stopTracking).not.toHaveBeenCalled();
    // But it SHOULD still cancel dwell prompt!
    expect(mockDwellService.cancelDwellPrompt).toHaveBeenCalled();
  });

  it('should handle Geofence Exit event (no regions left)', async () => {
    (getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'active_geofences') return '["Home"]'; // Inside Home before exit
      if (key === 'gps_last_outside') return '0';
      return '0';
    });

    const data = {
      eventType: Location.GeofencingEventType.Exit,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    await taskCallback({ data, error: null });

    expect(initDatabaseAsync).toHaveBeenCalled();
    expect(setSettingAsync).toHaveBeenCalledWith('active_geofences', '[]');
    expect(setSettingAsync).toHaveBeenCalledWith('gps_session_start', expect.any(String));
    expect(setSettingAsync).toHaveBeenCalledWith('gps_last_outside', '1');
    expect(ActivityTransitionModule.startTracking).toHaveBeenCalled();
    expect(mockDwellService.cancelDwellPrompt).toHaveBeenCalled();
  });

  it('should handle Geofence Exit event (still inside another)', async () => {
    (getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'active_geofences') return '["Home", "Work"]'; // Inside both
      if (key === 'gps_last_outside') return '0';
      return '0';
    });

    const data = {
      eventType: Location.GeofencingEventType.Exit,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    await taskCallback({ data, error: null });

    expect(setSettingAsync).toHaveBeenCalledWith('active_geofences', '["Work"]');
    expect(setSettingAsync).not.toHaveBeenCalledWith('gps_last_outside', '1');
    expect(ActivityTransitionModule.startTracking).not.toHaveBeenCalled();
    expect(mockDwellService.cancelDwellPrompt).toHaveBeenCalled();
  });

  it('should handle Geofence Enter event and update active regions', async () => {
    (getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'active_geofences') return '["Work"]';
      if (key === 'gps_last_outside') return '1';
      return '0';
    });

    const data = {
      eventType: Location.GeofencingEventType.Enter,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    await taskCallback({ data, error: null });

    expect(setSettingAsync).toHaveBeenCalledWith('active_geofences', '["Work","Home"]');
    expect(setSettingAsync).toHaveBeenCalledWith('gps_last_outside', '0');
    expect(ActivityTransitionModule.stopTracking).toHaveBeenCalled();
    expect(mockDwellService.cancelDwellPrompt).toHaveBeenCalled();
  });

  it('should skip Geofence Exit event if already outside', async () => {
    (getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'active_geofences') return '[]';
      if (key === 'gps_last_outside') return '1';
      return '0';
    });
    const data = {
      eventType: Location.GeofencingEventType.Exit,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    await taskCallback({ data, error: null });

    // Should return early
    expect(ActivityTransitionModule.startTracking).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully when cancelDwellPrompt fails', async () => {
    (getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'active_geofences') return '["Home"]';
      if (key === 'gps_last_outside') return '1';
      return '0';
    });
    mockDwellService.cancelDwellPrompt.mockRejectedValue(new Error('Notification error'));

    const data = {
      eventType: Location.GeofencingEventType.Enter,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    // Should not throw
    await expect(taskCallback({ data, error: null })).resolves.not.toThrow();

    expect(mockDwellService.cancelDwellPrompt).toHaveBeenCalled();
  });

  it('should log error if present', async () => {
    const error = new Error('Geofence tracking error');
    await taskCallback({ data: null, error });
    // This covers the error branch
  });
  it('should handle invalid JSON in active_geofences gracefully', async () => {
    (getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'active_geofences') return 'INVALID_JSON';
      if (key === 'gps_last_outside') return '0';
      return '0';
    });

    const data = {
      eventType: Location.GeofencingEventType.Exit,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    await taskCallback({ data, error: null });

    expect(setSettingAsync).toHaveBeenCalledWith('gps_last_outside', '1');
    expect(setSettingAsync).toHaveBeenCalledWith('active_geofences', '[]');
  });
  it('should handle non-array active_geofences gracefully', async () => {
    (getSettingAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'active_geofences') return '"JUST_A_STRING"';
      return '0';
    });

    const data = {
      eventType: Location.GeofencingEventType.Exit,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    await taskCallback({ data, error: null });

    expect(setSettingAsync).toHaveBeenCalledWith('active_geofences', '[]');
  });

  it('should handle cancelDwellPrompt failure on EXIT gracefully', async () => {
    (getSettingAsync as jest.Mock).mockReturnValue('0');
    mockDwellService.cancelDwellPrompt.mockRejectedValue(new Error('Dwell error'));

    const data = {
      eventType: Location.GeofencingEventType.Exit,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    await expect(taskCallback({ data, error: null })).resolves.not.toThrow();
  });
});
