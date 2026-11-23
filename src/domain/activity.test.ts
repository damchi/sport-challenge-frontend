import {
  activityTimeZone,
  isActivityId,
  isSportCode,
  keptSport,
  sortSportsForEntry,
} from './activity';

describe('activityTimeZone', () => {
  it("takes the device's time zone without an ongoing challenge", () => {
    expect(activityTimeZone([], 'Europe/Paris')).toBe('Europe/Paris');
  });

  it('takes the time zone the challenges where the user takes part share', () => {
    expect(
      activityTimeZone(
        [
          { timezone: 'America/Toronto', my_status: 'active' },
          { timezone: 'America/Vancouver', my_status: 'abandoned' },
          { timezone: 'Asia/Tokyo', my_status: null },
          { timezone: 'America/Toronto', my_status: 'active' },
        ],
        'Europe/Paris',
      ),
    ).toBe('America/Toronto');
  });

  it("takes the device's when those challenges are in several time zones", () => {
    expect(
      activityTimeZone(
        [
          { timezone: 'America/Toronto', my_status: 'active' },
          { timezone: 'Europe/Paris', my_status: 'active' },
        ],
        'Asia/Tokyo',
      ),
    ).toBe('Asia/Tokyo');
  });

  it("takes the device's when the user takes part in none of them", () => {
    expect(
      activityTimeZone([{ timezone: 'America/Toronto', my_status: 'abandoned' }], 'Europe/Paris'),
    ).toBe('Europe/Paris');
  });
});

describe('isSportCode', () => {
  it('accepts a code of the catalogue shape and nothing else', () => {
    expect(isSportCode('run')).toBe(true);
    expect(isSportCode('trail_run2')).toBe(true);
    expect(isSportCode('Run')).toBe(false);
    expect(isSportCode('run&x=1')).toBe(false);
    expect(isSportCode('a'.repeat(33))).toBe(false);
    expect(isSportCode(null)).toBe(false);
  });
});

describe('keptSport', () => {
  const sports = [{ sport_code: 'run' }, { sport_code: 'yoga' }];

  it('keeps a sport the user has activities of, or not yet known', () => {
    expect(keptSport('run', sports)).toBe('run');
    expect(keptSport('ride', undefined)).toBe('ride');
  });

  it('lets go of a sport without activity, or not a sport code', () => {
    expect(keptSport('ride', sports)).toBeUndefined();
    expect(keptSport('Run', sports)).toBeUndefined();
    expect(keptSport(null, sports)).toBeUndefined();
  });
});

describe('isActivityId', () => {
  it('accepts a UUID and nothing else', () => {
    expect(isActivityId('00000000-0000-4000-8000-0000000000A1')).toBe(true);
    expect(isActivityId('new')).toBe(false);
    expect(isActivityId('00000000-0000-4000-8000-0000000000a1/x')).toBe(false);
    expect(isActivityId(undefined)).toBe(false);
  });
});

describe('sortSportsForEntry', () => {
  const names: Record<string, string> = { padel: 'Padel', archery: 'Tir à l’arc' };
  const name = (code: string) => names[code] ?? code;
  const codes = (list: string[]) =>
    sortSportsForEntry(
      list.map((code) => ({ code })),
      name,
      'fr',
    ).map(({ code }) => code);

  it("offers the mockups' order, whatever the catalogue's", () => {
    expect(
      codes([
        'yoga',
        'other',
        'climbing',
        'hike',
        'ride',
        'roller',
        'rowing',
        'run',
        'strength',
        'swim',
        'walk',
        'xc_ski',
      ]),
    ).toEqual([
      'run',
      'ride',
      'walk',
      'hike',
      'swim',
      'rowing',
      'roller',
      'xc_ski',
      'yoga',
      'climbing',
      'strength',
      'other',
    ]);
  });

  it('puts the sports it does not know after them, by name, "other" last', () => {
    expect(codes(['other', 'padel', 'run', 'archery'])).toEqual([
      'run',
      'padel',
      'archery',
      'other',
    ]);
  });
});
