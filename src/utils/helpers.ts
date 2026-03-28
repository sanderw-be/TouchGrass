import * as RNLocalize from 'react-native-localize';

// Detect whether the device is set to 24-hour clock format
export function uses24HourClock(): boolean {
  return RNLocalize.uses24HourClock();
}

// Format minutes as human-readable
export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Normalize AM/PM notation: removes leading space and dots → "10:02am" / "2:30pm"
export function normalizeAmPm(s: string): string {
  return s.replace(/\s*([ap])\.?m\.?/i, (_, period) => period.toLowerCase() + 'm');
}

// Format a timestamp as a readable time, respecting the device's 12/24h setting
export function formatTime(ms: number): string {
  const raw = new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !uses24HourClock() });
  return uses24HourClock() ? raw : normalizeAmPm(raw);
}

// Format a timestamp as a readable date
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// Format elapsed seconds as MM:SS or H:MM:SS
export function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
