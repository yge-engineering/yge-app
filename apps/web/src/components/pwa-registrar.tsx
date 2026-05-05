'use client';

// PwaRegistrar — registers /sw.js when the page loads in a browser
// that supports service workers. Side-effect-only client component;
// renders nothing.
//
// Plain English: this is what makes "Install YGE" actually appear in
// Chrome / Safari / Edge. Without a registered service worker, the
// browser won't offer the install prompt even if the manifest is
// otherwise valid.

import { useEffect } from 'react';

export function PwaRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Defer registration to after first paint so it never competes
    // with the user's first interaction.
    const onReady = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // Don't block anything if registration fails — the app
          // still works without a service worker.
        });
    };
    if (document.readyState === 'complete') {
      onReady();
    } else {
      window.addEventListener('load', onReady, { once: true });
      return () => window.removeEventListener('load', onReady);
    }
    return undefined;
  }, []);
  return null;
}
