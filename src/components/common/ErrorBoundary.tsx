import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Warning as AlertTriangle, ArrowsClockwise as RefreshCw, House as Home, ArrowRight } from '@phosphor-icons/react';
import { logger } from '../../services/loggingService';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Check for chunk loading errors (deployment updates)
        const isChunkError = error.message && (
            error.message.includes('Loading chunk') ||
            error.message.includes('dynamically imported module') ||
            error.message.includes('not a valid JavaScript MIME type') ||
            error.message.includes("Unexpected token '<'") ||
            error.name === 'SyntaxError'
        );

        // If it's a chunk error, we still set error state but we'll handle it in render/componentDidCatch
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const isChunkError = error.message && (
            error.message.includes('Loading chunk') ||
            error.message.includes('dynamically imported module') ||
            error.message.includes('not a valid JavaScript MIME type') ||
            error.message.includes("Unexpected token '<'") ||
            error.name === 'SyntaxError'
        );

        if (isChunkError) {
            console.log('🔄 Application update detected (Chunk Load Error). Reloading...');
            // Short delay to prevent infinite reload loops if it's a persistent error, 
            // but fast enough to be seamless.
            // Usually chunk errors are permanent until reload.
            window.location.reload();
            return;
        }

        console.error('Uncaught error:', error, errorInfo);
        logger.error('ERROR', 'Uncaught UI Exception', error, errorInfo.componentStack);
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    private handleGoBack = () => {
        window.history.back();
        setTimeout(() => {
            this.setState({ hasError: false, error: null });
        }, 100);
    };

    public render() {
        if (this.state.hasError) {
            const isChunkError = this.state.error && (
                this.state.error.message.includes('Loading chunk') ||
                this.state.error.message.includes('dynamically imported module') ||
                this.state.error.message.includes('not a valid JavaScript MIME type') ||
                this.state.error.message.includes("Unexpected token '<'") ||
                this.state.error.name === 'SyntaxError'
            );

            // Silent reload for updates
            if (isChunkError) {
                return (
                    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4 opacity-80">
                            <RefreshCw size={32} className="text-blue-500 animate-spin" weight="bold" />
                            <p className="text-slate-600 font-medium font-sans">מתעדכן לגרסה חדשה...</p>
                        </div>
                    </div>
                );
            }

            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center border-t-4 border-red-500">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle size={40} className="text-red-600" weight="bold" />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-800 mb-2">
                            אופס! משהו השתבש
                        </h1>

                        <p className="text-slate-600 mb-8 leading-relaxed">
                            נתקלנו בשגיאה לא צפויה. המערכת דיווחה על התקלה לצוות הפיתוח ואנו נבדוק אותה בהקדם.
                        </p>

                        {this.state.error && (
                            <div className="bg-slate-100 p-4 rounded-lg text-left mb-8 overflow-auto max-h-32 text-xs font-mono text-slate-500 dir-ltr">
                                {this.state.error.toString()}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={this.handleGoBack}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                            >
                                <ArrowRight size={20} weight="bold" />
                                חזור אחורה
                            </button>

                            <button
                                onClick={this.handleReload}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                            >
                                <RefreshCw size={20} weight="bold" />
                                רענן עמוד
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors"
                            >
                                <Home size={20} weight="bold" />
                                מסך ראשי
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
