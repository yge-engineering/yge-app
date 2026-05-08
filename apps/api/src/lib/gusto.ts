// Thin wrapper around Gusto's v1 API.
//
// Plain English: read employees + push hours. Auth via personal-
// access-token (PAT) Bearer header. The wrapper is intentionally
// minimal — Gusto v1 has many endpoints we don't need yet; we'll
// flesh out the surface as the actual sync flow ships.

import { logger } from './logger';

const GUSTO_BASE = 'https://api.gusto.com/v1';

export interface GustoEmployee {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string | null;
  jobs?: Array<{
    title?: string;
    rate?: string; // dollars per hour as a string
    payment_unit?: 'Hour' | 'Year' | 'Month';
  }>;
  terminated?: boolean;
}

export function isGustoConfigured(): boolean {
  return Boolean(
    process.env.GUSTO_API_KEY && process.env.GUSTO_COMPANY_UUID,
  );
}

function authHeaders(): HeadersInit {
  const pat = process.env.GUSTO_API_KEY ?? '';
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${pat}`,
    'Content-Type': 'application/json',
  };
}

export async function listEmployees(): Promise<GustoEmployee[]> {
  if (!isGustoConfigured()) {
    logger.warn('Gusto not configured; skipping listEmployees');
    return [];
  }
  const company = process.env.GUSTO_COMPANY_UUID ?? '';
  const url = `${GUSTO_BASE}/companies/${encodeURIComponent(company)}/employees`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Gusto listEmployees failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }
  const body = (await res.json()) as GustoEmployee[];
  return body;
}
