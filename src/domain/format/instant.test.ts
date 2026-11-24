import { dateTime } from './instant';

describe('dateTime', () => {
  const instant = '2026-11-24T14:30:00Z';

  it('writes the instant to the minute, with its year, in the time zone', () => {
    expect(dateTime(instant, 'America/Montreal', 'fr')).toBe('24 nov. 2026, 09:30');
    expect(dateTime(instant, 'Europe/Paris', 'en')).toBe('Nov 24, 2026, 3:30 PM');
  });
});
