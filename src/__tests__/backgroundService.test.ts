jest.mock('react-native-background-actions', () => ({
  isRunning: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('../i18n', () => ({ t: (key: string) => key }));

jest.mock('../background/reminderTask', () => jest.fn());

import BackgroundJob from 'react-native-background-actions';
import { startBackgroundTask, stopBackgroundTask } from '../background/backgroundService';

describe('startBackgroundTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not call BackgroundJob.start when already running', async () => {
    (BackgroundJob.isRunning as jest.Mock).mockReturnValue(true);

    await startBackgroundTask();

    expect(BackgroundJob.start).not.toHaveBeenCalled();
  });

  it('calls BackgroundJob.start when not running', async () => {
    (BackgroundJob.isRunning as jest.Mock).mockReturnValue(false);
    (BackgroundJob.start as jest.Mock).mockResolvedValue(undefined);

    await startBackgroundTask();

    expect(BackgroundJob.start).toHaveBeenCalledTimes(1);
  });

  it('handles errors from BackgroundJob.start gracefully without throwing', async () => {
    (BackgroundJob.isRunning as jest.Mock).mockReturnValue(false);
    (BackgroundJob.start as jest.Mock).mockRejectedValue(new Error('start failed'));

    await expect(startBackgroundTask()).resolves.toBeUndefined();
  });
});

describe('stopBackgroundTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not call BackgroundJob.stop when not running', async () => {
    (BackgroundJob.isRunning as jest.Mock).mockReturnValue(false);

    await stopBackgroundTask();

    expect(BackgroundJob.stop).not.toHaveBeenCalled();
  });

  it('calls BackgroundJob.stop when running', async () => {
    (BackgroundJob.isRunning as jest.Mock).mockReturnValue(true);
    (BackgroundJob.stop as jest.Mock).mockResolvedValue(undefined);

    await stopBackgroundTask();

    expect(BackgroundJob.stop).toHaveBeenCalledTimes(1);
  });
});
