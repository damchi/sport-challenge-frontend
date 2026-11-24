import { z } from 'zod';
import { characterCount, hasOnlyAllowedCharacters, visibleCount } from './text';

// The reason of an admin change (AdminAction.reason in the contract): 3 to
// 500 characters once trimmed, 3 of them visible, no hidden character but
// line breaks and tabs. The server trims it as well.

export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 500;

const REASON_ALLOWED = new Set(['\n', '\r', '\t', ' ', ' ']);

export const adminReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .refine((reason) => visibleCount(reason) >= REASON_MIN_LENGTH, 'admin.reason.short')
    .refine((reason) => characterCount(reason) <= REASON_MAX_LENGTH, 'admin.reason.long')
    .refine(
      (reason) => hasOnlyAllowedCharacters(reason, REASON_ALLOWED),
      'admin.reason.characters',
    ),
});

export type AdminReasonInput = z.input<typeof adminReasonSchema>;
export type AdminReason = z.output<typeof adminReasonSchema>;
