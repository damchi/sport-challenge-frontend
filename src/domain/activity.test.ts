import { activityTimeZones } from './activity';

describe('activityTimeZones', () => {
  it("takes the device's time zone without an ongoing challenge", () => {
    expect(activityTimeZones([], 'Europe/Paris')).toEqual(['Europe/Paris']);
  });

  it('takes the time zones of the challenges where the user takes part, once each', () => {
    expect(
      activityTimeZones(
        [
          { timezone: 'America/Toronto', my_status: 'active' },
          { timezone: 'America/Vancouver', my_status: 'abandoned' },
          { timezone: 'Europe/Paris', my_status: null },
          { timezone: 'America/Toronto', my_status: 'active' },
          { timezone: 'Asia/Tokyo', my_status: 'active' },
        ],
        'Europe/Paris',
      ),
    ).toEqual(['America/Toronto', 'Asia/Tokyo']);
  });

  it("falls back on the device's when the user takes part in none of them", () => {
    expect(
      activityTimeZones([{ timezone: 'America/Toronto', my_status: 'abandoned' }], 'Europe/Paris'),
    ).toEqual(['Europe/Paris']);
  });
});
