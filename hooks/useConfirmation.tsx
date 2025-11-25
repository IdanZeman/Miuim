import React, { useState, useCallback } from 'react';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface ConfirmationOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void | Promise<void>;
}

export const useConfirmation = () => {
    const [state, setState] = useState<{
        isOpen: boolean;
        options: ConfirmationOptions | null;
    }>({
        isOpen: false,
        options: null,
    });

    const confirm = useCallback((options: ConfirmationOptions) => {
        setState({
            isOpen: true,
            options,
        });
    }, []);

    const close = useCallback(() => {
        setState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const handleConfirm = useCallback(async () => {
        if (state.options?.onConfirm) {
            await state.options.onConfirm();
        }
        close();
    }, [state.options, close]);

    const ModalComponent = () => (
        <ConfirmationModal
            isOpen={state.isOpen}
            title={state.options?.title || ''}
            message={state.options?.message || ''}
            confirmText={state.options?.confirmText}
            cancelText={state.options?.cancelText}
            type={state.options?.type}
            onConfirm={handleConfirm}
            onCancel={close}
        />
    );

    return { confirm, ConfirmationModal: ModalComponent };
};
