import React, { createContext, useContext, useState, useCallback } from 'react';

interface ProcessingState {
    isProcessing: boolean;
    message: string;
    progress?: number; // 0 to 100
}

interface ProcessingContextType {
    state: ProcessingState;
    startProcessing: (message: string) => void;
    updateProgress: (progress: number, message?: string) => void;
    stopProcessing: () => void;
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

export const ProcessingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<ProcessingState>({
        isProcessing: false,
        message: '',
    });

    const startProcessing = useCallback((message: string) => {
        setState({ isProcessing: true, message, progress: undefined });
    }, []);

    const updateProgress = useCallback((progress: number, message?: string) => {
        setState(prev => ({
            ...prev,
            progress,
            message: message !== undefined ? message : prev.message
        }));
    }, []);

    const stopProcessing = useCallback(() => {
        setState({ isProcessing: false, message: '', progress: undefined });
    }, []);

    return (
        <ProcessingContext.Provider value={{ state, startProcessing, updateProgress, stopProcessing }}>
            {children}
        </ProcessingContext.Provider>
    );
};

export const useProcessing = () => {
    const context = useContext(ProcessingContext);
    if (context === undefined) {
        throw new Error('useProcessing must be used within a ProcessingProvider');
    }
    return context;
};
