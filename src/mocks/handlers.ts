import { http, HttpResponse } from 'msw';
import type { components } from '../api/generated/schema';

// Mock handlers shared by the tests (src/mocks/server.ts) and the development
// mocks (VITE_MOCKS=true). Each ticket adds the routes it uses, typed by the
// contract. A handler that needs the date reads `new Date()`: its tests fix it
// with vi.setSystemTime, never the real clock (the first such handler adds
// that test).

type SportList = components['schemas']['SportList'];

export const handlers = [
  // Any API address: the tests and the development server use different ones.
  http.get('*/api/v1/sports', () =>
    HttpResponse.json<SportList>({
      sports: [
        { code: 'run', distance_mode: 'required', suggested_factor: 1 },
        { code: 'ride', distance_mode: 'required', suggested_factor: 0.3 },
        { code: 'other', distance_mode: 'optional', suggested_factor: null },
      ],
    }),
  ),
];
