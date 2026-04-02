import React from 'react';
import { render, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { colors as lightColors, darkColors } from '../utils/theme';

// Mock database
const mockGetSetting = jest.fn((key: string, def: string) => def);
const mockSetSetting = jest.fn();
jest.mock('../storage/database', () => ({
  getSetting: (key: string, def: string) => mockGetSetting(key, def),
  setSetting: (key: string, value: string) => mockSetSetting(key, value),
}));

// Mock useColorScheme
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

const useColorSchemeMock = require('react-native/Libraries/Utilities/useColorScheme').default;

function TestConsumer() {
  const { colors, isDark, themePreference, setThemePreference } = useTheme();
  return (
    <>
      <Text testID="isDark">{isDark ? 'dark' : 'light'}</Text>
      <Text testID="pref">{themePreference}</Text>
      <Text testID="bg">{colors.mist}</Text>
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
    mockGetSetting.mockImplementation((key: string, def: string) => def);
    useColorSchemeMock.mockReturnValue('light');
  });

  it('defaults to system preference with light colors', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    expect(getByTestId('pref').props.children).toBe('system');
    expect(getByTestId('isDark').props.children).toBe('light');
    expect(getByTestId('bg').props.children).toBe(lightColors.mist);
  });

  it('uses dark colors when system is dark and preference is system', () => {
    useColorSchemeMock.mockReturnValue('dark');
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    expect(getByTestId('isDark').props.children).toBe('dark');
    expect(getByTestId('bg').props.children).toBe(darkColors.mist);
  });

  it('uses stored preference from database', () => {
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'theme_preference') return 'dark';
      return def;
    });
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    expect(getByTestId('pref').props.children).toBe('dark');
    expect(getByTestId('isDark').props.children).toBe('dark');
  });

  it('uses light colors when preference is light even if system is dark', () => {
    useColorSchemeMock.mockReturnValue('dark');
    mockGetSetting.mockImplementation((key: string, def: string) => {
      if (key === 'theme_preference') return 'light';
      return def;
    });
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    expect(getByTestId('isDark').props.children).toBe('light');
    expect(getByTestId('bg').props.children).toBe(lightColors.mist);
  });

  it('saves preference to database when setThemePreference is called', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    act(() => {
      getByTestId('setPref').props.onPress();
    });
    expect(mockSetSetting).toHaveBeenCalledWith('theme_preference', 'dark');
    expect(getByTestId('isDark').props.children).toBe('dark');
    expect(getByTestId('pref').props.children).toBe('dark');
  });

  it('switches back to light mode', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    act(() => {
      getByTestId('setPref').props.onPress();
    });
    act(() => {
      getByTestId('setPrefLight').props.onPress();
    });
    expect(getByTestId('isDark').props.children).toBe('light');
    expect(mockSetSetting).toHaveBeenLastCalledWith('theme_preference', 'light');
  });

  it('switches to system mode', () => {
    useColorSchemeMock.mockReturnValue('dark');
    const { getByTestId } = render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
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
