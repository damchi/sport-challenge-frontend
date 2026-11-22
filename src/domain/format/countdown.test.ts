import { countdown } from './countdown';

describe('countdown', () => {
  const start = new Date('2026-11-29T05:00:00Z');

  it('splits the time left in days, hours and minutes, rounded down', () => {
    expect(countdown(new Date('2026-11-22T03:28:30Z'), start)).toEqual({
      days: 7,
      hours: 1,
      minutes: 31,
    });
  });

  it('is zero once the instant is reached or past', () => {
    expect(countdown(start, start)).toEqual({ days: 0, hours: 0, minutes: 0 });
    expect(countdown(new Date('2026-11-30T00:00:00Z'), start)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
    });
  });

  it('counts the last minute until it is over', () => {
    expect(countdown(new Date('2026-11-29T04:59:01Z'), start)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
    });
    expect(countdown(new Date('2026-11-29T04:58:59Z'), start)).toEqual({
      days: 0,
      hours: 0,
      minutes: 1,
    });
  });
});
