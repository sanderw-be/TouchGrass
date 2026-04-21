import { useAppStore } from '../store/useAppStore';
import {
  performCriticalInitializationAsync,
  performDeferredInitialization,
} from '../../appBootstrap';
import { getSettingAsync, setSettingAsync } from '../storage';
import i18n from '../i18n';

// Mock dependencies
jest.mock('../../appBootstrap', () => ({
  performCriticalInitializationAsync: jest.fn(),
  performDeferredInitialization: jest.fn(),
}));

jest.mock('../storage', () => ({
  getSettingAsync: jest.fn(),
  setSettingAsync: jest.fn(),
}));

jest.mock('../i18n', () => ({
  __esModule: true,
  default: {
    locale: 'en',
  },
  getDeviceSupportedLocale: () => 'en',
  SUPPORTED_LOCALES: ['en', 'nl'],
}));

describe('useAppStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.getState().reset();
  });

  it('should initialize with default values', () => {
    const state = useAppStore.getState();
    expect(state.isReady).toBe(false);
    expect(state.locale).toBe('system');
    expect(state.themePreference).toBe('system');
  });

  it('should initialize correctly via initialize action', async () => {
    (performCriticalInitializationAsync as jest.Mock).mockResolvedValue({
      showIntro: false,
      initialLocale: 'en',
    });
    (getSettingAsync as jest.Mock).mockResolvedValue('dark');

    await useAppStore.getState().initialize('light');

    const state = useAppStore.getState();
    expect(state.isReady).toBe(true);
    expect(state.showIntro).toBe(false);
    expect(state.locale).toBe('en');
    expect(state.themePreference).toBe('dark');
    expect(state.isDark).toBe(true); // dark preference overrides light system scheme
    expect(performDeferredInitialization).toHaveBeenCalled();
  });

  it('should update locale', () => {
    (setSettingAsync as jest.Mock).mockResolvedValue(undefined);

    useAppStore.getState().setLocale('nl');

    expect(useAppStore.getState().locale).toBe('nl');
    expect(i18n.locale).toBe('nl');
    expect(setSettingAsync).toHaveBeenCalledWith('language', 'nl');
  });

  it('should update theme preference', () => {
    (setSettingAsync as jest.Mock).mockResolvedValue(undefined);

    useAppStore.getState().setThemePreference('light');

    const state = useAppStore.getState();
    expect(state.themePreference).toBe('light');
    expect(state.isDark).toBe(false);
    expect(setSettingAsync).toHaveBeenCalledWith('theme_preference', 'light');
  });

  it('should handle intro completion', () => {
    (setSettingAsync as jest.Mock).mockResolvedValue(undefined);

    useAppStore.getState().handleIntroComplete();

    expect(useAppStore.getState().showIntro).toBe(false);
    expect(setSettingAsync).toHaveBeenCalledWith('hasCompletedIntro', '1');
    expect(performDeferredInitialization).toHaveBeenCalled();
  });

  it('should trigger and dismiss feedback', () => {
    const feedbackData = {
      action: 'went_outside' as const,
      hour: 10,
      minute: 30,
      confirmBodyKey: 'notif_confirm_went_outside' as const,
    };

    useAppStore.getState().triggerFeedback(feedbackData);
    expect(useAppStore.getState().feedbackVisible).toBe(true);
    expect(useAppStore.getState().feedbackData).toEqual(feedbackData);

    useAppStore.getState().dismissFeedback();
    expect(useAppStore.getState().feedbackVisible).toBe(false);
  });
});
