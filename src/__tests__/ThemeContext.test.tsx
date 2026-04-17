import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { colors as lightColors, darkColors } from '../utils/theme';

// Mock database
const mockGetSetting = jest.fn(async (_key: string, def: string) => def);
const mockSetSetting = jest.fn(async (_key: string, _value: string) => {});
jest.mock('../storage/database', () => ({
  getSettingAsync: (key: string, def: string) => mockGetSetting(key, def),
  setSettingAsync: (key: string, value: string) => mockSetSetting(key, value),
}));

// Mock useColorScheme
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

const useColorSchemeMock = require('react-native/Libraries/Utilities/useColorScheme').default;

function TestConsumer() {
  const { colors, shadows, isDark, themePreference, setThemePreference } = useTheme();
  return (
    <>
      <Text testID="isDark">{isDark ? 'dark' : 'light'}</Text>
      <Text testID="pref">{themePreference}</Text>
      <Text testID="bg">{colors.mist}</Text>
      <Text testID="shadowColor">{shadows.soft.shadowColor}</Text>
      <Text testID="setPref" onPress={() => setThemePreference('dark')}>
        set-dark
      </Text>
      <Text testID="setPrefLight" onPress={() => setThemePreference('light')}>
        set-light
      </Text>
      <Text testID="setPrefSystem" onPress={() => setThemePreference('system')}>
        set-system
      </Text>
    </>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSetting.mockImplementation(async (key: string, def: string) => def);
    useColorSchemeMock.mockReturnValue('light');
  });

  it('defaults to system preference with light colors', async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    await waitFor(() => expect(getByTestId('pref').props.children).toBe('system'));
    expect(getByTestId('isDark').props.children).toBe('light');
    expect(getByTestId('bg').props.children).toBe(lightColors.mist);
    expect(getByTestId('shadowColor').props.children).toBe(lightColors.grassDark);
  });

  it('uses dark colors when system is dark and preference is system', async () => {
    useColorSchemeMock.mockReturnValue('dark');
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    await waitFor(() => expect(getByTestId('isDark').props.children).toBe('dark'));
    expect(getByTestId('bg').props.children).toBe(darkColors.mist);
    expect(getByTestId('shadowColor').props.children).toBe(darkColors.grassDark);
  });

  it('uses stored preference from database', async () => {
    mockGetSetting.mockImplementation(async (key: string, def: string) => {
      if (key === 'theme_preference') return 'dark';
      return def;
    });
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    await waitFor(() => expect(getByTestId('pref').props.children).toBe('dark'));
    expect(getByTestId('isDark').props.children).toBe('dark');
  });

  it('uses light colors when preference is light even if system is dark', async () => {
    useColorSchemeMock.mockReturnValue('dark');
    mockGetSetting.mockImplementation(async (key: string, def: string) => {
      if (key === 'theme_preference') return 'light';
      return def;
    });
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    await waitFor(() => expect(getByTestId('isDark').props.children).toBe('light'));
    expect(getByTestId('bg').props.children).toBe(lightColors.mist);
  });

  it('saves preference to database when setThemePreference is called', async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    await waitFor(() => getByTestId('setPref'));
    act(() => {
      getByTestId('setPref').props.onPress();
    });
    expect(mockSetSetting).toHaveBeenCalledWith('theme_preference', 'dark');
    expect(getByTestId('isDark').props.children).toBe('dark');
    expect(getByTestId('pref').props.children).toBe('dark');
  });

  it('switches back to light mode', async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    await waitFor(() => getByTestId('setPref'));
    act(() => {
      getByTestId('setPref').props.onPress();
    });
    act(() => {
      getByTestId('setPrefLight').props.onPress();
    });
    expect(getByTestId('isDark').props.children).toBe('light');
    expect(mockSetSetting).toHaveBeenLastCalledWith('theme_preference', 'light');
  });

  it('switches to system mode', async () => {
    useColorSchemeMock.mockReturnValue('dark');
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    await waitFor(() => getByTestId('setPrefLight'));
    // Start on light preference
    act(() => {
      getByTestId('setPrefLight').props.onPress();
    });
    expect(getByTestId('isDark').props.children).toBe('light');

    // Switch to system (which is dark)
    act(() => {
      getByTestId('setPrefSystem').props.onPress();
    });
    expect(getByTestId('pref').props.children).toBe('system');
    expect(getByTestId('isDark').props.children).toBe('dark');
  });

  it('useTheme returns default context when no provider is present', () => {
    // Without ThemeProvider, should use context default
    function MinimalConsumer() {
      const { isDark, themePreference } = useTheme();
      return (
        <>
          <Text testID="isDark">{isDark ? 'dark' : 'light'}</Text>
          <Text testID="pref">{themePreference}</Text>
        </>
      );
    }
    const { getByTestId } = render(<MinimalConsumer />);
    expect(getByTestId('isDark').props.children).toBe('light');
    expect(getByTestId('pref').props.children).toBe('system');
  });
});
