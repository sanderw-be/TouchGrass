import { ActivityStateManager, ActivityType } from '../detection/ActivityStateManager';
import { setSettingAsync, getSettingAsync } from '../storage';

jest.mock('../storage', () => ({
  setSettingAsync: jest.fn(),
  getSettingAsync: jest.fn().mockResolvedValue('7'), // WALKING
}));

describe('ActivityStateManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ActivityStateManager as any).instance = undefined;
  });

  it('loads and saves state', async () => {
    const manager = ActivityStateManager.getInstance();
    await manager.loadState();
    expect(manager.getCurrentActivity()).toBe(ActivityType.WALKING);

    await manager.setCurrentActivity(ActivityType.IN_VEHICLE);
    expect(manager.getCurrentActivity()).toBe(ActivityType.IN_VEHICLE);
    expect(setSettingAsync).toHaveBeenCalledWith(
      'current_activity_type',
      String(ActivityType.IN_VEHICLE)
    );
  });

  it('defaults to UNKNOWN when no state is found or invalid', async () => {
    (getSettingAsync as jest.Mock).mockResolvedValueOnce('-1');
    const manager = ActivityStateManager.getInstance();
    await manager.loadState();
    expect(manager.getCurrentActivity()).toBe(ActivityType.UNKNOWN);
  });

  it('handles corrupted or unmapped state strings safely', async () => {
    (getSettingAsync as jest.Mock).mockResolvedValueOnce('invalid_string');
    const manager = ActivityStateManager.getInstance();
    await manager.loadState();
    expect(manager.getCurrentActivity()).toBe(ActivityType.UNKNOWN);

    (getSettingAsync as jest.Mock).mockResolvedValueOnce('999'); // Unmapped number
    await manager.loadState();
    expect(manager.getCurrentActivity()).toBe(ActivityType.UNKNOWN);
  });
});
