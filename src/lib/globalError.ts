import { createContext, useContext } from 'react';

/** Error no screen shows by itself, displayed in the top banner (FD4: a React context). */
export interface GlobalError {
  error: unknown;
  dismiss: () => void;
}

export const GlobalErrorContext = createContext<GlobalError>({
  error: undefined,
  dismiss: () => undefined,
});

export function useGlobalError(): GlobalError {
  return useContext(GlobalErrorContext);
}
