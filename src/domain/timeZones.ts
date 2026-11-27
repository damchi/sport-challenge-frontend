// IANA time zones grouped for a picker: by region (the first part of the
// name), each with its city. The caller gives the zones the runtime knows.

// Regions the picker names; any other one (a bare "UTC", or "Etc" or "US" in
// some engines) goes under "Other".
const REGIONS = new Set([
  'Africa',
  'America',
  'Antarctica',
  'Arctic',
  'Asia',
  'Atlantic',
  'Australia',
  'Europe',
  'Indian',
  'Pacific',
]);

export interface TimeZoneGroup {
  /** First part of the IANA name ("America") when named, else "Other". */
  region: string;
  zones: { id: string; city: string }[];
}

/** City of a zone: "America/Argentina/Buenos_Aires" → "Buenos Aires"; "UTC" → "UTC". */
export function timeZoneCity(timeZone: string): string {
  return (timeZone.split('/').at(-1) ?? timeZone).replaceAll('_', ' ');
}

/** Zones grouped by region in name order, "Other" last, each sorted by city. */
export function groupTimeZones(timeZones: readonly string[]): TimeZoneGroup[] {
  const groups = new Map<string, TimeZoneGroup['zones']>();
  for (const id of [...timeZones].sort()) {
    const first = id.split('/')[0] ?? '';
    const region = id.includes('/') && REGIONS.has(first) ? first : 'Other';
    groups.set(region, [...(groups.get(region) ?? []), { id, city: timeZoneCity(id) }]);
  }
  const other = groups.get('Other');
  groups.delete('Other');
  if (other) groups.set('Other', other);
  return [...groups.entries()].map(([region, zones]) => ({
    region,
    zones: zones.sort((a, b) => a.city.localeCompare(b.city)),
  }));
}

/**
 * The zones the runtime knows, with the given ones always in. Below the
 * supported browsers (README §3) the runtime cannot list them: the device's
 * zone, the given ones and UTC.
 */
export function supportedTimeZones(always: readonly string[] = []): string[] {
  const known =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC'];
  return [...new Set([...known, ...always])];
}
