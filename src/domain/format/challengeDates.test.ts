import { challengePeriod, otherTimeZoneName } from './challengeDates';

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
