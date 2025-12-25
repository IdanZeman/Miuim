import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ArrowRight } from 'lucide-react';
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
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
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
        // Reset error state after a short delay to allow navigation
        setTimeout(() => {
            this.setState({ hasError: false, error: null });
        }, 100);
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center border-t-4 border-red-500">
                        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-10 h-10 text-red-600" />
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
                                <ArrowRight size={20} />
                                חזור אחורה
                            </button>

                            <button
                                onClick={this.handleReload}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                            >
                                <RefreshCw size={20} />
                                רענן עמוד
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors"
                            >
                                <Home size={20} />
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
