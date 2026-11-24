import { adminReasonSchema } from './adminReason';

function message(reason: string): string | undefined {
  const result = adminReasonSchema.safeParse({ reason });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('adminReasonSchema', () => {
  it('takes 3 to 500 characters, trimmed', () => {
    expect(adminReasonSchema.parse({ reason: '  abc  ' })).toEqual({ reason: 'abc' });
    expect(message('a'.repeat(500))).toBeUndefined();
  });

  it('refuses 2 characters, or 3 once trimmed of none visible', () => {
    expect(message('ab')).toBe('admin.reason.short');
    expect(message('   ab   ')).toBe('admin.reason.short');
    // Joiners are kept but not visible.
    expect(message('a‍‍')).toBe('admin.reason.short');
  });

  it('refuses 501 characters, counted by code point', () => {
    expect(message('a'.repeat(501))).toBe('admin.reason.long');
    expect(message('🏃'.repeat(500))).toBeUndefined();
  });

  it('keeps line breaks and tabs, refuses other hidden characters', () => {
    expect(message('Séance\noubliée\tvue')).toBeUndefined();
    expect(message('abc\u0007')).toBe('admin.reason.characters');
  });
});
