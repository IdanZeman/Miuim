import React from 'react';
import { GenericModal } from './GenericModal';
import { Button } from './Button';
import { CircleNotch as LoaderIcon } from '@phosphor-icons/react';

interface SheetModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    isSaving?: boolean;
    saveLabel?: string;
    onSave?: () => void;
    zIndex?: number;
    closeIcon?: 'close' | 'back';
}

export const SheetModal: React.FC<SheetModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    isSaving = false,
    saveLabel = 'שמור',
    onSave,
    zIndex = 100, // GenericModal generally manages its own Z-index, but we can verify if we need to override class
    closeIcon = 'close'
}) => {
    // We compose the footer if onSave is provided but no custom footer
    const effectiveFooter = footer ? footer : (onSave ? (
        <Button
            onClick={onSave}
            disabled={isSaving}
            className="w-full h-12 text-lg font-bold rounded-xl shadow-md bg-idf-yellow hover:bg-yellow-400 text-slate-900"
        >
            {isSaving ? <LoaderIcon className="animate-spin" size={24} /> : saveLabel}
        </Button>
    ) : null);

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            footer={effectiveFooter}
            closeIcon={closeIcon}
            size="md" // SheetModal was roughly "lg/md" sized on desktop, md is a good default for forms
        // We can enforce specific Sheet logic if needed, but GenericModal handles bottom sheet on mobile naturally.
        // SheetModal often had "max-h-[85vh] md:max-h-[85vh]", GenericModal does 85vh too.
        >
            {children}
        </GenericModal>
    );
};
