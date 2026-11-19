// Distances, in km only, written in the user's language: 12,5 km / 12.5 km.

/**
 * Kilometers with one decimal at most ("7 km", "2,5 km"), none from 100 km.
 * Intl writes the unit, with the language's spacing.
 */
export function formatKm(km: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilometer',
    maximumFractionDigits: km >= 100 ? 0 : 1,
  }).format(km);
}

/** A distance factor ("×0,3" / "×0.3"), two decimals at most. */
export function formatFactor(factor: number, locale: string): string {
  return `×${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(factor)}`;
}
