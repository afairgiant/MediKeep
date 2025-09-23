// Emergency service worker killer
// This file completely removes all service workers and caches

export async function killAllServiceWorkers() {
  console.log('KILLING ALL SERVICE WORKERS...');

  if ('serviceWorker' in navigator) {
    try {
      // Get all registrations
      const registrations = await navigator.serviceWorker.getRegistrations();

      // Unregister all
      for (let registration of registrations) {
        await registration.unregister();
        console.log('Unregistered:', registration.scope);
      }

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => {
            console.log('Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }

      console.log('ALL SERVICE WORKERS AND CACHES CLEARED');
    } catch (error) {
      console.error('Error killing service workers:', error);
    }
  }
}

// Run immediately when imported
killAllServiceWorkers();