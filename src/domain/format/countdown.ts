/** Time left before an instant, in whole days, hours and minutes (never below 0). */
export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
}

/** What is left from `now` until `target`, minutes rounded down; 0 once reached. */
export function countdown(now: Date, target: Date): Countdown {
  const minutes = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 60_000));
  return {
    days: Math.floor(minutes / (24 * 60)),
    hours: Math.floor((minutes % (24 * 60)) / 60),
    minutes: minutes % 60,
  };
}
