import { create } from 'zustand';

interface TourState {
    activeTourId: string | null;
    queue: string[];
    completedTours: Set<string>;
    
    // Actions
    startTour: (tourId: string) => boolean;
    completeTour: (tourId: string) => void;
    skipTour: (tourId: string) => void;
    registerTour: (tourId: string) => void;
}

export const useTourStore = create<TourState>((set, get) => ({
    activeTourId: null,
    queue: [],
    completedTours: new Set(
        // Initialize from localStorage efficiently
        Object.keys(localStorage)
            .filter(k => k.startsWith('tour_completed_'))
            .map(k => k.replace('tour_completed_', ''))
    ),

    registerTour: (tourId: string) => {
        const { completedTours, activeTourId, queue } = get();
        if (completedTours.has(tourId)) return;
        if (queue.includes(tourId)) return;
        if (activeTourId === tourId) return;

        // Add to queue
        set(state => ({ queue: [...state.queue, tourId] }));
        
        // Try to start immediately if idle
        if (!get().activeTourId) {
            set(state => {
                 const next = state.queue[0];
                 if (next) {
                     return {
                         activeTourId: next,
                         queue: state.queue.slice(1)
                     };
                 }
                 return {};
            });
        }
    },

    startTour: (tourId: string) => {
        const { activeTourId, completedTours } = get();
        if (completedTours.has(tourId)) return false;
        if (activeTourId && activeTourId !== tourId) return false;
        
        set({ activeTourId: tourId });
        return true;
    },

    completeTour: (tourId: string) => {
        // Mark as done
        localStorage.setItem(`tour_completed_${tourId}`, 'true');
        
        set(state => {
            const newCompleted = new Set(state.completedTours);
            newCompleted.add(tourId);
            
            // Start next in queue if available
            const nextTourId = state.queue.length > 0 ? state.queue[0] : null;

            return {
                activeTourId: nextTourId,
                queue: state.queue.slice(1),
                completedTours: newCompleted
            };
        });
    },

    skipTour: (tourId: string) => {
        // Same as complete regarding flow, but maybe different logic later
         // Mark as done
        localStorage.setItem(`tour_completed_${tourId}`, 'true');
        
        set(state => {
            const newCompleted = new Set(state.completedTours);
            newCompleted.add(tourId);
            
            const nextTourId = state.queue.length > 0 ? state.queue[0] : null;

            return {
                activeTourId: nextTourId,
                queue: state.queue.slice(1),
                completedTours: newCompleted
            };
        });
    }
}));
