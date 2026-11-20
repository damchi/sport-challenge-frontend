// Durations of the leaderboard, written h:mm whatever the language.

/** Whole minutes of a duration in seconds, as h:mm: "1:05", "0:45", "27:30". */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}
