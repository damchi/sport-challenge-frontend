import { formatEnteredKm, formatFactor, formatKm, formatMeters, formatSpeed } from './distance';

describe('formatKm', () => {
  it('writes km in the language, one decimal for short distances', () => {
    // French puts a narrow no-break space before the unit and between thousands.
    expect(formatKm(12.5, 'fr')).toBe('12,5 km');
    expect(formatKm(12.5, 'en')).toBe('12.5 km');
    expect(formatKm(7, 'fr')).toBe('7 km');
    expect(formatKm(2.25, 'en')).toBe('2.3 km');
  });

  it('drops the decimals from 100 km', () => {
    expect(formatKm(100.4, 'en')).toBe('100 km');
    expect(formatKm(1234.5, 'fr')).toBe('1 235 km');
  });
});

describe('formatFactor', () => {
  it('writes the factor in the language', () => {
    expect(formatFactor(0.3, 'fr')).toBe('×0,3');
    expect(formatFactor(0.25, 'en')).toBe('×0.25');
    expect(formatFactor(1, 'fr')).toBe('×1');
  });
});

describe('formatSpeed', () => {
  it('writes meters per second as km/h in the language', () => {
    expect(formatSpeed(3, 'fr')).toBe('10,8\u202fkm/h');
    expect(formatSpeed(3, 'en')).toBe('10.8 km/h');
    expect(formatSpeed(2.5, 'en')).toBe('9 km/h');
  });
});

describe('formatEnteredKm', () => {
  it('keeps the distance as typed, to the meter', () => {
    expect(formatEnteredKm(10.04, 'fr')).toBe('10,04\u202fkm');
    expect(formatEnteredKm(8.215, 'en')).toBe('8.215 km');
    expect(formatEnteredKm(8.2, 'fr')).toBe('8,2\u202fkm');
  });
});

describe('formatMeters', () => {
  it('writes whole meters in the language, 0 included', () => {
    expect(formatMeters(450, 'fr')).toBe('450\u202fm');
    expect(formatMeters(1250, 'fr')).toBe('1\u202f250\u202fm');
    expect(formatMeters(1250, 'en')).toBe('1,250 m');
    expect(formatMeters(0, 'en')).toBe('0 m');
  });
});
