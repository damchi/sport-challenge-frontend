import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Component, type ReactNode } from 'react';
import { ErrorPage } from './ErrorPage';

interface BoundaryProps {
  children: ReactNode;
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

  override render() {
    return this.state.failed ? <ErrorPage onRetry={this.retry} /> : this.props.children;
  }
}

/**
 * Catches a rendering error of the page below it and shows an error page
 * with a retry, which also lets failed queries load again.
 */
export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => <Boundary onReset={reset}>{children}</Boundary>}
    </QueryErrorResetBoundary>
  );
}
