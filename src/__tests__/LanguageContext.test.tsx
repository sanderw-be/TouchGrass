import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';
import { LanguageContext, useLanguage } from '../context/LanguageContext';

// Mock database
const mockSetSetting = jest.fn();
jest.mock('../storage/database', () => ({
  setSetting: (key: string, value: string) => mockSetSetting(key, value),
}));

// Mock i18n
const mockI18n = { locale: 'en' };
jest.mock('../i18n', () => ({
  __esModule: true,
  default: mockI18n,
  t: (key: string) => key,
}));

function TestConsumer() {
  const { locale, setLocale } = useLanguage();
  return (
    <>
      <Text testID="locale">{locale}</Text>
      <TouchableOpacity testID="setNl" onPress={() => setLocale('nl')} />
      <TouchableOpacity testID="setEn" onPress={() => setLocale('en')} />
    </>
  );
}

describe('LanguageContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockI18n.locale = 'en';
  });

  it('returns default locale from context default', () => {
    const { getByTestId } = render(<TestConsumer />);
    expect(getByTestId('locale').props.children).toBe('en');
  });

  it('updates locale when setLocale is called', () => {
    const setLocale = jest.fn();
    const { getByTestId } = render(
      <LanguageContext.Provider value={{ locale: 'en', setLocale }}>
        <TestConsumer />
      </LanguageContext.Provider>
    );
    act(() => {
      fireEvent.press(getByTestId('setNl'));
    });
    expect(setLocale).toHaveBeenCalledWith('nl');
  });

  it('setLocale updates i18n locale, saves to storage, and triggers re-render', () => {
    // Simulate App.tsx's setLocale implementation with persistence
    const setSetting = require('../storage/database').setSetting;
    const i18n = require('../i18n').default;

    function ProviderWithRealSetLocale({ children }: { children: React.ReactNode }) {
      const [locale, setLocaleState] = React.useState('en');
      const setLocale = React.useCallback((code: string) => {
        i18n.locale = code;
        setSetting('language', code);
        setLocaleState(code);
      }, []);
      return (
        <LanguageContext.Provider value={{ locale, setLocale }}>
          {children}
        </LanguageContext.Provider>
      );
    }

    const { getByTestId } = render(
      <ProviderWithRealSetLocale>
        <TestConsumer />
      </ProviderWithRealSetLocale>
    );
    expect(getByTestId('locale').props.children).toBe('en');

    act(() => {
      fireEvent.press(getByTestId('setNl'));
    });

    expect(getByTestId('locale').props.children).toBe('nl');
    expect(i18n.locale).toBe('nl');
    expect(mockSetSetting).toHaveBeenCalledWith('language', 'nl');
  });

  it('provides locale from context value', () => {
    const { getByTestId } = render(
      <LanguageContext.Provider value={{ locale: 'nl', setLocale: jest.fn() }}>
        <TestConsumer />
      </LanguageContext.Provider>
    );
    expect(getByTestId('locale').props.children).toBe('nl');
  });

  it('useLanguage returns default context when no provider is present', () => {
    const { getByTestId } = render(<TestConsumer />);
    expect(getByTestId('locale').props.children).toBe('en');
  });
});
