import { isUuid } from './uuid';

export type AdminActionTargetType = 'challenge' | 'participant' | 'activity' | 'user';
export const ADMIN_ACTION_TARGET_TYPES: readonly AdminActionTargetType[] = [
  'challenge',
  'participant',
  'activity',
  'user',
];

/** The filters of the admin journal, as the API takes them; they add up. */
export interface AdminActionFilters {
  target_type?: AdminActionTargetType;
  /** One target: the changes of that challenge, account or activity. */
  target_id?: string;
  /** Every change that touches a challenge, whatever its target. */
  challenge_id?: string;
}

function isTargetType(value: unknown): value is AdminActionTargetType {
  return ADMIN_ACTION_TARGET_TYPES.includes(value as AdminActionTargetType);
}

/**
 * The filters an address holds (?target_type=&target_id=&challenge_id=),
 * each checked: a value the API would refuse (an id that is no uuid) is
 * left out.
 */
export function readAdminActionFilters(params: URLSearchParams): AdminActionFilters {
  const targetType = params.get('target_type');
  const targetId = params.get('target_id');
  const challengeId = params.get('challenge_id');
  return {
    ...(isTargetType(targetType) && { target_type: targetType }),
    ...(targetId && isUuid(targetId) && { target_id: targetId }),
    ...(challengeId && isUuid(challengeId) && { challenge_id: challengeId }),
  };
}

/**
 * The admin sheet of a target, when it has one: a participant is its
 * account; an activity has none.
 */
export function adminTargetPath(type: AdminActionTargetType, id: string): string | undefined {
  if (type === 'challenge') return `/admin/challenges/${id}`;
  if (type === 'user' || type === 'participant') return `/admin/users/${id}`;
  return undefined;
}

export interface ChangedField {
  field: string;
  /** Absent when the change created the field (or the target). */
  before?: unknown;
  /** Absent when the change removed the field (or the target). */
  after?: unknown;
}

type Values = Record<string, unknown> | null;

/**
 * The fields a change touched, in the order the server wrote them (the old
 * value's first), each with its old and new value.
 */
export function changedFields(oldValue: Values, newValue: Values): ChangedField[] {
  const fields = [...new Set([...Object.keys(oldValue ?? {}), ...Object.keys(newValue ?? {})])];
  return fields.map((field) => ({
    field,
    ...(oldValue && field in oldValue && { before: oldValue[field] }),
    ...(newValue && field in newValue && { after: newValue[field] }),
  }));
}

/** A value of the journal as text: a string as is, anything else in JSON. */
export function journalValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
