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
  resetKey: string;
}

class Boundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { failed: true };
  }

  // A new key (a navigation) leaves the error page in the same render, so
  // the new page is there when the focus moves to its title. If the new page
  // throws, getDerivedStateFromError shows the error page again.
  static getDerivedStateFromProps(
    props: BoundaryProps,
    state: BoundaryState,
  ): Partial<BoundaryState> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  retry = () => {
    this.props.onReset();
    this.setState({ failed: false });
  };

  // Left by a navigation: the failed queries may load again too.
  override componentDidUpdate(previousProps: BoundaryProps, previousState: BoundaryState) {
    if (previousState.failed && previousProps.resetKey !== this.props.resetKey) {
      this.props.onReset();
    }
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
