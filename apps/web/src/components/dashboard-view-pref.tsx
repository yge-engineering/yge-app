'use client';

// Dashboard view preference — localStorage-backed.
//
// User clicks "Set as default" on whichever dashboard they're
// currently on. From then on, visiting /dashboard auto-redirects
// to /dashboard/lite (or vice versa) until they reset.
//
// Two roles:
//   - "preference saver" — renders a small button that captures
//     the current page as preferred. Used at the top of both
//     /dashboard and /dashboard/lite.
//   - "preference enforcer" — on /dashboard only, mount-time
//     check that redirects to /dashboard/lite when the user has
//     picked lite as their default.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const KEY = 'yge.dashboard.viewPref';
type ViewPref = 'full' | 'lite' | null;

function readPref(): ViewPref {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(KEY);
  return v === 'full' || v === 'lite' ? v : null;
}
function writePref(v: ViewPref): void {
  if (typeof window === 'undefined') return;
  if (v === null) window.localStorage.removeItem(KEY);
  else window.localStorage.setItem(KEY, v);
}

interface SetterProps {
  value: 'full' | 'lite';
  label?: string;
}

export function DashboardViewPrefSetter({ value, label }: SetterProps) {
  const [pref, setPref] = useState<ViewPref>(null);
  useEffect(() => setPref(readPref()), []);
  const isCurrent = pref === value;
  return (
    <button
      type="button"
      onClick={() => {
        if (isCurrent) {
          writePref(null);
          setPref(null);
        } else {
          writePref(value);
          setPref(value);
        }
      }}
      className={`rounded border px-2 py-1 text-xs font-medium ${
        isCurrent
          ? 'border-yge-blue-500 bg-yge-blue-50 text-yge-blue-700'
          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
      }`}
      title={
        isCurrent
          ? 'Clear default — both dashboards will load directly.'
          : 'Save this as your default — visiting /dashboard will land here.'
      }
    >
      {isCurrent ? '✓ Default view' : label ?? 'Set as default'}
    </button>
  );
}

interface EnforcerProps {
  /** If a user prefers this view, do nothing (already here). */
  hereIs: 'full' | 'lite';
}

export function DashboardViewPrefEnforcer({ hereIs }: EnforcerProps) {
  const router = useRouter();
  useEffect(() => {
    const pref = readPref();
    if (!pref) return;
    if (pref === hereIs) return;
    router.replace(pref === 'lite' ? '/dashboard/lite' : '/dashboard');
  }, [router, hereIs]);
  return null;
}
