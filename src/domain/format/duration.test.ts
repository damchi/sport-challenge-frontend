import { formatActivityDuration, formatDuration } from './duration';

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
