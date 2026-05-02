# Dependency Graph

## Most Imported Files (change these carefully)

- `src\utils\theme.ts` — imported by **38** files
- `src\store\useAppStore.ts` — imported by **33** files
- `src\notifications\notificationManager.ts` — imported by **12** files
- `src\components\ResponsiveGridList.tsx` — imported by **11** files
- `src\storage\StorageService.ts` — imported by **10** files
- `src\utils\helpers.ts` — imported by **10** files
- `src\storage\db.ts` — imported by **10** files
- `src\utils\sessionsChangedEmitter.ts` — imported by **9** files
- `src\storage\types.ts` — imported by **9** files
- `src\detection\index.ts` — imported by **8** files
- `src\detection\manualCheckin.ts` — imported by **8** files
- `src\i18n\en.ts` — imported by **8** files
- `src\utils\widgetHelper.ts` — imported by **7** files
- `src\detection\sessionMerger.ts` — imported by **7** files
- `src\weather\weatherService.ts` — imported by **7** files
- `src\hooks\useTheme.ts` — imported by **6** files
- `src\detection\PermissionService.ts` — imported by **6** files
- `src\calendar\calendarService.ts` — imported by **6** files
- `src\utils\constants.ts` — imported by **6** files
- `src\navigation\AppNavigator.tsx` — imported by **5** files

## Import Map (who imports what)

- `src\utils\theme.ts` ← `src\background\geofenceTask.ts`, `src\background\smartReminderTask.ts`, `src\components\DiagnosticSheet.tsx`, `src\components\EditLocationSheet.tsx`, `src\components\EditSessionSheet.tsx` +33 more
- `src\store\useAppStore.ts` ← `App.tsx`, `src\components\DiagnosticSheet.tsx`, `src\components\EditLocationSheet.tsx`, `src\components\EditSessionSheet.tsx`, `src\components\ErrorBoundary.tsx` +28 more
- `src\notifications\notificationManager.ts` ← `src\background\smartReminderTask.ts`, `src\hooks\useForegroundSync.ts`, `src\hooks\useGoalIntegrations.ts`, `src\notifications\services\ReminderQueueManager.ts`, `src\notifications\services\SmartReminderScheduler.ts` +7 more
- `src\components\ResponsiveGridList.tsx` ← `src\screens\AboutAppScreen.tsx`, `src\screens\ActivityLogScreen.tsx`, `src\screens\EventsScreen.tsx`, `src\screens\FeedbackSupportScreen.tsx`, `src\screens\GoalsScreen.tsx` +6 more
- `src\storage\StorageService.ts` ← `src\background\smartReminderTask.ts`, `src\core\container.ts`, `src\notifications\services\NotificationResponseHandler.ts`, `src\notifications\services\ReminderMessageBuilder.ts`, `src\notifications\services\ReminderQueueManager.ts` +5 more
- `src\utils\helpers.ts` ← `src\components\EditSessionSheet.tsx`, `src\components\ManualSessionSheet.tsx`, `src\components\ProgressRing.tsx`, `src\components\ReminderFeedbackModal.tsx`, `src\i18n\index.ts` +5 more
- `src\storage\db.ts` ← `src\storage\index.ts`, `src\storage\repositories\GoalRepository.ts`, `src\storage\repositories\LocationRepository.ts`, `src\storage\repositories\LogRepository.ts`, `src\storage\repositories\NotificationRepository.ts` +5 more
- `src\utils\sessionsChangedEmitter.ts` ← `src\background\geofenceTask.ts`, `src\detection\HealthSessionBuilder.ts`, `src\detection\LocationTracker.ts`, `src\navigation\AppNavigator.tsx`, `src\screens\EventsScreen.tsx` +4 more
- `src\storage\types.ts` ← `src\domain\SessionDomain.ts`, `src\storage\index.ts`, `src\storage\repositories\GoalRepository.ts`, `src\storage\repositories\LocationRepository.ts`, `src\storage\repositories\LogRepository.ts` +4 more
- `src\detection\index.ts` ← `appBootstrap.ts`, `src\screens\HealthConnectRationaleScreen.tsx`, `src\screens\KnownLocationsScreen.tsx`, `src\__tests__\detectionBackgroundTask.test.ts`, `src\__tests__\IntroScreen.test.tsx` +3 more
