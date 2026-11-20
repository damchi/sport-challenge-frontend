import { activityTimeZone } from './activity';

describe('activityTimeZone', () => {
  it("takes the device's time zone without an ongoing challenge", () => {
    expect(activityTimeZone([], 'Europe/Paris')).toBe('Europe/Paris');
  });

  it('takes the time zone the challenges where the user takes part share', () => {
    expect(
      activityTimeZone(
        [
          { timezone: 'America/Toronto', my_status: 'active' },
          { timezone: 'America/Vancouver', my_status: 'abandoned' },
          { timezone: 'Asia/Tokyo', my_status: null },
          { timezone: 'America/Toronto', my_status: 'active' },
        ],
        'Europe/Paris',
      ),
    ).toBe('America/Toronto');
  });

  it("takes the device's when those challenges are in several time zones", () => {
    expect(
      activityTimeZone(
        [
          { timezone: 'America/Toronto', my_status: 'active' },
          { timezone: 'Europe/Paris', my_status: 'active' },
        ],
        'Asia/Tokyo',
      ),
    ).toBe('Asia/Tokyo');
  });

  it("takes the device's when the user takes part in none of them", () => {
    expect(
      activityTimeZone([{ timezone: 'America/Toronto', my_status: 'abandoned' }], 'Europe/Paris'),
    ).toBe('Europe/Paris');
  });
});
