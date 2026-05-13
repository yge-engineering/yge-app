// Microsoft Graph helpers — OAuth token exchange + authenticated calls.
//
// Plain English: handles the OAuth code-for-token swap on the
// /api/microsoft/callback redirect, refreshes access tokens when
// they expire, and gives a `withAccessToken(email, fn)` wrapper for
// the rest of the API to call Graph (SharePoint, OneDrive, Mail)
// on behalf of an authenticated user.

import {
  getMicrosoftToken,
  saveMicrosoftToken,
  type StoredToken,
} from './microsoft-tokens-store';

const TENANT_ID = process.env.MICROSOFT_TENANT_ID ?? '';
const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET ?? '';

function authority(): string {
  return `https://login.microsoftonline.com/${TENANT_ID || 'common'}`;
}

/** Scopes we request when the user clicks Connect. The trailing
 *  /.default isn't used — we list scopes explicitly so consent shows
 *  the user what they're granting. offline_access gives us a refresh
 *  token. */
export const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Files.ReadWrite.All',
  'Sites.ReadWrite.All',
  'Mail.Read',
  'Mail.ReadWrite',
  // Wave 4 additions: Calendar + Tasks + Teams.
  'Calendars.ReadWrite',
  'Tasks.ReadWrite',
  'ChannelMessage.Send',
];

export function isMicrosoftConfigured(): boolean {
  return Boolean(TENANT_ID && CLIENT_ID && CLIENT_SECRET);
}

/** Build the Microsoft OAuth authorization URL. */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const u = new URL(`${authority()}/oauth2/v2.0/authorize`);
  u.searchParams.set('client_id', CLIENT_ID);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_mode', 'query');
  u.searchParams.set('scope', SCOPES.join(' '));
  u.searchParams.set('state', state);
  u.searchParams.set('prompt', 'select_account');
  return u.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  scope: string;
  token_type: string;
}

interface MeResponse {
  mail?: string;
  userPrincipalName?: string;
  displayName?: string;
}

/** Exchange the OAuth code for tokens, look up the user's email, save. */
export async function completeOAuthCallback(
  code: string,
  redirectUri: string,
): Promise<{ email: string; displayName?: string }> {
  if (!isMicrosoftConfigured()) {
    throw new Error('Microsoft OAuth is not configured (env vars missing)');
  }
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: SCOPES.join(' '),
  });
  const res = await fetch(`${authority()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const tok = (await res.json()) as TokenResponse;
  // Look up the user's primary email so we can key the token row.
  const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!meRes.ok) {
    const text = await meRes.text().catch(() => '');
    throw new Error(`/me lookup failed (${meRes.status}): ${text.slice(0, 200)}`);
  }
  const me = (await meRes.json()) as MeResponse;
  const email = (me.mail ?? me.userPrincipalName ?? '').toLowerCase();
  if (!email) throw new Error('Microsoft did not return an email for this user');
  await saveMicrosoftToken(email, {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
    scope: tok.scope,
  });
  return { email, ...(me.displayName ? { displayName: me.displayName } : {}) };
}

/** Refresh the access token using the stored refresh token. */
async function refreshTokenFor(stored: StoredToken): Promise<StoredToken> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: stored.refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES.join(' '),
  });
  const res = await fetch(`${authority()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const tok = (await res.json()) as TokenResponse;
  return saveMicrosoftToken(stored.email, {
    accessToken: tok.access_token,
    // Microsoft sometimes rotates the refresh_token; fall back to
    // the previous one if the response omits it.
    refreshToken: tok.refresh_token || stored.refreshToken,
    expiresAt: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
    scope: tok.scope,
  });
}

/** Returns a current access token for the user, refreshing if needed.
 *  Throws if the user isn't connected. */
export async function getAccessTokenFor(email: string): Promise<string> {
  const stored = await getMicrosoftToken(email);
  if (!stored) throw new Error(`Microsoft account not connected for ${email}`);
  const expiry = new Date(stored.expiresAt).getTime();
  // Refresh 2 minutes before expiry to be safe.
  if (Date.now() < expiry - 120_000) return stored.accessToken;
  const refreshed = await refreshTokenFor(stored);
  return refreshed.accessToken;
}

/** GET against Microsoft Graph as the given user. */
export async function graphGet<T>(email: string, urlPath: string): Promise<T> {
  const token = await getAccessTokenFor(email);
  const res = await fetch(`https://graph.microsoft.com/v1.0${urlPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Graph GET ${urlPath} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Download a binary blob from Graph (e.g. an attachment's $value endpoint).
 *  Returns the bytes plus the response Content-Type header so the caller
 *  can decide how to persist it. */
export async function graphGetBinary(
  email: string,
  urlPath: string,
): Promise<{ bytes: Buffer; contentType: string }> {
  const token = await getAccessTokenFor(email);
  const res = await fetch(`https://graph.microsoft.com/v1.0${urlPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Graph GET ${urlPath} (binary) failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }
  const ab = await res.arrayBuffer();
  return {
    bytes: Buffer.from(ab),
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
  };
}

/** POST a JSON body to Graph and parse the JSON response. Throws if
 *  the call doesn't return 2xx. */
export async function graphPost<T>(
  email: string,
  urlPath: string,
  body: unknown,
): Promise<T> {
  const token = await getAccessTokenFor(email);
  const res = await fetch(`https://graph.microsoft.com/v1.0${urlPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Graph POST ${urlPath} failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }
  // Some POSTs return 204 No Content. Fall through to {} in that case.
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}
