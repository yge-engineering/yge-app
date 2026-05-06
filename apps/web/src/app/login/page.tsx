// /login — sign-in page.
//
// Plain English: the gate. Two-step:
//   1. Type your work email, hit Continue. If you've signed in before,
//      we ask for your password. If you haven't, we ask you to pick a
//      password right now.
//   2. Type the password (or set + confirm a new one) and you're in.
//
// Access is by email allowlist (Ryan + Brook today) plus a scrypt
// password the user picks the first time. Until Supabase Auth is
// wired, this is the YGE login.

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFormState, useFormStatus } from 'react-dom';

import {
  checkEmail,
  setPasswordAndSignIn,
  signInWithPassword,
  type CheckEmailState,
  type SignInState,
} from './actions';
import { FormField, FORM_INPUT_CLASS } from '../../components/form-field';
import { useTranslator, type Translator } from '../../lib/use-translator';

const initialEmailState: CheckEmailState = {};
const initialSignInState: SignInState = {};

function SubmitButton({ t, label }: { t: Translator; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60"
    >
      {pending ? t('login.signingIn') : label}
    </button>
  );
}

type Stage =
  | { kind: 'enter-email' }
  | { kind: 'enter-password'; email: string }
  | { kind: 'create-password'; email: string };

export default function LoginPage() {
  const [stage, setStage] = useState<Stage>({ kind: 'enter-email' });
  const t = useTranslator();

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <img
            src="/yge-logo.jpg"
            alt="Young General Engineering"
            className="mx-auto mb-3 h-24 w-auto"
          />
          <p className="mt-1 text-sm text-gray-500">
            {stage.kind === 'create-password'
              ? 'First time signing in — pick a password.'
              : stage.kind === 'enter-password'
                ? 'Welcome back. Enter your password.'
                : t('login.subtitle')}
          </p>
        </div>

        {stage.kind === 'enter-email' && (
          <>
            <MicrosoftSsoButton />
            <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              <span>or</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <EnterEmailForm t={t} onAdvance={setStage} />
          </>
        )}
        {stage.kind === 'enter-password' && (
          <EnterPasswordForm
            t={t}
            email={stage.email}
            onBack={() => setStage({ kind: 'enter-email' })}
            onPasswordWasSet={(email) =>
              setStage({ kind: 'enter-password', email })
            }
          />
        )}
        {stage.kind === 'create-password' && (
          <CreatePasswordForm
            t={t}
            email={stage.email}
            onBack={() => setStage({ kind: 'enter-email' })}
            onPasswordWasSet={(email) =>
              setStage({ kind: 'enter-password', email })
            }
          />
        )}

        <SsoStatusNotice />

        <p className="mt-6 text-center text-xs text-gray-400">
          {t('login.footer')}
        </p>
      </div>
    </main>
  );
}

// ---- SSO sign-in button -------------------------------------------------

function MicrosoftSsoButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const ret =
        typeof window !== 'undefined'
          ? new URL(window.location.href).searchParams.get('return') ??
            '/dashboard'
          : '/dashboard';
      const url = new URL(`${apiBase}/api/microsoft/auth-url`);
      url.searchParams.set('purpose', 'signin');
      if (ret) url.searchParams.set('return', ret);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`SSO unavailable (HTTP ${res.status})`);
      }
      const j = (await res.json()) as { url?: string };
      if (!j.url) throw new Error('SSO endpoint returned no URL');
      window.location.href = j.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SSO start failed');
      setBusy(false);
    }
  }

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
      >
        <span aria-hidden className="text-base">🪟</span>
        {busy ? 'Connecting…' : 'Sign in with Microsoft'}
      </button>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

// ---- SSO status notice (?sso=error|denied) -----------------------------

function SsoStatusNotice() {
  const params = useSearchParams();
  const sso = params?.get('sso');
  const reason = params?.get('reason');
  const email = params?.get('email');
  if (!sso) return null;
  if (sso === 'denied') {
    return (
      <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
        <strong>Not on the access list.</strong> {email ?? 'That account'} signed in
        to Microsoft but isn't a YGE portal user yet. Ask Ryan to add you on
        /admin/portal-users.
      </div>
    );
  }
  if (sso === 'error') {
    return (
      <div className="mt-4 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
        <strong>SSO failed.</strong> {reason ? reason : 'Try again or sign in with email + password.'}
      </div>
    );
  }
  return null;
}

// ---- Step 1 -------------------------------------------------------------

function EnterEmailForm({
  t,
  onAdvance,
}: {
  t: Translator;
  onAdvance: (next: Stage) => void;
}) {
  const [state, formAction] = useFormState<CheckEmailState, FormData>(
    checkEmail,
    initialEmailState,
  );
  // Pre-fill the email when the URL has ?email=... — happens when an
  // admin shares an invite link from /admin/portal-users.
  const params = useSearchParams();
  const presetEmail = params?.get('email') ?? '';
  const [emailValue, setEmailValue] = useState(presetEmail);
  useEffect(() => {
    if (presetEmail) setEmailValue(presetEmail);
  }, [presetEmail]);

  // When the action returns a step, advance the local stage.
  if (state.step && state.email && !state.error) {
    queueMicrotask(() =>
      onAdvance({ kind: state.step!, email: state.email! }),
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <FormField
        name="email"
        label={t('login.emailLabel')}
        required
        error={state.error}
      >
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="ryoung@youngge.com"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          className={FORM_INPUT_CLASS}
        />
      </FormField>

      <SubmitButton t={t} label="Continue" />
    </form>
  );
}

// ---- Step 2a — existing user ------------------------------------------

function EnterPasswordForm({
  t,
  email,
  onBack,
  onPasswordWasSet,
}: {
  t: Translator;
  email: string;
  onBack: () => void;
  onPasswordWasSet: (email: string) => void;
}) {
  const [state, formAction] = useFormState<SignInState, FormData>(
    signInWithPassword,
    initialSignInState,
  );

  if (state.step === 'create-password' && state.email) {
    queueMicrotask(() => onPasswordWasSet(state.email!));
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="email" value={email} />

      <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900">
        Signing in as <strong>{email}</strong>{' '}
        <button
          type="button"
          onClick={onBack}
          className="ml-1 underline hover:no-underline"
        >
          change
        </button>
      </div>

      <FormField
        name="password"
        label="Password"
        required
        error={state.error}
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          autoFocus
        />
      </FormField>

      <SubmitButton t={t} label={t('login.signIn')} />
    </form>
  );
}

// ---- Step 2b — first-time user ----------------------------------------

function CreatePasswordForm({
  t,
  email,
  onBack,
  onPasswordWasSet,
}: {
  t: Translator;
  email: string;
  onBack: () => void;
  onPasswordWasSet: (email: string) => void;
}) {
  const [state, formAction] = useFormState<SignInState, FormData>(
    setPasswordAndSignIn,
    initialSignInState,
  );

  if (state.step === 'enter-password' && state.email) {
    queueMicrotask(() => onPasswordWasSet(state.email!));
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="email" value={email} />

      <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900">
        Setting up <strong>{email}</strong>{' '}
        <button
          type="button"
          onClick={onBack}
          className="ml-1 underline hover:no-underline"
        >
          change
        </button>
      </div>

      <FormField
        name="password"
        label="Choose a password (at least 8 characters)"
        required
        error={state.error}
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
          autoFocus
        />
      </FormField>

      <FormField name="confirm" label="Confirm password" required>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </FormField>

      <SubmitButton t={t} label="Create password & sign in" />
    </form>
  );
}

// ---- Password input with show/hide toggle ------------------------------

function PasswordInput({
  id,
  name,
  autoComplete,
  required,
  minLength,
  autoFocus,
}: {
  id: string;
  name: string;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
  autoFocus?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        {...(minLength !== undefined ? { minLength } : {})}
        {...(required ? { required: true } : {})}
        {...(autoFocus ? { autoFocus: true } : {})}
        className={`${FORM_INPUT_CLASS} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-500 hover:text-gray-800"
      >
        {shown ? (
          // eye-off icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M3.28 2.22a.75.75 0 00-1.06 1.06l2.06 2.06A11.6 11.6 0 001.5 10c1.5 3.6 4.7 6 8.5 6 1.4 0 2.7-.34 3.86-.93l2.4 2.4a.75.75 0 101.06-1.06L3.28 2.22zM10 14.5a4.5 4.5 0 01-4.5-4.5c0-.7.16-1.36.45-1.95l1.27 1.27a3 3 0 003.96 3.96l1.27 1.27A4.5 4.5 0 0110 14.5z" />
            <path d="M18.5 10a11.5 11.5 0 01-2.04 3.5l-1.78-1.78A4.49 4.49 0 0014.5 10a4.5 4.5 0 00-6.78-3.86L5.97 4.4A8.6 8.6 0 0110 4c3.8 0 7 2.4 8.5 6z" />
          </svg>
        ) : (
          // eye icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M10 4C5.5 4 2.2 6.7 1 10c1.2 3.3 4.5 6 9 6s7.8-2.7 9-6c-1.2-3.3-4.5-6-9-6zm0 10a4 4 0 110-8 4 4 0 010 8zm0-6.5A2.5 2.5 0 1010 12.5 2.5 2.5 0 0010 7.5z" />
          </svg>
        )}
      </button>
    </div>
  );
}
