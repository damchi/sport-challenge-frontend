import { groupTimeZones, supportedTimeZones, timeZoneCity } from './timeZones';

describe('groupTimeZones', () => {
  it('groups by region, then sorts by city', () => {
    expect(
      groupTimeZones([
        'Europe/Paris',
        'America/Toronto',
        'America/Argentina/Buenos_Aires',
        'UTC',
        'America/Los_Angeles',
      ]),
    ).toEqual([
      {
        region: 'America',
        zones: [
          { id: 'America/Argentina/Buenos_Aires', city: 'Buenos Aires' },
          { id: 'America/Los_Angeles', city: 'Los Angeles' },
          { id: 'America/Toronto', city: 'Toronto' },
        ],
      },
      { region: 'Europe', zones: [{ id: 'Europe/Paris', city: 'Paris' }] },
      { region: 'Other', zones: [{ id: 'UTC', city: 'UTC' }] },
    ]);
  });

  it('puts the regions it does not name under Other', () => {
    expect(
      groupTimeZones(['US/Eastern', 'Etc/GMT+5', 'Europe/Paris', 'UTC']).map(
        ({ region }) => region,
      ),
    ).toEqual(['Europe', 'Other']);
  });
});

describe('timeZoneCity', () => {
  it('takes the last part of the name, with spaces', () => {
    expect(timeZoneCity('America/Toronto')).toBe('Toronto');
    expect(timeZoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
    expect(timeZoneCity('UTC')).toBe('UTC');
  });
});

describe('supportedTimeZones', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the zones the runtime knows, with the given ones', () => {
    vi.spyOn(Intl, 'supportedValuesOf').mockReturnValue(['America/Toronto', 'Europe/Paris']);

    expect(supportedTimeZones(['Europe/Paris', 'Asia/Tokyo'])).toEqual([
      'America/Toronto',
      'Europe/Paris',
      'Asia/Tokyo',
    ]);
  });

  it('falls back to the device zone, the given ones and UTC without Intl.supportedValuesOf', () => {
    const supportedValuesOf = Object.getOwnPropertyDescriptor(Intl, 'supportedValuesOf');
    Reflect.deleteProperty(Intl, 'supportedValuesOf');
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      expect(supportedTimeZones(['America/Toronto'])).toEqual([
        ...new Set([device, 'UTC', 'America/Toronto']),
      ]);
    } finally {
      if (supportedValuesOf) Object.defineProperty(Intl, 'supportedValuesOf', supportedValuesOf);
    }
  });
});
