import { isPageSize, pageLimit } from './pageSize';

describe('pageSize', () => {
  it('reads 10 and 50 as is, and all in pages of 100', () => {
    expect(pageLimit('10')).toBe(10);
    expect(pageLimit('50')).toBe(50);
    expect(pageLimit('all')).toBe(100);
  });

  it('only accepts the sizes offered', () => {
    expect(isPageSize('50')).toBe(true);
    expect(isPageSize('20')).toBe(false);
    expect(isPageSize(null)).toBe(false);
  });
});
