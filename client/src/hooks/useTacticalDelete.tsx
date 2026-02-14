import { useState, useCallback } from 'react';

/**
 * Custom hook for tactical delete animation with scramble effect
 * Use this hook to add military-style digital scramble animation to any delete operation
 * 
 * @param onDelete - Function that performs the actual deletion (sync or async)
 * @param animationDuration - Total duration in ms (default: 1300ms = 1s scramble + 0.3s collapse)
 * @returns Object with state and handlers for tactical delete
 */
export const useTacticalDelete = <T extends string | number>(
    onDelete: (id: T) => Promise<void> | void,
    animationDuration: number = 1300
) => {
    const [animatingIds, setAnimatingIds] = useState<Set<T>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    /**
     * Initiates the tactical delete animation and performs deletion
     * @param id - Unique identifier of the item to delete
     */
    const handleTacticalDelete = useCallback(async (id: T) => {
        // Start animation immediately
        setAnimatingIds(prev => new Set(prev).add(id));
        setIsDeleting(true);

        try {
            // Execute deletion right away (don't wait)
            await Promise.resolve(onDelete(id));
            
            // But keep the animation state for visual effect
            await new Promise(resolve => setTimeout(resolve, animationDuration));
            
            // After animation, clean up state
            setAnimatingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } catch (error) {
            console.error('❌ Tactical delete failed:', error);
            // Remove animation state on error
            setAnimatingIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } finally {
            setIsDeleting(false);
        }
    }, [onDelete, animationDuration]);

    /**
     * Check if a specific item is currently animating
     */
    const isAnimating = useCallback((id: T) => animatingIds.has(id), [animatingIds]);

    /**
     * Cancel animation for a specific item (emergency stop)
     */
    const cancelAnimation = useCallback((id: T) => {
        setAnimatingIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    return {
        handleTacticalDelete,
        isAnimating,
        isDeleting,
        cancelAnimation,
        animatingIds
    };
};
