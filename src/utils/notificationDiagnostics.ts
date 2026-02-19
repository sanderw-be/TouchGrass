import * as Notifications from 'expo-notifications';
import { getScheduledNotifications } from '../storage/database';

/**
 * Comprehensive diagnostic tool for debugging scheduled notifications.
 * Call this from the app to get a detailed report of the notification status.
 */
export async function runNotificationDiagnostics(): Promise<string> {
  const report: string[] = [];
  report.push('=== TouchGrass Notification Diagnostics ===\n');

  try {
    // 1. Check permissions
    report.push('1. Checking notification permissions...');
    const { status, ios, android } = await Notifications.getPermissionsAsync();
    report.push(`   Status: ${status}`);
    if (ios) {
      report.push(`   iOS settings: ${JSON.stringify(ios)}`);
    }
    if (android) {
      report.push(`   Android settings: ${JSON.stringify(android)}`);
    }

    if (status !== 'granted') {
      report.push('   ❌ ISSUE: Notification permissions not granted!');
      report.push('   Fix: Go to Settings → Notifications and enable permissions for TouchGrass\n');
    } else {
      report.push('   ✓ Permissions granted\n');
    }

    // 2. Check database schedules
    report.push('2. Checking database schedules...');
    const dbSchedules = getScheduledNotifications();
    const enabledSchedules = dbSchedules.filter(s => s.enabled === 1);
    report.push(`   Total schedules in database: ${dbSchedules.length}`);
    report.push(`   Enabled schedules: ${enabledSchedules.length}`);
    
    if (dbSchedules.length === 0) {
      report.push('   ⚠ No schedules found in database');
    } else {
      for (const schedule of dbSchedules) {
        const daysStr = schedule.daysOfWeek.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(',');
        const timeStr = `${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`;
        const statusStr = schedule.enabled ? '✓ ON' : '✗ OFF';
        report.push(`   - [${statusStr}] "${schedule.label || 'No label'}" at ${timeStr} on ${daysStr}`);
      }
    }
    report.push('');

    // 3. Check system-scheduled notifications
    report.push('3. Checking system-scheduled notifications...');
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ourNotifications = allScheduled.filter(n => n.identifier.startsWith('scheduled_'));
    
    report.push(`   Total system notifications: ${allScheduled.length}`);
    report.push(`   Our scheduled notifications: ${ourNotifications.length}`);
    
    if (enabledSchedules.length > 0 && ourNotifications.length === 0) {
      report.push('   ❌ ISSUE: Database has enabled schedules but no notifications are scheduled!');
      report.push('   This usually means:');
      report.push('   - Permissions were not granted when scheduling was attempted');
      report.push('   - An error occurred during scheduling');
      report.push('   - The app needs to be restarted\n');
    } else if (ourNotifications.length > 0) {
      report.push('   ✓ Notifications are scheduled in the system');
      for (const notif of ourNotifications) {
        const trigger = notif.trigger as any;
        if (trigger.type === 'calendar') {
          const weekdayNames = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const day = weekdayNames[trigger.weekday] || `Day ${trigger.weekday}`;
          const time = `${String(trigger.hour).padStart(2, '0')}:${String(trigger.minute).padStart(2, '0')}`;
          report.push(`   - ${notif.identifier}: ${day} at ${time} (CALENDAR - may not work on Android)`);
        } else if (trigger.type === 'date') {
          const date = new Date(trigger.date);
          const dateStr = date.toLocaleString();
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayOfWeek = dayNames[date.getDay()];
          const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          report.push(`   - ${notif.identifier}: ${dayOfWeek} at ${time} (${dateStr})`);
        } else {
          report.push(`   - ${notif.identifier}: ${trigger.type} trigger`);
        }
      }
    }
    report.push('');

    // 4. Expected vs actual count
    const expectedCount = enabledSchedules.reduce((sum, s) => sum + s.daysOfWeek.length, 0);
    report.push('4. Verification...');
    report.push(`   Expected notifications: ${expectedCount}`);
    report.push(`   Actually scheduled: ${ourNotifications.length}`);
    
    if (expectedCount === ourNotifications.length) {
      report.push('   ✓ Counts match!\n');
    } else {
      report.push('   ❌ MISMATCH: Expected and actual counts differ\n');
    }

    // 5. Recommendations
    report.push('5. Recommendations:');
    if (status !== 'granted') {
      report.push('   → Enable notification permissions in device settings');
    }
    if (enabledSchedules.length > 0 && ourNotifications.length === 0 && status === 'granted') {
      report.push('   → Try toggling a schedule off and back on to reschedule');
      report.push('   → Check the console logs for scheduling errors');
    }
    if (enabledSchedules.length === 0) {
      report.push('   → Create and enable at least one schedule to test');
    }
    if (expectedCount === ourNotifications.length && status === 'granted') {
      report.push('   → Everything looks good! Notifications should appear at scheduled times');
      report.push('   → Make sure device is not in Do Not Disturb mode');
      report.push('   → Check that notification sounds are enabled in device settings');
    }

  } catch (error) {
    report.push(`\n❌ Error during diagnostics: ${error}`);
  }

  const fullReport = report.join('\n');
  console.log(fullReport);
  return fullReport;
}
