'use client';

// Toggle — accessible boolean switch.
//
// Plain English: a checkbox that LOOKS like a switch. Use this for
// 'reimbursable?', 'paid with company card?', '1099 reportable?',
// etc., where a checkbox feels too small.

import { useState } from 'react';

interface Props {
  /** Form input name. */
  name: string;
  label: string;
  /** Initial state (uncontrolled). */
  defaultChecked?: boolean;
  /** Optional help text under the label. */
  hint?: string;
}

export function Toggle({ name, label, defaultChecked = false, hint }: Props) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-blue-700' : 'bg-gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-700/20`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
      <span className="select-none">
        <span className="block text-sm text-gray-900">{label}</span>
        {hint ? <span className="block text-xs text-gray-500">{hint}</span> : null}
      </span>
      {/* Hidden checkbox so the value posts in form submissions. */}
      <input type="checkbox" name={name} checked={on} onChange={() => {}} className="sr-only" />
    </label>
  );
}
