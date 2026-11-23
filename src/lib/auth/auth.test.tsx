import { renderHook } from '@testing-library/react';
import { safeReturnTo, useAuth } from './auth';

describe('safeReturnTo', () => {
  const origin = 'https://app.example';

  it('keeps a path of the app', () => {
    expect(safeReturnTo('/challenges/42?tab=ranking#top', origin)).toBe(
      '/challenges/42?tab=ranking#top',
    );
  });

  it.each([
    undefined,
    '',
    'challenges',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/.//evil.example',
    '/a/..//evil.example',
  ])('falls back on the home page for %j', (value) => {
    expect(safeReturnTo(value, origin)).toBe('/challenges');
  });
});

describe('useAuth', () => {
  it('fails outside an authentication provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useAuth())).toThrow('inside an authentication provider');
  });
});
