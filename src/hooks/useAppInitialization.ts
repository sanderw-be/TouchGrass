import { useState, useEffect, useRef, useCallback } from 'react';
import { performCriticalInitialization, performDeferredInitialization } from '../../appBootstrap';
import { setSetting } from '../storage/database';
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
    const { showIntro: initialShowIntro, initialLocale } = performCriticalInitialization();
    setShowIntro(initialShowIntro);
    setLocaleState(initialLocale);
    setIsReady(true);
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
    setSetting('language', languagePreference);
    setLocaleState(languagePreference);
  }, []);

  const handleShowIntro = () => {
    setSetting('hasCompletedIntro', '0');
    setShowIntro(true);
  };

  const handleIntroComplete = () => {
    setSetting('hasCompletedIntro', '1');
    setShowIntro(false);
    // deferredInitDone is still false because the deferred init effect was
    // blocked while showIntro was true. It will fire automatically once
    // showIntro becomes false.
  };

  return { isReady, showIntro, locale, setLocale, handleShowIntro, handleIntroComplete };
}
