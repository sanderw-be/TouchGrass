import { useState, useEffect, useRef, useCallback } from 'react';
import {
  performCriticalInitializationAsync,
  performDeferredInitialization,
} from '../../appBootstrap';
import { setSettingAsync } from '../storage/database';
import i18n, { getDeviceSupportedLocale } from '../i18n';

interface AppInitializationState {
  isReady: boolean;
  showIntro: boolean;
  locale: string;
  setLocale: (code: string) => void;
  handleShowIntro: () => void;
  handleIntroComplete: () => void;
}

export function useAppInitialization(): AppInitializationState {
  const [isReady, setIsReady] = useState(false);
  const [showIntro, setShowIntro] = useState(true); // Start with true, critical init will set the real value
  const [locale, setLocaleState] = useState('system');
  const deferredInitDone = useRef(false);

  // Critical-path init
  useEffect(() => {
    async function bootstrapApp() {
      try {
        const { showIntro: initialShowIntro, initialLocale } =
          await performCriticalInitializationAsync();
        setShowIntro(initialShowIntro);
        setLocaleState(initialLocale);
      } catch (error) {
        console.error('Critical initialization failed:', error);
      } finally {
        setIsReady(true);
      }
    }
    bootstrapApp();
  }, []);

  // Deferred init
  useEffect(() => {
    if (!isReady || showIntro || deferredInitDone.current) {
      return;
    }
    deferredInitDone.current = true;
    performDeferredInitialization();
  }, [isReady, showIntro]);

  const setLocale = useCallback((code: string) => {
    const languagePreference = code === 'system' ? 'system' : code;
    i18n.locale = languagePreference === 'system' ? getDeviceSupportedLocale() : languagePreference;
    setSettingAsync('language', languagePreference).catch((err) =>
      console.error('[useAppInitialization] Failed to save language preference:', err)
    );
    setLocaleState(languagePreference);
  }, []);

  const handleShowIntro = () => {
    setSettingAsync('hasCompletedIntro', '0').catch((err) =>
      console.error('[useAppInitialization] Failed to reset intro status:', err)
    );
    setShowIntro(true);
  };

  const handleIntroComplete = () => {
    setSettingAsync('hasCompletedIntro', '1').catch((err) =>
      console.error('[useAppInitialization] Failed to save intro completion:', err)
    );
    setShowIntro(false);
    // deferredInitDone is still false because the deferred init effect was
    // blocked while showIntro was true. It will fire automatically once
    // showIntro becomes false.
  };

  return { isReady, showIntro, locale, setLocale, handleShowIntro, handleIntroComplete };
}
