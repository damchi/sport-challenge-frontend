// Configuration read from the VITE_* variables. They end up in the bundle:
// public values only (addresses, public identifiers), never a secret.

export interface Config {
  /** Address of the backend API, without a trailing slash. */
  apiUrl: string;
  auth0: {
    /** Auth0 tenant domain, without protocol (sport-challenge-prod.ca.auth0.com). */
    domain: string;
    /** Client ID of the SPA: public, it identifies the app to Auth0. */
    clientId: string;
    /** Identifier of the backend API: the access token is issued for it. */
    audience: string;
  };
  /** Sentry DSN: public, it only lets the app send errors. Absent: no error tracking. */
  sentryDsn: string | undefined;
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

function required(env: Record<string, unknown>, name: string): string {
  const value = env[name];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${name} is missing: copy .env.example to .env.local and set it.`);
  }
  return value;
}

export function readConfig(env: Record<string, unknown>): Config {
  const apiUrl = required(env, 'VITE_API_URL');
  // new URL rather than URL.canParse: older Safari versions lack the latter.
  let url: URL | undefined;
  try {
    url = new URL(apiUrl);
  } catch {
    url = undefined;
  }
  if (!url || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`VITE_API_URL is not an http(s) address: ${apiUrl}`);
  }
  // The access token travels to this address: plain http only in development
  // or to the local machine.
  const { protocol, hostname } = url;
  if (protocol === 'http:' && env.DEV !== true && !LOCAL_HOSTS.includes(hostname)) {
    throw new Error(`VITE_API_URL must use https outside development: ${apiUrl}`);
  }

  const domain = required(env, 'VITE_AUTH0_DOMAIN');
  // A bare host name: the SDK adds https itself.
  if (!/^[a-z0-9.-]+$/i.test(domain)) {
    throw new Error(`VITE_AUTH0_DOMAIN must be a host name, without protocol: ${domain}`);
  }

  const sentryDsn = env.VITE_SENTRY_DSN;
  if (sentryDsn !== undefined && typeof sentryDsn !== 'string') {
    throw new Error('VITE_SENTRY_DSN must be a string');
  }
  // Errors travel to this address: https only.
  if (sentryDsn && !sentryDsn.startsWith('https://')) {
    throw new Error(`VITE_SENTRY_DSN must be an https address: ${sentryDsn}`);
  }

  return {
    apiUrl: apiUrl.replace(/\/+$/, ''),
    auth0: {
      domain,
      clientId: required(env, 'VITE_AUTH0_CLIENT_ID'),
      audience: required(env, 'VITE_AUTH0_AUDIENCE'),
    },
    sentryDsn: sentryDsn || undefined,
  };
}

let current: Config | undefined;

/** Configuration of the app; main.tsx reads it first, so a mistake stops the startup. */
export function getConfig(): Config {
  current ??= readConfig(import.meta.env);
  return current;
}
