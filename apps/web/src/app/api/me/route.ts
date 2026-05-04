// GET /api/me — returns the current signed-in user, or null.
//
// Plain English: the AccountChip in the top right corner runs as a
// client component (so it can be rendered from /new form pages
// without dragging server-only `next/headers` into the client bundle).
// To know who's signed in, it calls this endpoint, which reads the
// httpOnly session cookie on the server and returns the user.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const user = getCurrentUser();
  return NextResponse.json({ user });
}
