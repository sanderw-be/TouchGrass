import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { GEOFENCE_TASK } from '../detection/constants';
import { getDwellService } from '../notifications/notificationManager';
import { initDatabaseAsync, setSettingAsync, getSettingAsync } from '../storage';
import { ActivityTransitionModule } from '../modules/ActivityTransitionModule';

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
  });

  it('should be defined', () => {
    expect(taskCallback).toBeDefined();
  });

  it('should handle Geofence Enter event', async () => {
    const data = {
      eventType: Location.GeofencingEventType.Enter,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    await taskCallback({ data, error: null });

    expect(initDatabaseAsync).toHaveBeenCalled();
    expect(ActivityTransitionModule.stopTracking).toHaveBeenCalled();
    expect(mockDwellService.cancelDwellPrompt).toHaveBeenCalled();
  });

  it('should handle Geofence Exit event', async () => {
    const data = {
      eventType: Location.GeofencingEventType.Exit,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    await taskCallback({ data, error: null });

    expect(initDatabaseAsync).toHaveBeenCalled();
    expect(setSettingAsync).toHaveBeenCalledWith('gps_session_start', expect.any(String));
    expect(ActivityTransitionModule.startTracking).toHaveBeenCalled();
  });

  it('should handle errors gracefully when cancelDwellPrompt fails', async () => {
    mockDwellService.cancelDwellPrompt.mockRejectedValue(new Error('Notification error'));

    const data = {
      eventType: Location.GeofencingEventType.Enter,
      region: { identifier: 'Home', latitude: 0, longitude: 0, radius: 100 },
    };

    // Should not throw
    await expect(taskCallback({ data, error: null })).resolves.not.toThrow();

    expect(mockDwellService.cancelDwellPrompt).toHaveBeenCalled();
  });
});
