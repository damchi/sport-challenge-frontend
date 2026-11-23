import { activityTimeZone, isActivityId, sortSportsForEntry } from './activity';

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
