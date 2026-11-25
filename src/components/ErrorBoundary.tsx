import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Component, type ReactNode } from 'react';
import { ErrorPage } from './ErrorPage';

interface BoundaryProps {
  children: ReactNode;
  resetKey: string;
  onReset: () => void;
}

interface BoundaryState {
  failed: boolean;
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  retry = () => {
    this.props.onReset();
    this.setState({ failed: false });
  };

  // Leaves the error page once shown, when the key changes (a navigation).
  // Not on the update that failed: the new page itself may have thrown.
  override componentDidUpdate(previousProps: BoundaryProps, previousState: BoundaryState) {
    if (previousState.failed && previousProps.resetKey !== this.props.resetKey) this.retry();
  }

  override render() {
    return this.state.failed ? <ErrorPage onRetry={this.retry} /> : this.props.children;
  }
}

/**
 * Catches a rendering error of the page below it and shows an error page
 * with a retry, which also lets failed queries load again. A change of
 * `resetKey` leaves the error page the same way, without remounting what is
 * below while it renders well.
 */
export function ErrorBoundary({ children, resetKey }: { children: ReactNode; resetKey: string }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <Boundary resetKey={resetKey} onReset={reset}>
          {children}
        </Boundary>
      )}
    </QueryErrorResetBoundary>
  );
}
