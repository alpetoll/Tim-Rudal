'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerServiceWorker = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
          });
          console.log('Service Worker registered successfully with scope:', registration.scope);
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      };

      if (document.readyState === 'complete') {
        registerServiceWorker();
      } else {
        window.addEventListener('load', registerServiceWorker);
        return () => window.removeEventListener('load', registerServiceWorker);
      }
    }
  }, []);

  return null;
}
