'use server';

// Server actions for the login page.
//
// Plain English: the form on /login posts to `signIn`. We look up the
// email against the seeded users and either set a session cookie + go
// to the dashboard, or bounce back with an error.

import { redirect } from 'next/navigation';

import { clearSessionCookie, findSeededUser, setSessionCookie } from '../../lib/auth';

export interface SignInState {
  error?: string;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const emailRaw = formData.get('email');
  const email = typeof emailRaw === 'string' ? emailRaw.trim() : '';
  if (!email) return { error: 'Enter your work email.' };

  const user = findSeededUser(email);
  if (!user) {
    return { error: 'That email is not on the access list. Ask Ryan to add you.' };
  }

  setSessionCookie(user);
  redirect('/dashboard');
}

export async function signOut(): Promise<void> {
  clearSessionCookie();
  redirect('/login');
}
