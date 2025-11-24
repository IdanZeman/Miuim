declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Google Analytics Measurement ID (תחליף ב-ID שלך)
export const GA_MEASUREMENT_ID = 'G-VYS2KQ5LZ6'; // TODO: החלף ב-ID אמיתי מ-Google Analytics

// Initialize Google Analytics
export const initGA = () => {
  if (typeof window === 'undefined') return;

  // Load gtag.js script
  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  script.async = true;
  document.head.appendChild(script);

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: window.location.pathname,
  });
};

// Track page views
export const trackPageView = (url: string) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: url,
    });
  }
};

// Track custom events
export const trackEvent = (
  action: string,
  category: string,
  label?: string,
  value?: number
) => {
  if (typeof window.gtag !== 'undefined') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Track specific user actions
export const analytics = {
  // Authentication events
  trackLogin: (method: string) => {
    trackEvent('login', 'Authentication', method);
  },
  trackSignup: (method: string) => {
    trackEvent('sign_up', 'Authentication', method);
  },
  trackLogout: () => {
    trackEvent('logout', 'Authentication');
  },

  // Shift management
  trackShiftCreated: (taskName: string) => {
    trackEvent('shift_created', 'Shifts', taskName);
  },
  trackShiftDeleted: (taskName: string) => {
    trackEvent('shift_deleted', 'Shifts', taskName);
  },
  trackShiftUpdated: (taskName: string) => {
    trackEvent('shift_updated', 'Shifts', taskName);
  },
  trackPersonAssigned: (personName: string, taskName: string) => {
    trackEvent('person_assigned', 'Shifts', `${personName} to ${taskName}`);
  },
  trackPersonUnassigned: (personName: string, taskName: string) => {
    trackEvent('person_unassigned', 'Shifts', `${personName} from ${taskName}`);
  },

  // Personnel management
  trackPersonAdded: (personName: string) => {
    trackEvent('person_added', 'Personnel', personName);
  },
  trackPersonUpdated: (personName: string) => {
    trackEvent('person_updated', 'Personnel', personName);
  },
  trackPersonDeleted: (personName: string) => {
    trackEvent('person_deleted', 'Personnel', personName);
  },

  // Task templates
  trackTaskTemplateCreated: (taskName: string) => {
    trackEvent('task_template_created', 'Tasks', taskName);
  },
  trackTaskTemplateUpdated: (taskName: string) => {
    trackEvent('task_template_updated', 'Tasks', taskName);
  },
  trackTaskTemplateDeleted: (taskName: string) => {
    trackEvent('task_template_deleted', 'Tasks', taskName);
  },

  // Schedule operations
  trackScheduleExported: (date: string) => {
    trackEvent('schedule_exported', 'Schedule', date);
  },
  trackDayCleared: (date: string) => {
    trackEvent('day_cleared', 'Schedule', date);
  },
  trackDateChanged: (date: string) => {
    trackEvent('date_changed', 'Navigation', date);
  },

  // View changes
  trackViewChanged: (viewName: string) => {
    trackEvent('view_changed', 'Navigation', viewName);
  },

  // Warnings
  trackWarningAcknowledged: (warningType: string) => {
    trackEvent('warning_acknowledged', 'Warnings', warningType);
  },

  // Settings
  trackSettingsUpdated: (settingName: string) => {
    trackEvent('settings_updated', 'Settings', settingName);
  },

  // Errors
  trackError: (errorMessage: string, context?: string) => {
    trackEvent('error', 'Errors', `${context}: ${errorMessage}`);
  },

  // Performance
  trackPerformance: (metric: string, value: number) => {
    trackEvent('performance', 'Performance', metric, value);
  },

  // User engagement
  trackModalOpened: (modalName: string) => {
    trackEvent('modal_opened', 'Engagement', modalName);
  },
  trackModalClosed: (modalName: string) => {
    trackEvent('modal_closed', 'Engagement', modalName);
  },
  trackFeatureUsed: (featureName: string) => {
    trackEvent('feature_used', 'Engagement', featureName);
  },
};
