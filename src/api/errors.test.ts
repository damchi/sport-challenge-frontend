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

  it('takes the words of a scope first, the usual ones without', () => {
    const keys = new Set(['admin.participants.errors.last_creator', 'errors.last_creator']);
    const hasKey = (key: string) => keys.has(key);
    const scope = 'admin.participants.errors';

    expect(errorMessage(new ApiError('last_creator', 422), hasKey, scope).key).toBe(
      'admin.participants.errors.last_creator',
    );
    expect(errorMessage(new ApiError('last_creator', 422), hasKey).key).toBe('errors.last_creator');
    keys.add('errors.not_found');
    expect(errorMessage(new ApiError('not_found', 404), hasKey, scope).key).toBe(
      'errors.not_found',
    );
  });

  it('says a busy refusal changed nothing', () => {
    expect(errorMessage(new ApiError('busy', 503), (key) => i18n.exists(key))).toEqual({
      key: 'errors.busy',
      values: {},
    });
  });

  it.each(['invalid_token', 'token_expired', 'account_deleted'])(
    'has a text for the session code %s',
    (code) => {
      expect(errorMessage(new ApiError(code, 401), (key) => i18n.exists(key)).key).toBe(
        `errors.${code}`,
      );
    },
  );

  it('falls back on errors.unknown for a code without text', () => {
    const error = new ApiError('cursor_invalid', 400, { week: '3' });

    expect(errorMessage(error, (key) => i18n.exists(key))).toEqual({
      key: 'errors.unknown',
      values: {},
    });
  });
});
