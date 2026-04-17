import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../context/ThemeContext';
import { ReminderFeedbackProvider } from '../context/ReminderFeedbackContext';
import ErrorBoundary from './ErrorBoundary';
import ReminderFeedbackModal from './ReminderFeedbackModal';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <BottomSheetModalProvider>
          <SafeAreaProvider>
            <ErrorBoundary>
              <ThemeProvider>
                <ReminderFeedbackProvider>
                  {children}
                  <ReminderFeedbackModal />
                </ReminderFeedbackProvider>
              </ThemeProvider>
            </ErrorBoundary>
          </SafeAreaProvider>
        </BottomSheetModalProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
