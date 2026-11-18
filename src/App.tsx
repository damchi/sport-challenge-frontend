import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { createQueryClient } from './api/queryClient';
import { GlobalErrorBanner } from './components/GlobalErrorBanner';
import { routes } from './routes/routes';

const router = createBrowserRouter(routes);

export function App() {
  const [globalError, setGlobalError] = useState<unknown>();
  const [queryClient] = useState(() => {
    const client = createQueryClient({
      // TODO(SC-WEB-016): also sign out; for now the cache goes.
      onAuthError: () => client.clear(),
      onError: setGlobalError,
    });
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      {globalError !== undefined && (
        <div className="px-5">
          <GlobalErrorBanner error={globalError} onDismiss={() => setGlobalError(undefined)} />
        </div>
      )}
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
