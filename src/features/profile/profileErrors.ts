import { ApiError } from '../../api/errors';

export type ProfileField = 'pseudo' | 'first_name' | 'last_name';

export const NAME_FIELDS = ['first_name', 'last_name'] as const;

// Fields a validation_failed answer names, with their message. For the
// pseudo, 409 means taken (contract); a 400 gives no reason, so the message
// stays generic.
export function fieldErrors(error: unknown): [ProfileField, string][] {
  if (!(error instanceof ApiError) || error.code !== 'validation_failed') return [];
  const fields = (error.params.fields ?? '').split(',');
  const errors: [ProfileField, string][] = [];
  if (fields.includes('pseudo')) {
    errors.push([
      'pseudo',
      error.status === 409 ? 'profile.pseudo.taken' : 'profile.pseudo.invalid',
    ]);
  }
  for (const field of NAME_FIELDS) {
    if (fields.includes(field)) errors.push([field, 'profile.name.invalid']);
  }
  return errors;
}
