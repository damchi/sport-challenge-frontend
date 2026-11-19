import { z } from 'zod';

// Profile rules of the API contract (Pseudo, Language). Error messages are
// translation keys, so the schema stays free of any language.

export const PSEUDO_PATTERN = /^[A-Za-z0-9_.-]+$/;

export const profileSchema = z.object({
  pseudo: z
    .string()
    .trim()
    .min(3, 'profile.pseudo.length')
    .max(20, 'profile.pseudo.length')
    .regex(PSEUDO_PATTERN, 'profile.pseudo.characters'),
  language: z.enum(['fr', 'en']),
});

export type ProfileInput = z.infer<typeof profileSchema>;
