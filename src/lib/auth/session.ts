import type { Session } from '../../api/client';
import type { Auth } from './auth';

/**
 * Session of the API client, from the authentication. A lost session is not
 * ended here: its 401 reaches the query client, whose handler (App) signs in
 * again or shows the end of the session.
 */
export function sessionFromAuth(auth: Auth): Session {
  return {
    getAccessToken: () => auth.getAccessToken(),
    renew: async () =>
      (await auth.getAccessToken({ forceRefresh: true }).catch(() => undefined)) !== undefined,
    expire: () => undefined,
  };
}
