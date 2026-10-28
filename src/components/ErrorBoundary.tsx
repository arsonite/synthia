/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Top-level error boundary so a crashing view never blanks the whole app.
 */

// React imports
import React from 'react';

interface IErrorBoundaryProps {
    children: React.ReactNode;
}

interface IErrorBoundaryState {
    error: Error | null;
}

class ErrorBoundary extends React.Component<IErrorBoundaryProps, IErrorBoundaryState> {
    constructor(props: IErrorBoundaryProps) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error: Error): IErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error('Uncaught error:', error, info);
    }

    render() {
        if (this.state.error) {
            return (
                <div id='error-boundary'>
                    <h2>Something went wrong</h2>
                    <p>{this.state.error.message}</p>
                    <button onClick={() => this.setState({ error: null })}>Try again</button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
