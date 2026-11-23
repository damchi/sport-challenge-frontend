import { hoursAndMinutes, formatActivityDuration, formatDuration, formatPace } from './duration';

describe('formatDuration', () => {
  it('writes hours and minutes', () => {
    expect(formatDuration(3900)).toBe('1:05');
    expect(formatDuration(2700)).toBe('0:45');
  });

  it('drops the seconds left over', () => {
    expect(formatDuration(59)).toBe('0:00');
    expect(formatDuration(3659)).toBe('1:00');
  });

  it('keeps counting hours past a day', () => {
    expect(formatDuration(99_000)).toBe('27:30');
  });
});

describe('formatActivityDuration', () => {
  it('writes hours, minutes and seconds', () => {
    expect(formatActivityDuration(3930)).toBe('1:05:30');
    expect(formatActivityDuration(2700)).toBe('0:45:00');
    expect(formatActivityDuration(86_400)).toBe('24:00:00');
  });
});

describe('formatPace', () => {
  it('writes minutes and seconds, rounded to the second', () => {
    expect(formatPace(307)).toBe('5:07');
    expect(formatPace(329.4)).toBe('5:29');
    expect(formatPace(59.6)).toBe('1:00');
  });

  it('writes hours from an hour per kilometer', () => {
    expect(formatPace(3725)).toBe('1:02:05');
  });
});

describe('hoursAndMinutes', () => {
  it('splits a duration into whole hours and minutes, the seconds dropped', () => {
    expect(hoursAndMinutes(0)).toEqual({ hours: 0, minutes: 0 });
    expect(hoursAndMinutes(45 * 60 + 59)).toEqual({ hours: 0, minutes: 45 });
    expect(hoursAndMinutes(14 * 3600)).toEqual({ hours: 14, minutes: 0 });
    expect(hoursAndMinutes(14 * 3600 + 30 * 60 + 12)).toEqual({ hours: 14, minutes: 30 });
  });
});
