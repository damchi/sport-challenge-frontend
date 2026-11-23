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

/**
 * A pace the API gives in seconds per kilometer, to the second, as m:ss
 * ("5:07"), h:mm:ss from an hour ("1:02:05"); the unit is the caller's.
 */
export function formatPace(secondsPerKm: number): string {
  const seconds = Math.round(secondsPerKm);
  const minutes = Math.floor(seconds / 60);
  const pad = (value: number) => String(value).padStart(2, '0');
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}:${pad(minutes % 60)}:${pad(seconds % 60)}`
    : `${minutes}:${pad(seconds % 60)}`;
}

/** Whole hours and minutes of a duration in seconds, the seconds dropped. */
export function hoursAndMinutes(seconds: number): { hours: number; minutes: number } {
  const minutes = Math.floor(seconds / 60);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}
