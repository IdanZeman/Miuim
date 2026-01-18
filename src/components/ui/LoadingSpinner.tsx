import React from 'react';
import { CircleNotch } from '@phosphor-icons/react';

interface LoadingSpinnerProps {
    size?: number;
    className?: string; // For color, margins, etc.
    weight?: 'bold' | 'bold' | 'regular' | 'fill' | 'light' | 'thin';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 24, className, weight = 'bold' }) => {
    return (
        <CircleNotch
            size={size}
            className={`animate-spin ${className || 'text-indigo-600'}`}
            weight={weight}
        />
    );
};
