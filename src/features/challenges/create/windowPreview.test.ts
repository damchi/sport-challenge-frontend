import { windowPreview } from './windowPreview';

// 24 November 2026 in Montréal.
const now = new Date('2026-11-24T12:00:00Z');
const zone = 'America/Montreal';

describe('windowPreview', () => {
  it('previews a start from today, not started before its first day', () => {
    expect(windowPreview('2026-11-24', 2, zone, now, 'fr')?.started).toBe(true);
    expect(windowPreview('2026-11-30', 2, zone, now, 'fr')?.started).toBe(false);
  });

  it('previews no first day already past, as the creation refuses it', () => {
    expect(windowPreview('2026-11-02', 4, zone, now, 'fr')).toBeUndefined();
  });

  it('previews a first day already past for an admin, as started', () => {
    const preview = windowPreview('2026-11-02', 4, zone, now, 'fr', { pastStart: true });

    expect(preview?.started).toBe(true);
    expect(preview?.weeks).toHaveLength(4);
    expect(preview?.zone).toBe(windowPreview('2026-11-30', 2, zone, now, 'fr')?.zone);
  });

  it('previews no first day more than a year ahead, even for an admin', () => {
    expect(windowPreview('2027-11-24', 2, zone, now, 'fr', { pastStart: true })).toBeDefined();
    expect(windowPreview('2027-11-25', 2, zone, now, 'fr', { pastStart: true })).toBeUndefined();
    expect(windowPreview('2027-11-25', 2, zone, now, 'fr')).toBeUndefined();
  });
});
