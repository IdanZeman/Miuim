import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import * as Sentry from "@sentry/react";

if (import.meta.env.VITE_SENTRY_DSN && import.meta.env.VITE_SENTRY_DSN !== 'PLACEHOLDER_INSERT_YOUR_SENTRY_DSN_HERE') {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
      Sentry.feedbackIntegration({
        // Additional SDK configuration goes in here, for example:
        colorScheme: "system",
        isNameRequired: true,
        isEmailRequired: true,
        buttonLabel: "דווח על באג",
        submitButtonLabel: "שלח דיווח",
        formTitle: "דיווח על באג או משוב",
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of the transactions
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    environment: import.meta.env.MODE,
  });
}

// Global Console Suppression for Production
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  console.log('🛡️ Production mode: Suppressing non-critical console logs.');
  const noop = () => { };
  console.log = noop;
  console.debug = noop;
  console.info = noop;
  // We keep console.warn and console.error for critical issue tracking
}


// Add global error handler for Vite dynamic import failures (common on deployment)
window.addEventListener('vite:preloadError', (event) => {
  window.location.reload();
});

// Fallback for other chunk errors
window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('dynamically imported module') || e.message.includes('not a valid JavaScript MIME type'))) {
    console.warn('Chunk load failed, reloading...', e);
    window.location.reload();
  }
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes global default for static data
      refetchOnWindowFocus: false, // Prevent aggressive refetching
      retry: 1,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Sentry.ErrorBoundary fallback={<p>An error has occurred</p>}>
        <App />
      </Sentry.ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);