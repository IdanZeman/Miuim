import { useEffect, useRef } from 'react';
import { analytics } from '../services/analytics';

export const usePageTracking = (pageName: string) => {
  const startTimeRef = useRef<number>(Date.now());
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    // Reset on page change
    startTimeRef.current = Date.now();
    hasTrackedRef.current = false;

    // Track scroll depth
    let maxScrollDepth = 0;
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const scrollPercent = Math.round(((scrollTop + windowHeight) / documentHeight) * 100);
      
      if (scrollPercent > maxScrollDepth) {
        maxScrollDepth = scrollPercent;
      }
    };

    window.addEventListener('scroll', handleScroll);

    // Track time on page when leaving
    return () => {
      window.removeEventListener('scroll', handleScroll);
      
      if (!hasTrackedRef.current) {
        const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
        analytics.trackTimeOnPage(pageName, timeSpent);
        
        if (maxScrollDepth > 0) {
          analytics.trackScrollDepth(pageName, maxScrollDepth);
        }
        
        hasTrackedRef.current = true;
      }
    };
  }, [pageName]);
};
