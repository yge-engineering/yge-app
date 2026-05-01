// /login — sign-in page.
//
// Plain English: the gate. Ryan or Brook types their work email, hits
// Sign In, and lands on the dashboard. Until Supabase Auth is wired,
// access is by email-only allowlist (Ryan + Brook). The form uses a
// React useFormState client wrapper so we can show inline errors.

'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { signIn, type SignInState } from './actions';

const initialState: SignInState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60"
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState<SignInState, FormData>(signIn, initialState);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-blue-700 text-sm font-bold text-white">
            YGE
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Young General Engineering</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in with your work email.</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-gray-700">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="ryoung@youngge.com"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
            />
          </div>

          {state.error ? (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              {state.error}
            </div>
          ) : null}

          <SubmitButton />
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          For YGE staff. Trouble signing in? Call Ryan at 707-599-9921.
        </p>
      </div>
    </main>
  );
}
