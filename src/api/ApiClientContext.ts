import { createContext, useContext } from 'react';
import type { ApiClient } from './client';

export const ApiClientContext = createContext<ApiClient | undefined>(undefined);

/** The app's API client; every request goes through the hooks of src/api/hooks. */
export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (!client) throw new Error('useApiClient must be used inside ApiClientContext');
  return client;
}
