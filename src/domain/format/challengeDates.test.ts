import {
  activityTime,
  challengeDay,
  challengeInstant,
  challengeLastDay,
  challengeTime,
  challengePeriod,
  challengeStartDay,
  challengeWeekEnd,
  challengeWindowBounds,
  daysUntil,
  otherTimeZoneName,
  timeZoneName,
} from './challengeDates';

// A challenge of November 2026 in Montréal: local midnight is 04:00 or
// 05:00 UTC, and ends_at is excluded.
const startsAt = '2026-11-01T04:00:00Z';
const endsAt = '2026-12-01T05:00:00Z';

describe('challengePeriod', () => {
  it('gives the first and last day in the challenge time zone', () => {
    expect(challengePeriod(startsAt, endsAt, 'America/Montreal', 'fr')).toEqual({
      start: '1 nov.',
      end: '30 nov.',
    });
    expect(challengePeriod(startsAt, endsAt, 'America/Montreal', 'en')).toEqual({
      start: 'Nov 1',
      end: 'Nov 30',
    });
  });

  it('does not take the day of the device time zone', () => {
    // In Paris the same instants are already the next day.
    expect(challengePeriod(startsAt, endsAt, 'Europe/Paris', 'fr')).toEqual({
      start: '1 nov.',
      end: '1 déc.',
    });
  });

  it('shows the years when the challenge crosses into a new year', () => {
    const period = challengePeriod(
      '2026-12-14T05:00:00Z',
      '2027-01-11T05:00:00Z',
      'America/Montreal',
      'fr',
    );
    expect(period).toEqual({ start: '14 déc. 2026', end: '10 janv. 2027' });
  });
});

describe('challengeLastDay', () => {
  it('gives the last day with its year, in the challenge time zone', () => {
    expect(challengeLastDay(endsAt, 'America/Montreal', 'fr')).toBe('30 nov. 2026');
    expect(challengeLastDay(endsAt, 'America/Montreal', 'en')).toBe('Nov 30, 2026');
    // In Paris the excluded end is already the next day.
    expect(challengeLastDay(endsAt, 'Europe/Paris', 'fr')).toBe('1 déc. 2026');
  });
});

describe('challengeTime', () => {
  it('gives the day and the minute in the challenge time zone', () => {
    const instant = '2026-11-18T15:00:00Z';
    expect(challengeTime(instant, 'America/Montreal', 'fr')).toBe('18 nov., 10:00');
    // ICU versions differ on the space before AM.
    expect(challengeTime(instant, 'America/Montreal', 'en')).toMatch(/^Nov 18, 10:00\sAM$/);
    expect(challengeTime(instant, 'Europe/Paris', 'fr')).toBe('18 nov., 16:00');
  });
});

describe('otherTimeZoneName', () => {
  it('stays silent in the user time zone', () => {
    expect(otherTimeZoneName('America/Montreal', 'America/Montreal', 'fr')).toBeUndefined();
  });

  it('names the challenge time zone when the user is elsewhere', () => {
    expect(otherTimeZoneName('America/Montreal', 'Europe/Paris', 'en')).toBe('Eastern Time');
  });
});

describe('challengeWindowBounds', () => {
  // Six weeks from Monday 5 October 2026 in Montréal, across the change to
  // winter time on 1 November: both bounds stay at local midnight.
  const start = new Date('2026-10-05T04:00:00Z');
  const end = new Date('2026-11-16T05:00:00Z');

  it('writes both bounds to the hour in the chosen time zone', () => {
    expect(challengeWindowBounds(start, end, 'America/Toronto', 'fr')).toEqual({
      start: 'lundi 5 octobre à 00 h',
      end: 'lundi 16 novembre à 00 h',
    });
    expect(challengeWindowBounds(start, end, 'America/Toronto', 'en')).toEqual({
      start: 'Monday, October 5 at 12 AM',
      end: 'Monday, November 16 at 12 AM',
    });
  });

  it('writes the same instants in another time zone', () => {
    expect(challengeWindowBounds(start, end, 'Europe/Paris', 'fr')).toEqual({
      start: 'lundi 5 octobre à 06 h',
      end: 'lundi 16 novembre à 06 h',
    });
  });

  it('shows the years when they differ', () => {
    expect(
      challengeWindowBounds(
        new Date('2026-12-07T05:00:00Z'),
        new Date('2027-01-04T05:00:00Z'),
        'America/Toronto',
        'fr',
      ),
    ).toEqual({ start: 'lundi 7 décembre 2026 à 00 h', end: 'lundi 4 janvier 2027 à 00 h' });
  });
});

describe('timeZoneName', () => {
  it('names the time zone without its summer or winter time', () => {
    expect(timeZoneName('America/Toronto', 'fr')).toBe('heure de l’Est nord-américain');
    expect(timeZoneName('America/Toronto', 'en')).toBe('Eastern Time');
  });
});

describe('challengeInstant', () => {
  // End of a week in Montréal: Monday 23 November 2026, local midnight.
  const weekEnd = '2026-11-23T05:00:00Z';

  it('writes the instant to the hour in the challenge time zone', () => {
    expect(challengeInstant(weekEnd, 'America/Montreal', 'fr')).toBe('lundi 23 novembre à 00 h');
    expect(challengeInstant(weekEnd, 'America/Montreal', 'en')).toBe(
      'Monday, November 23 at 12 AM',
    );
  });

  it('does not take the hour of another time zone', () => {
    expect(challengeInstant(weekEnd, 'Europe/Paris', 'fr')).toBe('lundi 23 novembre à 06 h');
  });
});

describe('challengeDay', () => {
  // 2 November 2026 at 03:00 UTC: still 1 November in Montréal.
  const joinedAt = '2026-11-02T03:00:00Z';

  it('writes the day in the challenge time zone', () => {
    expect(challengeDay(joinedAt, 'America/Montreal', 'fr')).toBe('1 nov.');
    expect(challengeDay(joinedAt, 'America/Montreal', 'en')).toBe('Nov 1');
  });

  it('does not take the day of another time zone', () => {
    expect(challengeDay(joinedAt, 'Europe/Paris', 'fr')).toBe('2 nov.');
  });
});

describe('activityTime', () => {
  it('writes the start with its year, in the time zone and the language', () => {
    expect(activityTime('2026-11-19T12:30:00Z', 'America/Montreal', 'fr')).toBe(
      '19 nov. 2026, 7:30',
    );
    expect(activityTime('2026-11-19T12:30:00Z', 'America/Montreal', 'en')).toBe(
      'Nov 19, 2026, 7:30 AM',
    );
  });
});

describe('challengeWeekEnd', () => {
  it('writes the end of a week in the challenge time zone, weekday long or short', () => {
    // Saturday 28 November 2026 at midnight in Montréal.
    const end = '2026-11-28T05:00:00Z';
    expect(challengeWeekEnd(end, 'America/Montreal', 'fr', 'long')).toBe('samedi 28 nov., 00 h');
    expect(challengeWeekEnd(end, 'America/Montreal', 'fr', 'short')).toBe('sam. 28 nov., 00 h');
    expect(challengeWeekEnd(end, 'America/Montreal', 'en', 'short')).toBe('Sat, Nov 28, 12 AM');
  });
});

describe('challengeStartDay', () => {
  it('writes the first day with its weekday, in the challenge time zone', () => {
    expect(challengeStartDay('2026-12-01T05:00:00Z', 'America/Montreal', 'fr')).toBe(
      'mardi 1 déc.',
    );
    // The same instant is still Monday in Vancouver.
    expect(challengeStartDay('2026-12-01T05:00:00Z', 'America/Vancouver', 'en')).toBe(
      'Monday, Nov 30',
    );
  });
});

describe('daysUntil', () => {
  const start = '2026-12-01T05:00:00Z';
  it('counts calendar days in the challenge time zone', () => {
    // Sunday 22 November, 23:00 in Montréal (already the 23rd in UTC).
    expect(daysUntil(new Date('2026-11-23T04:00:00Z'), start, 'America/Montreal')).toBe(9);
    expect(daysUntil(new Date('2026-11-30T12:00:00Z'), start, 'America/Montreal')).toBe(1);
  });
  it('never goes below 0', () => {
    expect(daysUntil(new Date('2026-12-02T12:00:00Z'), start, 'America/Montreal')).toBe(0);
  });
});
