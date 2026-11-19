import {
  challengeInstant,
  challengePeriod,
  challengeWindowBounds,
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
