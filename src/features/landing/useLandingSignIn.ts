import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth/auth';
import { useOnline } from '../../lib/online';

/** Where the sign-in was asked from: its message shows there. */
export type SignInSource = 'top' | 'bottom';

interface SignInRequest {
  source: SignInSource;
  failed: boolean;
}

/**
 * Sign-in from the landing page, back to `/` (the challenges, or the
 * onboarding for a new account). Like RequireAuth: offline, it waits for the
 * connection and starts then; a redirect that cannot start offers a retry.
 */
export function useLandingSignIn() {
  const auth = useAuth();
  const online = useOnline();
  const [request, setRequest] = useState<SignInRequest>();
  const started = useRef(false);

  const asked = request !== undefined && !request.failed;
  useEffect(() => {
    if (!asked || !online || started.current || !request) return;
    started.current = true;
    const { source } = request;
    auth.signIn('/').catch(() => {
      started.current = false;
      setRequest({ source, failed: true });
    });
  }, [asked, online, request, auth]);

  const pending = asked && online;
  return {
    signIn: (source: SignInSource) => {
      // One redirect at a time: a double click must not start two sign-ins.
      if (!pending) setRequest({ source, failed: false });
    },
    pending,
    /** The message to show at `source`, if any. */
    message: (source: SignInSource): 'failed' | 'waiting' | undefined => {
      if (request?.source !== source) return undefined;
      if (request.failed) return 'failed';
      return online ? undefined : 'waiting';
    },
  };
}

export type LandingSignIn = ReturnType<typeof useLandingSignIn>;
