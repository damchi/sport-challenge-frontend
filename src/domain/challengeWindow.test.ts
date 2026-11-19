import {
  addToDate,
  challengeWindow,
  isCalendarDate,
  isStartDateInRange,
  isTimeZone,
  localDate,
  zonedMidnight,
} from './challengeWindow';

describe('isTimeZone', () => {
  it('knows the IANA names only', () => {
    expect(isTimeZone('America/Toronto')).toBe(true);
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('Mars/Olympus_Mons')).toBe(false);
    expect(isTimeZone('')).toBe(false);
  });
});

describe('isCalendarDate', () => {
  it('accepts a real day written YYYY-MM-DD', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('2026-1-5')).toBe(false);
    expect(isCalendarDate('')).toBe(false);
  });
});

describe('localDate', () => {
  it('gives the day of the instant in the time zone', () => {
    const now = new Date('2026-11-20T03:00:00Z');
    expect(localDate(now, 'America/Toronto')).toBe('2026-11-19');
    expect(localDate(now, 'Europe/Paris')).toBe('2026-11-20');
    expect(localDate(now, 'Pacific/Kiritimati')).toBe('2026-11-20');
  });
});

describe('addToDate', () => {
  it('moves by calendar days and years', () => {
    expect(addToDate('2026-10-05', { days: 42 })).toBe('2026-11-16');
    expect(addToDate('2026-12-28', { days: 7 })).toBe('2027-01-04');
    expect(addToDate('2026-11-19', { years: 1 })).toBe('2027-11-19');
  });
});

describe('zonedMidnight', () => {
  it('finds local midnight in summer and winter time', () => {
    expect(zonedMidnight('2026-10-05', 'America/Toronto').toISOString()).toBe(
      '2026-10-05T04:00:00.000Z',
    );
    expect(zonedMidnight('2026-11-16', 'America/Toronto').toISOString()).toBe(
      '2026-11-16T05:00:00.000Z',
    );
    expect(zonedMidnight('2026-11-16', 'Asia/Kolkata').toISOString()).toBe(
      '2026-11-15T18:30:00.000Z',
    );
  });

  it('finds midnight on the day the clocks change', () => {
    // Back to winter time at 2:00 on Sunday 1 November 2026 in Montréal.
    expect(zonedMidnight('2026-11-01', 'America/Toronto').toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    );
    // To summer time at 2:00 on Sunday 8 March 2026.
    expect(zonedMidnight('2026-03-08', 'America/Toronto').toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    );
  });

  it('takes the first instant of the day where the clocks skip midnight', () => {
    // Chile goes from 0:00 to 1:00 on Sunday 6 September 2026.
    const start = zonedMidnight('2026-09-06', 'America/Santiago');
    expect(start.toISOString()).toBe('2026-09-06T04:00:00.000Z');
    expect(localDate(start, 'America/Santiago')).toBe('2026-09-06');
  });
});

describe('zonedMidnight east of Greenwich', () => {
  it('takes the change itself where the clocks skip midnight', () => {
    // Beirut goes from 0:00 (UTC+2) to 1:00 (UTC+3) on Sunday 29 March 2026.
    const start = zonedMidnight('2026-03-29', 'Asia/Beirut');
    expect(start.toISOString()).toBe('2026-03-28T22:00:00.000Z');
    expect(localDate(new Date(start.getTime() - 1), 'Asia/Beirut')).toBe('2026-03-28');
  });
});

describe('isStartDateInRange', () => {
  it('ends on the same day next year, the 1st of March after a 29 February', () => {
    const now = new Date('2028-02-29T17:00:00Z');
    expect(isStartDateInRange('2029-03-01', 'America/Toronto', now)).toBe(true);
    expect(isStartDateInRange('2029-03-02', 'America/Toronto', now)).toBe(false);
  });
});

describe('challengeWindow', () => {
  it('lasts whole local weeks across the change to winter time', () => {
    const { startsAt, endsAt } = challengeWindow('2026-10-05', 6, 'America/Toronto');

    expect(startsAt.toISOString()).toBe('2026-10-05T04:00:00.000Z');
    // Local midnight again, one hour later in UTC: not 6 × 7 × 24 h.
    expect(endsAt.toISOString()).toBe('2026-11-16T05:00:00.000Z');
  });
});
