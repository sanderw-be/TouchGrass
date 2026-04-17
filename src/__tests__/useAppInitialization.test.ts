import { renderHook, act } from '@testing-library/react-native';
import { useAppInitialization } from '../hooks/useAppInitialization';
import * as appBootstrap from '../../appBootstrap';
import { setSettingAsync } from '../storage/database';
import i18n from '../i18n';

// Mock dependencies
jest.mock('../../appBootstrap', () => ({
  performCriticalInitializationAsync: jest.fn(),
  performDeferredInitialization: jest.fn(),
}));
jest.mock('expo-battery');
jest.mock('../storage/database', () => ({
  setSettingAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../i18n', () => ({
  __esModule: true,
  default: {
    locale: 'en',
  },
  getDeviceSupportedLocale: jest.fn(() => 'en'),
}));

const mockBootstrap = appBootstrap as jest.Mocked<typeof appBootstrap>;

describe('hooks/useAppInitialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBootstrap.performCriticalInitializationAsync.mockResolvedValue({
      showIntro: true,
      initialLocale: 'system',
    });
  });

  it('should perform critical initialization on mount', async () => {
    const { result } = renderHook(() => useAppInitialization());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockBootstrap.performCriticalInitializationAsync).toHaveBeenCalledTimes(1);
    expect(result.current.isReady).toBe(true);
    expect(result.current.showIntro).toBe(true);
    expect(result.current.locale).toBe('system');
  });

  it('should not perform deferred initialization if intro is shown', async () => {
    mockBootstrap.performCriticalInitializationAsync.mockResolvedValue({
      showIntro: true,
      initialLocale: 'system',
    });

    renderHook(() => useAppInitialization());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockBootstrap.performDeferredInitialization).not.toHaveBeenCalled();
  });

  it('should perform deferred initialization once ready and intro is not shown', async () => {
    mockBootstrap.performCriticalInitializationAsync.mockResolvedValue({
      showIntro: false,
      initialLocale: 'en',
    });

    const { result } = renderHook(() => useAppInitialization());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isReady).toBe(true);
    expect(result.current.showIntro).toBe(false);
    expect(mockBootstrap.performDeferredInitialization).toHaveBeenCalledTimes(1);
  });

  it('should only run deferred initialization once', async () => {
    mockBootstrap.performCriticalInitializationAsync.mockResolvedValue({
      showIntro: false,
      initialLocale: 'en',
    });

    const { rerender } = renderHook(() => useAppInitialization());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockBootstrap.performDeferredInitialization).toHaveBeenCalledTimes(1);

    rerender(undefined);

    expect(mockBootstrap.performDeferredInitialization).toHaveBeenCalledTimes(1);
  });

  it('should perform deferred initialization after intro is completed', async () => {
    mockBootstrap.performCriticalInitializationAsync.mockResolvedValue({
      showIntro: true,
      initialLocale: 'system',
    });

    const { result } = renderHook(() => useAppInitialization());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.showIntro).toBe(true);
    expect(mockBootstrap.performDeferredInitialization).not.toHaveBeenCalled();

    await act(async () => {
      result.current.handleIntroComplete();
    });

    expect(result.current.showIntro).toBe(false);
    expect(setSettingAsync).toHaveBeenCalledWith('hasCompletedIntro', '1');
    expect(mockBootstrap.performDeferredInitialization).toHaveBeenCalledTimes(1);
  });

  it('setLocale should update i18n, database, and state', async () => {
    mockBootstrap.performCriticalInitializationAsync.mockResolvedValue({
      showIntro: false,
      initialLocale: 'en',
    });
    const { result } = renderHook(() => useAppInitialization());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.setLocale('nl');
    });

    expect(i18n.locale).toBe('nl');
    expect(setSettingAsync).toHaveBeenCalledWith('language', 'nl');
    expect(result.current.locale).toBe('nl');
  });
});
