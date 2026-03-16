import React, { createContext, useContext } from 'react';

export interface LanguageContextType {
  locale: string;
  setLocale: (code: string) => void;
}

export const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  setLocale: () => {},
});

export function useLanguage(): LanguageContextType {
  return useContext(LanguageContext);
}
