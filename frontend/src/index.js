import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import logger from './services/logger';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// PWA service worker
if (process.env.NODE_ENV === 'production') {
  import('./serviceWorkerRegistration').then(({ register }) => {
    register({
      onUpdate: (registration) => {
        // New version available - could show toast notification to user
        logger.info('app_update_available', 'New app version available', {
          component: 'index',
          action: 'service_worker_update'
        });
      },
      onSuccess: (registration) => {
        // Content cached for offline use
        logger.info('app_offline_ready', 'App ready for offline use', {
          component: 'index',
          action: 'service_worker_success'
        });
      }
    });
  });
}
