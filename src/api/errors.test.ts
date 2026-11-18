import i18n from 'i18next';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';
import { ApiError, errorMessage } from './errors';

// Codes the client produces itself (no response, no readable body, status
// fallbacks), the 429 with a delay and the configuration error of main.tsx:
// the interface must translate them all.
const CLIENT_KEYS = [
  'errors.app_unavailable',
  'errors.network_error',
  'errors.unknown',
  'errors.unauthenticated',
  'errors.forbidden',
  'errors.not_found',
  'errors.internal_error',
  'errors.rate_limited',
  'errors.rate_limited_delay',
];

function lookup(messages: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      messages,
    );
}

describe('error messages', () => {
  it.each(CLIENT_KEYS)('%s exists in French and English', (key) => {
    expect(typeof lookup(fr, key)).toBe('string');
    expect(typeof lookup(en, key)).toBe('string');
  });

  it('maps an error to its key and values', () => {
    expect(errorMessage(new ApiError('network_error', 0), (key) => i18n.exists(key))).toEqual({
      key: 'errors.network_error',
      values: {},
    });
  });

  it('falls back on errors.unknown for a code without text', () => {
    const error = new ApiError('week_locked', 409, { week: '3' });

    expect(errorMessage(error, (key) => i18n.exists(key))).toEqual({
      key: 'errors.unknown',
      values: {},
    });
  });
});
