# Dependency Graph

## Most Imported Files (change these carefully)

- `src/storage/index.ts` — imported by **67** files
- `src/i18n/index.ts` — imported by **49** files
- `src/store/useAppStore.ts` — imported by **34** files
- `src/utils/theme.ts` — imported by **29** files
- `src/notifications/notificationManager.ts` — imported by **14** files
- `src/detection/index.ts` — imported by **12** files
- `src/utils/helpers.ts` — imported by **10** files
- `src/utils/sessionsChangedEmitter.ts` — imported by **8** files
- `src/detection/manualCheckin.ts` — imported by **8** files
- `src/storage/db.ts` — imported by **8** files
- `src/background/unifiedBackgroundTask.ts` — imported by **7** files
- `src/utils/widgetHelper.ts` — imported by **7** files
- `src/calendar/calendarService.ts` — imported by **7** files
- `src/weather/weatherService.ts` — imported by **7** files
- `src/utils/constants.ts` — imported by **6** files
- `src/detection/sessionMerger.ts` — imported by **6** files
- `src/storage/types.ts` — imported by **6** files
- `src/navigation/AppNavigator.tsx` — imported by **5** files
- `src/utils/units.ts` — imported by **5** files
- `src/components/goals/GoalsShared.tsx` — imported by **5** files

## Import Map (who imports what)

- `src/storage/index.ts` ← `appBootstrap.ts`, `src/__tests__/EditSessionSheet.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx` +62 more
- `src/i18n/index.ts` ← `appBootstrap.ts`, `src/__tests__/ErrorBoundary.test.tsx`, `src/__tests__/FeedbackSupportScreen.test.tsx`, `src/__tests__/appBootstrap.test.ts`, `src/__tests__/i18n.test.ts` +44 more
- `src/store/useAppStore.ts` ← `App.tsx`, `src/__tests__/App.test.tsx`, `src/__tests__/notificationManager.test.ts`, `src/__tests__/useAppStore.test.ts`, `src/components/DiagnosticSheet.tsx` +29 more
- `src/utils/theme.ts` ← `src/components/DiagnosticSheet.tsx`, `src/components/EditLocationSheet.tsx`, `src/components/EditSessionSheet.tsx`, `src/components/ErrorBoundary.tsx`, `src/components/ManualSessionSheet.tsx` +24 more
- `src/notifications/notificationManager.ts` ← `appBootstrap.ts`, `src/__tests__/appBootstrap.test.ts`, `src/__tests__/backgroundService.test.ts`, `src/__tests__/backgroundTick.test.ts`, `src/__tests__/notificationManager.test.ts` +9 more
- `src/detection/index.ts` ← `appBootstrap.ts`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx` +7 more
- `src/utils/helpers.ts` ← `src/components/EditSessionSheet.tsx`, `src/components/ManualSessionSheet.tsx`, `src/components/ProgressRing.tsx`, `src/components/ReminderFeedbackModal.tsx`, `src/i18n/index.ts` +5 more
- `src/utils/sessionsChangedEmitter.ts` ← `src/__tests__/EventsScreen.test.tsx`, `src/__tests__/HomeScreen.test.tsx`, `src/__tests__/sessionsChangedEmitter.test.ts`, `src/detection/gpsDetection.ts`, `src/detection/healthConnect.ts` +3 more
- `src/detection/manualCheckin.ts` ← `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/ManualSessionSheet.test.tsx`, `src/__tests__/widget-task-handler.test.tsx` +3 more
- `src/storage/db.ts` ← `src/storage/index.ts`, `src/storage/repositories/GoalRepository.ts`, `src/storage/repositories/LocationRepository.ts`, `src/storage/repositories/LogRepository.ts`, `src/storage/repositories/NotificationRepository.ts` +3 more
