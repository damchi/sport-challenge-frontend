// Durations of the leaderboard, written h:mm whatever the language.

/** Whole minutes of a duration in seconds, as h:mm: "1:05", "0:45", "27:30". */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** An activity's duration to the second, as h:mm:ss: "1:05:30", "0:45:00". */
export function formatActivityDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
}
