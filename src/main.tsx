import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { logWebCrash } from './lib/firebase.ts';

// Catch and report unhandled runtime errors globally to Google Analytics
try {
  window.addEventListener('error', (event) => {
    let errorMsg = '';
    const errorObj = event.error;
    if (errorObj && typeof errorObj === 'object') {
      errorMsg = errorObj.message || errorObj.description || '';
      if (!errorMsg || errorMsg === '[object Object]') {
        try {
          errorMsg = JSON.stringify(errorObj);
        } catch (e) {
          errorMsg = String(errorObj);
        }
      }
    } else {
      errorMsg = event.message || String(errorObj || '');
    }

    if (
      errorMsg.includes('installations/app-offline') || 
      errorMsg.includes('installations/validation-failed') ||
      errorMsg.includes('analytics/') ||
      errorMsg.includes('App offline')
    ) {
      // Ignore background firebase installations/analytics errors
      event.preventDefault();
      return;
    }
    logWebCrash(event.error || event.message, 'Global Window Error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    let message = '';
    let code = '';

    if (reason) {
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
    }

    // Ignore harmless, non-fatal background Firebase installations/analytics offline errors
    if (
      message.includes('installations/app-offline') ||
      message.includes('installations/validation-failed') ||
      code.includes('installations/') ||
      message.includes('analytics/') ||
      message.includes('App offline')
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

