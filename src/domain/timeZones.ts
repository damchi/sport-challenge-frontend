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

// "America/Argentina/Buenos_Aires" → "Buenos Aires"; "UTC" → "UTC".
function city(timeZone: string): string {
  return (timeZone.split('/').at(-1) ?? timeZone).replaceAll('_', ' ');
}

/** Zones grouped by region in name order, "Other" last, each sorted by city. */
export function groupTimeZones(timeZones: readonly string[]): TimeZoneGroup[] {
  const groups = new Map<string, TimeZoneGroup['zones']>();
  for (const id of [...timeZones].sort()) {
    const first = id.split('/')[0] ?? '';
    const region = id.includes('/') && REGIONS.has(first) ? first : 'Other';
    groups.set(region, [...(groups.get(region) ?? []), { id, city: city(id) }]);
  }
  const other = groups.get('Other');
  groups.delete('Other');
  if (other) groups.set('Other', other);
  return [...groups.entries()].map(([region, zones]) => ({
    region,
    zones: zones.sort((a, b) => a.city.localeCompare(b.city)),
  }));
}
