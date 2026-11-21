import { isWithin } from './pendingNavigation';

describe('isWithin', () => {
  it('keeps the address itself and those below it', () => {
    expect(isWithin('/challenges/a', '/challenges/a')).toBe(true);
    expect(isWithin('/challenges/a/participants', '/challenges/a')).toBe(true);
  });

  it('leaves out a sibling sharing the start of the address', () => {
    expect(isWithin('/challenges/ab', '/challenges/a')).toBe(false);
    expect(isWithin('/activities', '/challenges/a')).toBe(false);
  });
});
