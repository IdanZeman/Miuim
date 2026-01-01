import React, { useState } from 'react';
import { Info } from '@phosphor-icons/react';
import { Modal } from './Modal';
import { Button } from './Button';

interface PageInfoProps {
    title: string;
    description: React.ReactNode;
    children?: React.ReactNode; // For extra buttons/content
}

export const PageInfo: React.FC<PageInfoProps> = ({ title, description, children }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="text-slate-400 hover:text-blue-500 transition-colors p-1 rounded-full hover:bg-slate-50"
                title="מידע נוסף"
            >
                <Info size={18} weight="duotone" />
            </button>
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={title} size="md">
                <div className="space-y-4 text-center">
                    <div className="bg-blue-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-blue-600 mb-2">
                        <Info size={32} weight="duotone" />
                    </div>
                    {typeof description === 'string' ? (
                        <div className="text-slate-600 whitespace-pre-line leading-relaxed">
                            {description}
                        </div>
                    ) : (
                        <div className="text-slate-600">
                            {description}
                        </div>
                    )}

                    {children && (
                        <div className="pt-2 flex flex-col gap-2">
                            {children}
                        </div>
                    )}

                    <div className="pt-2">
                        <Button variant="ghost" className="w-full justify-center" onClick={() => setIsOpen(false)}>
                            הבנתי, תודה
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};
