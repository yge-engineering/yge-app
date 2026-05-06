'use client';

// Small dismissible banner inviting users to install the YGE mobile app.
// Hidden once dismissed (localStorage). Shows on the dashboard.

import { useEffect, useState } from 'react';

const KEY = 'yge.dashboard.mobileCalloutDismissed';

export function MobileAppCallout() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(KEY) !== '1') {
      setShow(true);
    }
  }, []);

  if (!show) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-yge-blue-300 bg-yge-blue-50 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-2xl">📱</span>
        <div>
          <div className="text-sm font-semibold text-yge-blue-700">
            YGE mobile is here
          </div>
          <div className="text-xs text-yge-blue-700/80">
            Install on iPhone or Android to manage bids from the field. Login once with your YGE account.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            try {
              window.localStorage.setItem(KEY, '1');
            } catch {}
            setShow(false);
          }}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
