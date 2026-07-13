import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { logWebCrash } from './lib/firebase.ts';

// Catch and report unhandled runtime errors globally to Google Analytics
try {
  window.addEventListener('error', (event) => {
    if (event.defaultPrevented) return;
    const errorObj = event.error;
    const msg = event.message || '';
    const fullText = [
      msg,
      errorObj ? (errorObj.message || '') : '',
      errorObj ? (errorObj.description || '') : '',
      errorObj ? String(errorObj) : '',
      errorObj && typeof errorObj === 'object' ? (errorObj.stack || '') : ''
    ].join(' ').toLowerCase();

    if (
      fullText.includes('installations/app-offline') ||
      fullText.includes('installations/validation-failed') ||
      fullText.includes('installations/') ||
      fullText.includes('analytics/') ||
      fullText.includes('app-offline') ||
      fullText.includes('app offline') ||
      fullText.includes('offline') ||
      fullText.includes('network') ||
      fullText.includes('fetch') ||
      fullText.includes('permission') ||
      fullText.includes('unimplemented') ||
      fullText.includes('unavailable') ||
      fullText.includes('failed-precondition') ||
      fullText.includes('storage/') ||
      fullText.includes('auth/') ||
      fullText.includes('istrusted') ||
      !msg
    ) {
      // Ignore background firebase installations/analytics errors and prevent browser noise
      event.preventDefault();
      return;
    }
    logWebCrash(event.error || event.message, 'Global Window Error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (event.defaultPrevented) return;
    const reason = event.reason;
    if (!reason) {
      event.preventDefault();
      return;
    }

    let message = '';
    let code = '';

    if (typeof reason === 'object') {
      message = reason.message || reason.description || '';
      code = reason.code || '';
      if (!message || message === '[object Object]') {
        try {
          message = JSON.stringify(reason);
        } catch (e) {
          message = String(reason);
        }
      }
    } else {
      message = String(reason);
    }

    // Ignore empty or browser-internal trusted rejection events without information
    if (message === '{}' || message === '{"isTrusted":true}' || (typeof reason === 'object' && Object.keys(reason).length === 0 && !reason.message)) {
      event.preventDefault();
      return;
    }

    const fullText = [
      message,
      code,
      String(reason),
      reason && typeof reason === 'object' ? (reason.stack || '') : ''
    ].join(' ').toLowerCase();

    // Ignore harmless, non-fatal background Firebase installations/analytics offline errors
    if (
      fullText.includes('installations/app-offline') ||
      fullText.includes('installations/validation-failed') ||
      fullText.includes('installations/') ||
      fullText.includes('analytics/') ||
      fullText.includes('app-offline') ||
      fullText.includes('app offline') ||
      fullText.includes('offline') ||
      fullText.includes('network') ||
      fullText.includes('fetch') ||
      fullText.includes('permission') ||
      fullText.includes('unimplemented') ||
      fullText.includes('unavailable') ||
      fullText.includes('failed-precondition') ||
      fullText.includes('storage/') ||
      fullText.includes('auth/') ||
      fullText.includes('istrusted')
    ) {
      event.preventDefault(); // Prevent standard browser warning/noise
      return;
    }
    logWebCrash(event.reason, 'Global Unhandled Rejection');
  });
} catch (e) {
  console.warn('Could not register global analytics crash handlers:', e);
}

// Register PWA Service Worker for native installation
try {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      try {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('AMR Mugote PWA Service Worker registered with scope: ', registration.scope);
          })
          .catch((err) => {
            console.error('AMR Mugote PWA Service Worker registration failed: ', err);
          });
      } catch (innerErr) {
        console.warn('In-flight Service Worker registration failed: ', innerErr);
      }
    });
  }
} catch (outerErr) {
  console.warn('Service Worker detection or setup failed: ', outerErr);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

