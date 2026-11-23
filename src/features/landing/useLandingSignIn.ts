import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth/auth';
import { useOnline } from '../../lib/online';
import { HOME_PATH } from '../../lib/paths';

/** Where the sign-in was asked from: its message shows there. */
export type SignInSource = 'top' | 'bottom';

interface SignInRequest {
  source: SignInSource;
  failed: boolean;
}

/**
 * Sign-in from the landing page, to the challenges (or the onboarding for a
 * new account). A signed-in user gets links to the challenges instead
 * (`signedIn`). Like RequireAuth: offline, it waits for the
 * connection and starts then; a redirect that cannot start offers a retry.
 */
export function useLandingSignIn() {
  const auth = useAuth();
  const online = useOnline();
  const navigate = useNavigate();
  const [request, setRequest] = useState<SignInRequest>();
  const started = useRef(false);

  const asked = request !== undefined && !request.failed;
  useEffect(() => {
    if (!asked || !online || started.current || !request) return;
    started.current = true;
    const { source } = request;
    auth.signIn(HOME_PATH).catch(() => {
      started.current = false;
      setRequest({ source, failed: true });
    });
  }, [asked, online, request, auth]);

  // Back from the sign-in page, a page restored from the browser's cache
  // keeps its state: the buttons must not stay disabled.
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      started.current = false;
      setRequest(undefined);
    };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, []);

  const pending = asked && online;
  return {
    signedIn: auth.isAuthenticated,
    /** Signed in now, or before on this device: « Mon compte » in the header. */
    known: auth.isAuthenticated || auth.isReturning,
    signIn: (source: SignInSource) => {
      // The session may still come back: the challenges' page waits for it,
      // then signs in only if needed.
      if (auth.isLoading) {
        void navigate(HOME_PATH);
        return;
      }
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
