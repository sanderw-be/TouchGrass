# Dependency Graph

## Most Imported Files (change these carefully)

- `src/storage/database.ts` — imported by **71** files
- `src/i18n/index.ts` — imported by **45** files
- `src/context/ThemeContext.tsx` — imported by **30** files
- `src/utils/theme.ts` — imported by **27** files
- `src/utils/helpers.ts` — imported by **10** files
- `src/detection/index.ts` — imported by **9** files
- `src/utils/sessionsChangedEmitter.ts` — imported by **8** files
- `src/detection/manualCheckin.ts` — imported by **8** files
- `src/weather/weatherService.ts` — imported by **7** files
- `src/calendar/calendarService.ts` — imported by **6** files
- `src/utils/constants.ts` — imported by **6** files
- `src/notifications/notificationManager.ts` — imported by **6** files
- `src/detection/sessionMerger.ts` — imported by **6** files
- `src/utils/units.ts` — imported by **5** files
- `src/background/alarmTiming.ts` — imported by **4** files
- `src/navigation/AppNavigator.tsx` — imported by **4** files
- `src/context/ReminderFeedbackContext.tsx` — imported by **4** files
- `src/utils/widgetHelper.ts` — imported by **4** files
- `src/utils/temperature.ts` — imported by **4** files
- `src/context/LanguageContext.tsx` — imported by **3** files

## Import Map (who imports what)

- `src/storage/database.ts` ← `App.tsx`, `src/__tests__/App.test.tsx`, `src/__tests__/App.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx` +66 more
- `src/i18n/index.ts` ← `App.tsx`, `src/__tests__/App.test.tsx`, `src/__tests__/App.test.tsx`, `src/__tests__/ErrorBoundary.test.tsx`, `src/__tests__/FeedbackSupportScreen.test.tsx` +40 more
- `src/context/ThemeContext.tsx` ← `App.tsx`, `src/__tests__/ThemeContext.test.tsx`, `src/components/DiagnosticSheet.tsx`, `src/components/EditLocationSheet.tsx`, `src/components/EditSessionSheet.tsx` +25 more
- `src/utils/theme.ts` ← `src/__tests__/ThemeContext.test.tsx`, `src/components/DiagnosticSheet.tsx`, `src/components/EditLocationSheet.tsx`, `src/components/EditSessionSheet.tsx`, `src/components/ErrorBoundary.tsx` +22 more
- `src/utils/helpers.ts` ← `src/components/EditSessionSheet.tsx`, `src/components/ManualSessionSheet.tsx`, `src/components/ProgressRing.tsx`, `src/components/ReminderFeedbackModal.tsx`, `src/i18n/index.ts` +5 more
- `src/detection/index.ts` ← `App.tsx`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/SettingsScreen.test.tsx` +4 more
- `src/utils/sessionsChangedEmitter.ts` ← `src/__tests__/EventsScreen.test.tsx`, `src/__tests__/HomeScreen.test.tsx`, `src/__tests__/sessionsChangedEmitter.test.ts`, `src/detection/gpsDetection.ts`, `src/detection/healthConnect.ts` +3 more
- `src/detection/manualCheckin.ts` ← `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/widget-task-handler.test.tsx` +3 more
- `src/weather/weatherService.ts` ← `src/__tests__/backgroundService.test.ts`, `src/__tests__/backgroundTick.test.ts`, `src/__tests__/notificationManager.test.ts`, `src/__tests__/reminderAlgorithm.test.ts`, `src/background/backgroundTick.ts` +2 more
- `src/calendar/calendarService.ts` ← `App.tsx`, `src/__tests__/GoalsScreen.test.tsx`, `src/__tests__/notificationManager.test.ts`, `src/__tests__/permissionIssues.test.ts`, `src/screens/IntroScreen.tsx` +1 more
