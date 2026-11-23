import {
  dayKind,
  groupByWeek,
  missesOlderWeek,
  mondayOf,
  weekKind,
  weeksByMonday,
} from './activityWeeks';

const MTL = 'America/Montreal';

describe('mondayOf', () => {
  it('gives the Monday of the week, Monday itself and Sunday included', () => {
    expect(mondayOf('2026-11-23')).toBe('2026-11-23');
    expect(mondayOf('2026-11-25')).toBe('2026-11-23');
    expect(mondayOf('2026-11-29')).toBe('2026-11-23');
    // Across a month and a year.
    expect(mondayOf('2026-12-02')).toBe('2026-11-30');
    expect(mondayOf('2027-01-01')).toBe('2026-12-28');
  });
});

describe('groupByWeek', () => {
  const at = (id: string, started_at: string) => ({ id, started_at });

  it('groups activities, most recent first, by week in the time zone', () => {
    const weeks = groupByWeek(
      [
        at('a', '2026-11-24T13:00:00Z'), // Tuesday 24
        at('b', '2026-11-23T05:30:00Z'), // Monday 23, 00:30 in Montréal
        at('c', '2026-11-23T04:30:00Z'), // Sunday 22, 23:30 in Montréal
        at('d', '2026-11-12T20:00:00Z'), // Thursday 12
      ],
      MTL,
    );

    expect(
      weeks.map(({ monday, sunday, activities }) => [
        monday,
        sunday,
        activities.map(({ id }) => id),
      ]),
    ).toEqual([
      ['2026-11-23', '2026-11-29', ['a', 'b']],
      ['2026-11-16', '2026-11-22', ['c']],
      ['2026-11-09', '2026-11-15', ['d']],
    ]);
  });

  it('reads the day in the time zone given: the same instant may be another week', () => {
    const sundayNight = at('a', '2026-11-23T04:30:00Z');
    expect(groupByWeek([sundayNight], MTL)[0]?.monday).toBe('2026-11-16');
    expect(groupByWeek([sundayNight], 'Europe/Paris')[0]?.monday).toBe('2026-11-23');
  });

  it('keeps a week of a change of time', () => {
    // Montréal goes back one hour on Sunday 1 Nov 2026.
    const weeks = groupByWeek(
      [at('a', '2026-11-02T04:59:00Z'), at('b', '2026-10-26T04:00:00Z')],
      MTL,
    );
    expect(weeks.map(({ monday }) => monday)).toEqual(['2026-10-26']);
  });

  it('gives no week without activities', () => {
    expect(groupByWeek([], MTL)).toEqual([]);
  });
});

describe('weekKind', () => {
  const now = new Date('2026-11-25T15:00:00Z'); // Wednesday 25

  it('names this week, last week, and the others by their Monday', () => {
    expect(weekKind('2026-11-23', now, MTL)).toBe('current');
    expect(weekKind('2026-11-16', now, MTL)).toBe('last');
    expect(weekKind('2026-11-09', now, MTL)).toBe('other');
  });

  it('reads today in the time zone given', () => {
    // Monday 23, 02:00 in Paris, still Sunday 22 in Montréal.
    const mondayInParis = new Date('2026-11-23T01:00:00Z');
    expect(weekKind('2026-11-23', mondayInParis, 'Europe/Paris')).toBe('current');
    expect(weekKind('2026-11-23', mondayInParis, MTL)).toBe('other');
  });
});

describe('dayKind', () => {
  const now = new Date('2026-11-25T15:00:00Z');

  it('names today and yesterday in the time zone, the others by their date', () => {
    expect(dayKind('2026-11-25T05:00:00Z', now, MTL)).toBe('today');
    expect(dayKind('2026-11-25T04:00:00Z', now, MTL)).toBe('yesterday');
    expect(dayKind('2026-11-24T04:00:00Z', now, MTL)).toBe('other');
  });
});

describe('weeksByMonday', () => {
  it("keys the server's weeks by their Monday in the time zone", () => {
    const week = { starts_at: '2026-11-23T05:00:00Z' };
    expect(weeksByMonday([week], MTL).get('2026-11-23')).toBe(week);
    // The same instant is Monday 06:00 in Paris.
    expect([...weeksByMonday([week], 'Europe/Paris').keys()]).toEqual(['2026-11-23']);
  });
});

describe('missesOlderWeek', () => {
  it('asks for older weeks while the one shown is older than every week loaded', () => {
    expect(missesOlderWeek('2026-11-02', ['2026-11-16', '2026-11-09'])).toBe(true);
    expect(missesOlderWeek('2026-11-09', ['2026-11-09', '2026-11-16'])).toBe(false);
    expect(missesOlderWeek('2026-11-16', [])).toBe(true);
    expect(missesOlderWeek(undefined, [])).toBe(false);
  });
});
