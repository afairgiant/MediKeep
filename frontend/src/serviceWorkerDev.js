// Development-safe service worker registration
// This version doesn't actually register a service worker in development
// to avoid constant reloads and caching issues
import { env } from './config/env';

export function register(config) {
  if (env.DEV) {
    console.log('Service Worker is disabled in development mode to prevent reload issues');
    return;
  }

  // In production, use the real service worker registration
  if (env.PROD) {
    import('./serviceWorkerRegistration').then(({ register }) => {
      register(config);
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
      })
      .catch(error => {
        console.error(error.message);
      });
  }
}