'use client';

// PwaInstallButton — surfaces the browser's PWA install prompt.
//
// Plain English: when Chrome/Edge fires the beforeinstallprompt event
// (after the manifest + service worker check out), they hide the
// install offer behind a small icon in the address bar that most
// users never notice. This catches that event and renders an
// explicit "Install YGE app" button so Ryan + Brook + the office can
// install with one click.
//
// Hidden when:
//   - already running in standalone mode (the user installed it),
//   - the browser hasn't fired the install event (Safari iOS uses
//     "Add to Home Screen" instead — handled by separate guidance).

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Already running as installed PWA?
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      // iOS Safari only sets navigator.standalone — non-standard.
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;
    if (standalone) setInstalled(true);

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferred(null);
      setInstalled(true);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
    } finally {
      // Browsers fire beforeinstallprompt only once per session — null
      // out so the button hides until next eligible visit.
      setDeferred(null);
    }
  }

  return (
    <button
      type="button"
      onClick={install}
      className="rounded-md border border-blue-700 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
      title="Install YGE as an app on this device"
    >
      ⬇ Install YGE app
    </button>
  );
}
