import { renderHook } from '@testing-library/react';
import { safeReturnTo, useAuth } from './auth';

describe('safeReturnTo', () => {
  it('keeps a path of the app', () => {
    expect(safeReturnTo('/challenges/42?tab=ranking')).toBe('/challenges/42?tab=ranking');
  });

  it.each([
    undefined,
    '',
    'challenges',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
  ])('falls back on the home page for %s', (value) => {
    expect(safeReturnTo(value)).toBe('/');
  });
});

describe('useAuth', () => {
  it('fails outside an authentication provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useAuth())).toThrow('inside an authentication provider');
  });
});
