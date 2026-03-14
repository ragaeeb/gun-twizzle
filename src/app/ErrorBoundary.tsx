import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
    children: ReactNode;
    fallback: ReactNode | ((error: Error) => ReactNode);
};

type ErrorBoundaryState = {
    error: Error | null;
};

/**
 * React error boundary. Wraps children and catches rendering errors.
 *
 * Must use a class component — React does not support error boundaries
 * as function components (this is one of the AGENTS.md exceptions).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    override state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    override componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    override render() {
        if (this.state.error) {
            const { fallback } = this.props;

            return typeof fallback === 'function' ? fallback(this.state.error) : fallback;
        }

        return this.props.children;
    }
}
