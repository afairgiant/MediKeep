// Service Worker Registration for Medical Records PWA
import logger from './services/logger';
import { isProduction } from './config/env';

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/
  )
);

export function register(config) {
  if (isProduction() && 'serviceWorker' in navigator) {
    // The URL constructor is available in all browsers that support SW.
    const publicUrl = new URL('/', window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      // Our service worker won't work if PUBLIC_URL is on a different origin
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = `/service-worker.js`;

      if (isLocalhost) {
        // This is running on localhost. Check if a service worker still exists or not.
        checkValidServiceWorker(swUrl, config);

        // Development mode - service worker ready
      } else {
        // Is not localhost. Just register service worker
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then(registration => {
      logger.info('service_worker_registered', 'Service worker registered successfully', {
        component: 'serviceWorkerRegistration',
        swUrl
      });

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              logger.info('service_worker_update_available', 'New content available, will refresh on next visit', {
                component: 'serviceWorkerRegistration'
              });
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              logger.info('service_worker_cached', 'Content cached for offline use', {
                component: 'serviceWorkerRegistration'
              });
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch(error => {
      logger.error('service_worker_registration_failed', 'Service worker registration failed', {
        component: 'serviceWorkerRegistration',
        error: error.message
      });
    });
}

function checkValidServiceWorker(swUrl, config) {
  // Check if the service worker can be found. If it can't reload the page.
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then(response => {
      // Ensure service worker exists, and that we really are getting a JS file.
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        // No service worker found. Probably a different app. Reload the page.
        navigator.serviceWorker.ready.then(registration => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        // Service worker found. Proceed as normal.
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      logger.warn('service_worker_offline', 'No internet connection found. App is running in offline mode.', {
        component: 'serviceWorkerRegistration'
      });
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
        logger.info('service_worker_unregistered', 'Service worker unregistered', {
          component: 'serviceWorkerRegistration'
        });
      })
      .catch(error => {
        logger.error('service_worker_unregister_failed', 'Service worker unregister failed', {
          component: 'serviceWorkerRegistration',
          error: error.message
        });
      });
  }
}