import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

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

// PWA service worker - safe version without logging loops
if (process.env.NODE_ENV === 'production') {
  import('./serviceWorkerRegistration').then(({ register }) => {
    register({
      onUpdate: (registration) => {
        // New version available - could show toast notification
        console.log('SW: New app version available');
      },
      onSuccess: (registration) => {
        // Content cached for offline use
        console.log('SW: App ready for offline use');
      }
    });
  });
}
