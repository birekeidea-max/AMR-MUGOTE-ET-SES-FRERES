import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { logWebCrash } from './lib/firebase.ts';

// Catch and report unhandled runtime errors globally to Google Analytics
try {
  window.addEventListener('error', (event) => {
    logWebCrash(event.error || event.message, 'Global Window Error');
  });

  window.addEventListener('unhandledrejection', (event) => {
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

