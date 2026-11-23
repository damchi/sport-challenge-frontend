import { activityClock, activityDay, weekDays, weekMonday } from './activityDates';

describe('weekDays', () => {
  it('writes a week in the language, with the year when asked', () => {
    expect(weekDays('2026-11-23', '2026-11-29', 'fr', false)).toBe('23–29 nov.');
    expect(weekDays('2026-11-30', '2026-12-06', 'fr', false)).toBe('30 nov.\u2009–\u20096 déc.');
    expect(weekDays('2026-11-23', '2026-11-29', 'en', false)).toBe('Nov 23\u2009–\u200929');
    expect(weekDays('2025-11-24', '2025-11-30', 'fr', true)).toBe('24–30 nov. 2025');
  });
});

describe('weekMonday', () => {
  it('writes the Monday of a week', () => {
    expect(weekMonday('2026-11-09', 'fr', false)).toBe('9 nov.');
    expect(weekMonday('2026-11-09', 'en', false)).toBe('Nov 9');
  });
});

describe('activityDay and activityClock', () => {
  it('read the start in the time zone given', () => {
    const start = '2026-11-21T03:30:00Z'; // Friday 20, 22:30 in Montréal
    expect(activityDay(start, 'America/Montreal', 'fr')).toBe('ven. 20 nov.');
    expect(activityClock(start, 'America/Montreal', 'fr')).toBe('22:30');
    expect(activityDay(start, 'Europe/Paris', 'fr')).toBe('sam. 21 nov.');
    expect(activityClock(start, 'Europe/Paris', 'en')).toBe('4:30 AM');
  });
});
