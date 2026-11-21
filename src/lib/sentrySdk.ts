// The part of the Sentry SDK the app uses, loaded apart by errorTracking.ts.
// Named imports, so the bundler leaves out the rest (replay, feedback, tracing).
export { captureException, init } from '@sentry/react';
