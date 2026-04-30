export interface OutsideSession {
  id?: number;
  startTime: number; // unix timestamp ms
  endTime: number; // unix timestamp ms
  durationMinutes: number;
  source: 'health_connect' | 'gps' | 'manual' | 'timeline';
  confidence: number; // 0-1, how sure are we this was outside?
  userConfirmed: number | null; // 0, 1, or null — SQLite has no boolean, null = not reviewed, true/false = user feedback
  notes?: string;
  steps?: number; // aggregated step count from Health Connect steps records
  distanceMeters?: number; // total GPS distance travelled in metres
  averageSpeedKmh?: number; // average speed during the session in km/h
  discarded: number; // 1 = algorithmically discarded (too unreliable to propose), 0 = normal session
}

export interface DailyGoal {
  id?: number;
  targetMinutes: number;
  createdAt: number;
}

export interface WeeklyGoal {
  id?: number;
  targetMinutes: number;
  createdAt: number;
}

export interface ReminderFeedback {
  id?: number;
  timestamp: number;
  action: 'snoozed' | 'dismissed' | 'went_outside' | 'less_often' | 'more_often' | 'bad_time';
  scheduledHour: number; // 0-23, what hour the reminder fired
  scheduledMinute: number; // 0 or 30, which half-hour slot the reminder fired in
  dayOfWeek: number; // 0-6
}

export interface KnownLocation {
  id?: number;
  label: string; // 'home', 'work', or custom
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isIndoor: boolean;
  status: 'active' | 'suggested'; // 'suggested' = pending user approval
}

export interface ScheduledNotification {
  id?: number;
  hour: number; // 0-23
  minute: number; // 0-59
  daysOfWeek: number[]; // 0-6, Sunday=0
  enabled: number; // 0 or 1 (SQLite boolean)
  label: string; // optional label like "Morning walk"
}

export type BackgroundLogCategory = 'gps' | 'health_connect' | 'reminder' | 'activity_recognition';

export interface BackgroundTaskLog {
  id?: number;
  timestamp: number;
  category: BackgroundLogCategory;
  message: string;
}
