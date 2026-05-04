'use server';

// Server actions for the login page.
//
// Plain English: the form on /login walks through up to two steps.
//   1. checkEmail — punch in your work email. We verify it's on the
//      access list and ask the API whether you've set a password yet.
//   2a. signInWithPassword — if a password exists, you type it. We
//       check it against the API; if it matches, we drop a session
//       cookie and send you to the dashboard.
//   2b. setPasswordAndSignIn — first time you sign in, you pick a new
//       password (with confirmation). We POST it to the API, then drop
//       the session cookie and head to the dashboard.
//
// The API stores scrypt-hashed passwords in `data/credentials.json`
// on the Render persistent disk. Server actions run on Vercel's edge,
// so all API calls happen server-side — no CORS issue.

import { redirect } from 'next/navigation';

import {
  clearSessionCookie,
  findSeededUser,
  setSessionCookie,
} from '../../lib/auth';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// ---- Types --------------------------------------------------------------

/** Returned by checkEmail. Drives the next form to render. */
export interface CheckEmailState {
  step?: 'enter-password' | 'create-password';
  email?: string;
  error?: string;
}

/** Returned by signInWithPassword and setPasswordAndSignIn. */
export interface SignInState {
  step?: 'enter-password' | 'create-password';
  email?: string;
  error?: string;
}

// ---- Step 1: check email ------------------------------------------------

export async function checkEmail(
  _prev: CheckEmailState,
  formData: FormData,
): Promise<CheckEmailState> {
  const emailRaw = formData.get('email');
  const email = typeof emailRaw === 'string' ? emailRaw.trim() : '';
  if (!email) {
    return { error: 'Enter your work email.' };
  }

  const user = findSeededUser(email);
  if (!user) {
    return {
      error: 'That email is not on the access list. Ask Ryan to add you.',
    };
  }

  let hasPassword = false;
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/credentials/has-password?email=${encodeURIComponent(email)}`,
      { cache: 'no-store' },
    );
    if (res.ok) {
      const json = (await res.json()) as { hasPassword?: boolean };
      hasPassword = Boolean(json.hasPassword);
    }
  } catch {
    // API unreachable — let the user retry rather than silently
    // routing to the create-password flow.
    return {
      error: "Can't reach the server right now. Try again in a moment.",
    };
  }

  return {
    step: hasPassword ? 'enter-password' : 'create-password',
    email,
  };
}

// ---- Step 2a: sign in with existing password ----------------------------

export async function signInWithPassword(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const emailRaw = formData.get('email');
  const passwordRaw = formData.get('password');
  const email = typeof emailRaw === 'string' ? emailRaw.trim() : '';
  const password = typeof passwordRaw === 'string' ? passwordRaw : '';

  if (!email) return { error: 'Enter your work email.' };
  if (!password) {
    return { step: 'enter-password', email, error: 'Enter your password.' };
  }

  const user = findSeededUser(email);
  if (!user) {
    return {
      error: 'That email is not on the access list. Ask Ryan to add you.',
    };
  }

  let valid = false;
  try {
    const res = await fetch(`${API_BASE_URL}/api/credentials/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
    if (res.ok) {
      const json = (await res.json()) as { valid?: boolean };
      valid = Boolean(json.valid);
    }
  } catch {
    return {
      step: 'enter-password',
      email,
      error: "Can't reach the server right now. Try again in a moment.",
    };
  }

  if (!valid) {
    return {
      step: 'enter-password',
      email,
      error: 'Wrong password. Try again.',
    };
  }

  setSessionCookie(user);
  redirect('/dashboard');
}

// ---- Step 2b: set first-time password + sign in -------------------------

export async function setPasswordAndSignIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const emailRaw = formData.get('email');
  const passwordRaw = formData.get('password');
  const confirmRaw = formData.get('confirm');
  const email = typeof emailRaw === 'string' ? emailRaw.trim() : '';
  const password = typeof passwordRaw === 'string' ? passwordRaw : '';
  const confirm = typeof confirmRaw === 'string' ? confirmRaw : '';

  if (!email) return { error: 'Enter your work email.' };
  if (password.length < 8) {
    return {
      step: 'create-password',
      email,
      error: 'Password must be at least 8 characters.',
    };
  }
  if (password !== confirm) {
    return {
      step: 'create-password',
      email,
      error: "Passwords don't match.",
    };
  }

  const user = findSeededUser(email);
  if (!user) {
    return {
      error: 'That email is not on the access list. Ask Ryan to add you.',
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/credentials/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
    if (!res.ok) {
      // 409 = password already set; nudge the user to the sign-in step
      if (res.status === 409) {
        return {
          step: 'enter-password',
          email,
          error: 'A password is already set for this email. Sign in below.',
        };
      }
      return {
        step: 'create-password',
        email,
        error: 'Could not save the password. Try again.',
      };
    }
  } catch {
    return {
      step: 'create-password',
      email,
      error: "Can't reach the server right now. Try again in a moment.",
    };
  }

  setSessionCookie(user);
  redirect('/dashboard');
}

// ---- Sign out -----------------------------------------------------------

export async function signOut(): Promise<void> {
  clearSessionCookie();
  redirect('/login');
}
