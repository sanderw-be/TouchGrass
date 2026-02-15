// Format minutes as human-readable
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Format a timestamp as a readable time
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Format a timestamp as a readable date
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
