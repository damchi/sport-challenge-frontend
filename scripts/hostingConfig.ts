// Firebase Hosting configuration of the production site (docs/deploiement.md),
// written to firebase.json by scripts/write-hosting-config.ts after the build.
// The content security policy is built from the same VITE_* values as the
// bundle, so an address only changes in one place.

import { createHash } from 'node:crypto';

export interface HostingEnv {
  VITE_API_URL: string;
  VITE_AUTH0_DOMAIN: string;
  VITE_SENTRY_DSN?: string;
}

/** CSP hashes of the inline scripts of index.html (the theme set before the first paint). */
export function inlineScriptHashes(html: string): string[] {
  const scripts = html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g);
  return [...scripts].map(
    ([, body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
  );
}

function origin(address: string, name: string): string {
  try {
    return new URL(address).origin;
  } catch {
    throw new Error(`${name} is not an address: ${address}`);
  }
}

/** The policy of every page: only this site, the API, Auth0 and Sentry. */
export function contentSecurityPolicy(env: HostingEnv, scriptHashes: string[]): string {
  const api = origin(env.VITE_API_URL, 'VITE_API_URL');
  const auth0 = origin(`https://${env.VITE_AUTH0_DOMAIN}`, 'VITE_AUTH0_DOMAIN');
  // Errors go to the host of the DSN (https://key@o1.ingest.sentry.io/2).
  const sentry = env.VITE_SENTRY_DSN ? [origin(env.VITE_SENTRY_DSN, 'VITE_SENTRY_DSN')] : [];
  const directives: [string, ...string[]][] = [
    ['default-src', "'self'"],
    ['script-src', "'self'", ...scriptHashes],
    ['style-src', "'self'"],
    ['img-src', "'self'"],
    ['font-src', "'self'"],
    ['connect-src', "'self'", api, auth0, ...sentry],
    // Auth0 restores the session in a hidden iframe when there is no refresh token.
    ['frame-src', auth0],
    // The service worker, and the Auth0 SDK's worker that keeps the refresh
    // token in memory (it starts it from a blob).
    ['worker-src', "'self'", 'blob:'],
    ['manifest-src', "'self'"],
    ['object-src', "'none'"],
    ['base-uri', "'none'"],
    ['form-action', "'self'"],
    // Nobody frames the app (clickjacking, PR #95): an invitation link opened in
    // a frame would join its challenge without a click (SC-WEB-107).
    ['frame-ancestors', "'none'"],
  ];
  return directives.map((directive) => directive.join(' ')).join('; ');
}

const NO_CACHE = { key: 'Cache-Control', value: 'no-cache' };

/** firebase.json for the build in dist/. */
export function hostingConfig(env: HostingEnv, indexHtml: string) {
  const csp = contentSecurityPolicy(env, inlineScriptHashes(indexHtml));
  return {
    hosting: {
      public: 'dist',
      ignore: ['firebase.json', '**/.*'],
      // The app's addresses have no dot; files all have one. A missing file
      // (an old release's chunk, sw.js...) is a 404, never index.html.
      rewrites: [{ regex: '^[^.]*$', destination: '/index.html' }],
      headers: [
        {
          source: '**',
          headers: [
            { key: 'Content-Security-Policy', value: csp },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          ],
        },
        // Pages and the service worker: always checked, so a release shows at once.
        { regex: '^[^.]*$', headers: [NO_CACHE] },
        { source: '/index.html', headers: [NO_CACHE] },
        { source: '/sw.js', headers: [NO_CACHE] },
        // Names carry a hash: a file never changes.
        {
          source: '/assets/**',
          headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
        },
        {
          source: '/manifest.webmanifest',
          headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
        },
      ],
    },
  };
}
