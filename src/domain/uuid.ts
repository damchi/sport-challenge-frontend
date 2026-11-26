// An id of the API (challenge, user, activity): a UUID (any version), in lower
// or upper case.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a value can be an id of the API. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
