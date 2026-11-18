// Configuration read from the VITE_* variables. They end up in the bundle:
// public values only (addresses, public identifiers), never a secret.

export interface Config {
  /** Address of the backend API, without a trailing slash. */
  apiUrl: string;
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

export function readConfig(env: Record<string, unknown>): Config {
  const apiUrl = env.VITE_API_URL;
  if (typeof apiUrl !== 'string' || apiUrl === '') {
    throw new Error('VITE_API_URL is missing: copy .env.example to .env.local and set it.');
  }
  if (!URL.canParse(apiUrl) || !['http:', 'https:'].includes(new URL(apiUrl).protocol)) {
    throw new Error(`VITE_API_URL is not an http(s) address: ${apiUrl}`);
  }
  // The access token travels to this address: plain http only in development
  // or to the local machine.
  const { protocol, hostname } = new URL(apiUrl);
  if (protocol === 'http:' && env.DEV !== true && !LOCAL_HOSTS.includes(hostname)) {
    throw new Error(`VITE_API_URL must use https outside development: ${apiUrl}`);
  }
  return { apiUrl: apiUrl.replace(/\/+$/, '') };
}

// Evaluated on import: the app fails at startup when a variable is missing.
export const config = readConfig(import.meta.env);
