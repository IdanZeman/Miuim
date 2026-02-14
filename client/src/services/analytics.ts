declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

// Google Analytics Measurement ID
export const GA_MEASUREMENT_ID = 'G-VYS2KQ5LZ6';

// Initialize Google Analytics - לא צריך כי הוא כבר נטען מה-HTML
export const initGA = () => {
  // Google Analytics כבר נטען מ-index.html
  // הפונקציה הזו כאן למקרה שצריך אתחול נוסף
  if (typeof window !== 'undefined' && window.gtag) {

  }
};

// Track page views
export const trackPageView = (url: string) => {
  if (typeof window !== 'undefined' && typeof window.gtag !== 'undefined') {
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
  if (typeof window !== 'undefined' && typeof window.gtag !== 'undefined') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Enhanced tracking for UI interactions
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

  // Button clicks
  trackButtonClick: (buttonName: string, location: string) => {
    trackEvent('button_click', 'UI', `${location}:${buttonName}`);
  },

  // Form interactions
  trackFormStart: (formName: string) => {
    trackEvent('form_start', 'Forms', formName);
  },
  trackFormSubmit: (formName: string, success: boolean) => {
    trackEvent('form_submit', 'Forms', formName, success ? 1 : 0);
  },
  trackFormFieldEdit: (formName: string, fieldName: string) => {
    trackEvent('form_field_edit', 'Forms', `${formName}:${fieldName}`);
  },

  // Navigation
  trackTabChange: (tabName: string) => {
    trackEvent('tab_change', 'Navigation', tabName);
  },
  trackModalOpen: (modalName: string) => {
    trackEvent('modal_open', 'Modals', modalName);
  },
  trackModalClose: (modalName: string, action?: string) => {
    trackEvent('modal_close', 'Modals', `${modalName}${action ? `:${action}` : ''}`);
  },

  // Search & Filters
  trackSearch: (searchTerm: string, resultsCount: number) => {
    trackEvent('search', 'Search', searchTerm, resultsCount);
  },
  trackFilterApplied: (filterType: string, filterValue: string) => {
    trackEvent('filter_applied', 'Filters', `${filterType}:${filterValue}`);
  },

  // User engagement
  trackTimeOnPage: (pageName: string, seconds: number) => {
    trackEvent('time_on_page', 'Engagement', pageName, seconds);
  },
  trackScrollDepth: (pageName: string, depthPercent: number) => {
    trackEvent('scroll_depth', 'Engagement', pageName, depthPercent);
  },

  // Errors & Issues
  trackValidationError: (formName: string, fieldName: string, errorType: string) => {
    trackEvent('validation_error', 'Errors', `${formName}:${fieldName}:${errorType}`);
  },
  trackAPIError: (endpoint: string, statusCode: number) => {
    trackEvent('api_error', 'Errors', endpoint, statusCode);
  },
};
