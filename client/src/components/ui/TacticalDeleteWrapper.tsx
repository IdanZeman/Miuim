import React from 'react';

interface TacticalDeleteWrapperProps {
    children: React.ReactNode;
    isAnimating: boolean;
    className?: string;
}

/**
 * Wrapper component that applies tactical delete animation styles
 * Wrap any element you want to animate with this component
 * 
 * Usage:
 * <TacticalDeleteWrapper isAnimating={isAnimating(item.id)}>
 *   <YourComponent />
 * </TacticalDeleteWrapper>
 */
export const TacticalDeleteWrapper: React.FC<TacticalDeleteWrapperProps> = ({
    children,
    isAnimating,
    className = ''
}) => {
    return (
        <div
            className={`${className} ${isAnimating ? 'tactical-delete-animation' : ''}`}
            style={{
                overflow: 'hidden',
                transformOrigin: 'center',
            }}
        >
            {children}
        </div>
    );
};

/**
 * Global styles component - include once in your app root or layout
 * Add this component at the top level of your app (e.g., in App.tsx or _app.tsx)
 */
export const TacticalDeleteStyles: React.FC = () => {
    return (
        <style>{`
            @keyframes tactical-scramble {
                0% {
                    filter: blur(0px);
                    transform: scale(1);
                }
                20% {
                    filter: blur(0px) drop-shadow(0 0 2px rgba(34, 211, 238, 0.4));
                }
                40% {
                    filter: blur(3px) drop-shadow(0 0 4px rgba(34, 211, 238, 0.6));
                    transform: scale(1.02);
                }
                60% {
                    filter: blur(8px) drop-shadow(0 0 6px rgba(251, 191, 36, 0.5));
                    opacity: 0.8;
                }
                80% {
                    filter: blur(15px) drop-shadow(0 0 8px rgba(239, 68, 68, 0.4));
                    opacity: 0.5;
                    transform: scale(0.98);
                }
                100% {
                    filter: blur(20px);
                    opacity: 0;
                    transform: scale(0.95);
                }
            }

            @keyframes tactical-collapse {
                0% {
                    max-height: 500px;
                    margin-bottom: 0.75rem;
                    opacity: 1;
                }
                100% {
                    max-height: 0;
                    margin-bottom: 0;
                    padding-top: 0;
                    padding-bottom: 0;
                    opacity: 0;
                }
            }

            .tactical-delete-animation {
                animation: 
                    tactical-scramble 1s ease-in-out forwards,
                    tactical-collapse 0.3s 1s ease-out forwards;
                pointer-events: none;
            }

            .tactical-delete-animation * {
                animation: inherit;
            }
        `}</style>
    );
};
