// /certificates/[id] — full editor.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Certificate } from '@yge/shared';
import { CertificateEditor } from '@/components/certificate-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchCert(id: string): Promise<Certificate | null> {
  const res = await fetch(
    `${apiBaseUrl()}/api/certificates/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { certificate: Certificate };
  return json.certificate;
}

export default async function CertificateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const cert = await fetchCert(params.id);
  if (!cert) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/certificates" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to certificates
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <CertificateEditor initial={cert} apiBaseUrl={publicApiBaseUrl()} />
      </div>
    </main>
  );
}
