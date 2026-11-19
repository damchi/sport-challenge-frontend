// IANA time zones grouped for a picker: by region (the first part of the
// name), each with its city. The caller gives the zones the runtime knows.

export interface TimeZoneGroup {
  /** First part of the IANA name ("America"), or "Other" for a bare name. */
  region: string;
  zones: { id: string; city: string }[];
}

// "America/Argentina/Buenos_Aires" → "Buenos Aires"; "UTC" → "UTC".
function city(timeZone: string): string {
  return (timeZone.split('/').at(-1) ?? timeZone).replaceAll('_', ' ');
}

/** Zones grouped by region in name order, each group sorted by city. */
export function groupTimeZones(timeZones: readonly string[]): TimeZoneGroup[] {
  const groups = new Map<string, TimeZoneGroup['zones']>();
  for (const id of [...timeZones].sort()) {
    const region = id.includes('/') ? (id.split('/')[0] ?? 'Other') : 'Other';
    groups.set(region, [...(groups.get(region) ?? []), { id, city: city(id) }]);
  }
  return [...groups.entries()].map(([region, zones]) => ({
    region,
    zones: zones.sort((a, b) => a.city.localeCompare(b.city)),
  }));
}
