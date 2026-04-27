# Dependency Graph

## Most Imported Files (change these carefully)

- `src/storage/index.ts` — imported by **67** files
- `src/i18n/index.ts` — imported by **53** files
- `src/store/useAppStore.ts` — imported by **35** files
- `src/utils/theme.ts` — imported by **31** files
- `src/detection/index.ts` — imported by **14** files
- `src/components/ResponsiveGridList.tsx` — imported by **11** files
- `src/storage/db.ts` — imported by **10** files
- `src/notifications/notificationManager.ts` — imported by **10** files
- `src/utils/helpers.ts` — imported by **10** files
- `src/storage/StorageService.ts` — imported by **9** files
- `src/storage/types.ts` — imported by **9** files
- `src/utils/sessionsChangedEmitter.ts` — imported by **8** files
- `src/detection/manualCheckin.ts` — imported by **8** files
- `src/i18n/en.ts` — imported by **8** files
- `src/utils/widgetHelper.ts` — imported by **7** files
- `src/calendar/calendarService.ts` — imported by **7** files
- `src/weather/types.ts` — imported by **7** files
- `src/components/ui/index.ts` — imported by **7** files
- `src/utils/constants.ts` — imported by **6** files
- `src/detection/sessionMerger.ts` — imported by **6** files

## Import Map (who imports what)

- `src/storage/index.ts` ← `appBootstrap.ts`, `src/__tests__/EditSessionSheet.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx`, `src/__tests__/EditSessionSheet.test.tsx` +62 more
- `src/i18n/index.ts` ← `appBootstrap.ts`, `src/__tests__/ErrorBoundary.test.tsx`, `src/__tests__/FeedbackSupportScreen.test.tsx`, `src/__tests__/appBootstrap.test.ts`, `src/__tests__/i18n.test.ts` +48 more
- `src/store/useAppStore.ts` ← `App.tsx`, `appBootstrap.ts`, `src/__tests__/App.test.tsx`, `src/__tests__/useAppStore.test.ts`, `src/components/DiagnosticSheet.tsx` +30 more
- `src/utils/theme.ts` ← `src/components/DiagnosticSheet.tsx`, `src/components/EditLocationSheet.tsx`, `src/components/EditSessionSheet.tsx`, `src/components/ErrorBoundary.tsx`, `src/components/ManualSessionSheet.tsx` +26 more
- `src/detection/index.ts` ← `appBootstrap.ts`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx`, `src/__tests__/IntroScreen.test.tsx` +9 more
- `src/components/ResponsiveGridList.tsx` ← `src/screens/AboutAppScreen.tsx`, `src/screens/ActivityLogScreen.tsx`, `src/screens/EventsScreen.tsx`, `src/screens/FeedbackSupportScreen.tsx`, `src/screens/GoalsScreen.tsx` +6 more
- `src/storage/db.ts` ← `src/__tests__/integration/database.integration.test.ts`, `src/background/smartReminderTask.ts`, `src/storage/index.ts`, `src/storage/repositories/GoalRepository.ts`, `src/storage/repositories/LocationRepository.ts` +5 more
- `src/notifications/notificationManager.ts` ← `src/__tests__/notificationManager.test.ts`, `src/__tests__/scheduledNotifications.test.ts`, `src/hooks/useForegroundSync.ts`, `src/hooks/useGoalIntegrations.ts`, `src/notifications/services/ReminderQueueManager.ts` +5 more
- `src/utils/helpers.ts` ← `src/components/EditSessionSheet.tsx`, `src/components/ManualSessionSheet.tsx`, `src/components/ProgressRing.tsx`, `src/components/ReminderFeedbackModal.tsx`, `src/i18n/index.ts` +5 more
- `src/storage/StorageService.ts` ← `src/__tests__/StorageService.test.ts`, `src/__tests__/integration/database.integration.test.ts`, `src/background/smartReminderTask.ts`, `src/core/container.ts`, `src/notifications/services/NotificationResponseHandler.ts` +4 more
