import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Test server, started for every test file by src/setupTests.ts. */
export const server = setupServer(...handlers);
