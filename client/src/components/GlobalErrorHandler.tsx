import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

export class GlobalErrorHandler extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);

        // Check for ChunkLoadError (MIME type error 'text/html' is a symptom of this)
        if (error.message?.includes('Loading chunk') || error.message?.includes('text/html') || error.name === 'ChunkLoadError') {
            console.log('🔄 ChunkLoadError detected. Reloading page...');
            // Force reload to get new version
            window.location.reload();
        }
    }

    public render() {
        if (this.state.hasError) {
            // Ideally we render a fallback UI here, but for ChunkLoadErrors we usually reload before this is seen.
            // For other errors, we can show a nice error page.
            return this.props.children; // Continue showing children if possible, or maybe a fallback
        }

        return this.props.children;
    }
}
