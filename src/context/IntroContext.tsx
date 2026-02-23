import { createContext, useContext } from 'react';

/**
 * Provides a callback that, when called, resets the tutorial state and
 * shows the intro screen.  Consumed by SettingsScreen without needing to
 * thread the callback through every layer of the navigation tree.
 */
export const IntroContext = createContext<() => void>(() => {});

export const useShowIntro = () => useContext(IntroContext);
