'use client';

// Small toggleable chip at the top of /estimates that surfaces
// keyboard shortcuts. Pure client; no state outside the chip.

import { useState } from 'react';

export function EstimatesShortcutsChip() {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
        title="Keyboard shortcuts"
      >
        ? Shortcuts
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-md border border-gray-300 bg-white p-3 text-xs shadow-xl">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold text-gray-900">
              Keyboard shortcuts
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-900"
            >
              ✕
            </button>
          </div>
          <ul className="space-y-1.5 text-gray-700">
            <li className="flex items-center justify-between">
              <span>Focus search</span>
              <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px]">
                /
              </kbd>
            </li>
            <li className="flex items-center justify-between">
              <span>Clear search</span>
              <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px]">
                Esc
              </kbd>
            </li>
            <li className="flex items-center justify-between">
              <span>Sort by column</span>
              <span className="text-[10px] text-gray-500">
                click header
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span>Reverse sort</span>
              <span className="text-[10px] text-gray-500">
                click again
              </span>
            </li>
          </ul>
        </div>
      )}
    </span>
  );
}
