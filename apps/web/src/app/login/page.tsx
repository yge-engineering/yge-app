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

import { useState } from 'react';
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
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-blue-700 text-sm font-bold text-white">
            YGE
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            {t('login.companyName')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {stage.kind === 'create-password'
              ? 'First time signing in — pick a password.'
              : stage.kind === 'enter-password'
                ? 'Welcome back. Enter your password.'
                : t('login.subtitle')}
          </p>
        </div>

        {stage.kind === 'enter-email' && (
          <EnterEmailForm t={t} onAdvance={setStage} />
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

        <p className="mt-6 text-center text-xs text-gray-400">
          {t('login.footer')}
        </p>
      </div>
    </main>
  );
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
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className={FORM_INPUT_CLASS}
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
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          autoFocus
          className={FORM_INPUT_CLASS}
        />
      </FormField>

      <FormField name="confirm" label="Confirm password" required>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={FORM_INPUT_CLASS}
        />
      </FormField>

      <SubmitButton t={t} label="Create password & sign in" />
    </form>
  );
}
