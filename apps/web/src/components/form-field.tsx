// FormField — label + input + help text + error wrapper.
//
// Plain English: every form in the app repeats the same label + input
// + error structure. Centralize it so spacing, font sizes, error
// styling, and the asterisk-required pattern are consistent.

import type React from 'react';

interface Props {
  /** Field id; ties label → input. Auto-derived from `name` if omitted. */
  id?: string;
  /** Form input name. */
  name: string;
  label: string;
  /** Optional help / hint shown under the field. */
  hint?: string;
  /** Validation error to display in red. */
  error?: string;
  /** True for required-asterisk indicator. */
  required?: boolean;
  /** The input element. Provide your own <input>, <select>, <textarea>. */
  children: React.ReactNode;
}

export function FormField({ id, name, label, hint, error, required, children }: Props) {
  const fieldId = id ?? name;
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1 block text-xs font-medium text-gray-700">
        {label}
        {required ? <span className="ml-0.5 text-red-700" aria-hidden="true">*</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** Standard text-input class — pair with <FormField> for consistent forms. */
export const FORM_INPUT_CLASS =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20 disabled:bg-gray-50 disabled:text-gray-500';
