import React from 'react';
import { GenericModal, GenericModalProps } from './GenericModal';

// Re-export props for backward compatibility
export type ModalProps = GenericModalProps;

/**
 * The standard Modal component describing the standard UI for 
 * creating dialogs, popovers, and bottom sheets.
 * NOW INHERITING FROM GenericModal for standardization.
 */
export const Modal: React.FC<ModalProps> = (props) => {
    return <GenericModal {...props} />;
};
