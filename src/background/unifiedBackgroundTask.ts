/**
 * Legacy Background Service Coordinator.
 * The legacy TaskManager-based background services are removed in favor of
 * the Event-Driven AlarmManager architecture (SmartReminderModule).
 */

export const BackgroundService = {
  /**
   * Legacy tick entry point.
   * No longer performs scheduled work directly; instead, ensures the
   * new event-driven chain is active.
   */
  performBackgroundTick: async () => {
    console.log(
      'TouchGrass: [BackgroundService] Legacy tick requested - ensuring event-driven chain is active'
    );
    // In the future, this can trigger a one-off recalculation if needed.
  },

  /**
   * No longer used as we don't use expo-task-manager for reminders.
   */
  registerUnifiedBackgroundTask: async () => {
    // No-op
  },

  /**
   * Cleanup legacy tasks if they still exist.
   */
  unregisterUnifiedBackgroundTask: async () => {
    // No-op
  },

  /**
   * Legacy re-arm logic.
   * The actual re-arming now happens via SmartReminderReceiver -> SmartReminderHeadlessTask.
   */
  scheduleNextAlarmPulse: async () => {
    // No-op
  },
};
