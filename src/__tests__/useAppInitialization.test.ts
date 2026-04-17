import { renderHook, act } from '@testing-library/react-native';
import { useAppInitialization } from '../hooks/useAppInitialization';
import * as appBootstrap from '../../appBootstrap';
import { setSetting } from '../storage/database';
import i18n from '../i18n';

// Mock dependencies
jest.mock('../../appBootstrap', () => ({
  performCriticalInitialization: jest.fn(),
  performDeferredInitialization: jest.fn(),
}));
jest.mock('expo-battery');
jest.mock('../storage/database', () => ({
  setSetting: jest.fn(),
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
    mockBootstrap.performCriticalInitialization.mockReturnValue({
      showIntro: true,
      initialLocale: 'system',
    });
  });

  it('should perform critical initialization on mount', () => {
    const { result } = renderHook(() => useAppInitialization());

    expect(mockBootstrap.performCriticalInitialization).toHaveBeenCalledTimes(1);
    expect(result.current.isReady).toBe(true);
    expect(result.current.showIntro).toBe(true);
    expect(result.current.locale).toBe('system');
  });

  it('should not perform deferred initialization if intro is shown', () => {
    mockBootstrap.performCriticalInitialization.mockReturnValue({
      showIntro: true,
      initialLocale: 'system',
    });

    renderHook(() => useAppInitialization());

    expect(mockBootstrap.performDeferredInitialization).not.toHaveBeenCalled();
  });

  it('should perform deferred initialization once ready and intro is not shown', () => {
    mockBootstrap.performCriticalInitialization.mockReturnValue({
      showIntro: false,
      initialLocale: 'en',
    });

    const { result } = renderHook(() => useAppInitialization());

    expect(result.current.isReady).toBe(true);
    expect(result.current.showIntro).toBe(false);
    expect(mockBootstrap.performDeferredInitialization).toHaveBeenCalledTimes(1);
  });

  it('should only run deferred initialization once', () => {
    mockBootstrap.performCriticalInitialization.mockReturnValue({
      showIntro: false,
      initialLocale: 'en',
    });

    const { rerender } = renderHook(() => useAppInitialization());

    expect(mockBootstrap.performDeferredInitialization).toHaveBeenCalledTimes(1);

    rerender(undefined);

    expect(mockBootstrap.performDeferredInitialization).toHaveBeenCalledTimes(1);
  });

  it('should perform deferred initialization after intro is completed', () => {
    mockBootstrap.performCriticalInitialization.mockReturnValue({
      showIntro: true,
      initialLocale: 'system',
    });

    const { result } = renderHook(() => useAppInitialization());

    expect(result.current.showIntro).toBe(true);
    expect(mockBootstrap.performDeferredInitialization).not.toHaveBeenCalled();

    act(() => {
      result.current.handleIntroComplete();
    });

    expect(result.current.showIntro).toBe(false);
    expect(setSetting).toHaveBeenCalledWith('hasCompletedIntro', '1');
    expect(mockBootstrap.performDeferredInitialization).toHaveBeenCalledTimes(1);
  });

  it('setLocale should update i18n, database, and state', () => {
    const { result } = renderHook(() => useAppInitialization());

    act(() => {
      result.current.setLocale('nl');
    });

    expect(i18n.locale).toBe('nl');
    expect(setSetting).toHaveBeenCalledWith('language', 'nl');
    expect(result.current.locale).toBe('nl');
  });
});
