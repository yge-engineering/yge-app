'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Info {
  legalName: string;
  address: { line1: string; city: string; state: string; zip: string };
  president: { name: string; phone: string; email: string };
  vicePresident: { name: string; phone: string; email: string };
  cslb: string;
  dir: string;
  dot: string;
  naics: string;
  pscCodes: string[];
  website: string;
  appHost: string;
}

export function CompanyInfoCard() {
  const [info, setInfo] = useState<Info | null>(null);
  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/company-info`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Info | null) => setInfo(j));
  }, []);
  if (!info) return <p className="text-sm text-gray-500">Loading…</p>;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-yge-blue-900">{info.legalName}</h2>
      <p className="text-sm text-gray-700">
        {info.address.line1}<br />
        {info.address.city}, {info.address.state} {info.address.zip}
      </p>
      <table className="mt-4 w-full text-sm">
        <tbody>
          <Row label="President" value={`${info.president.name} · ${info.president.phone} · ${info.president.email}`} />
          <Row label="Vice President" value={`${info.vicePresident.name} · ${info.vicePresident.phone} · ${info.vicePresident.email}`} />
          <Row label="CSLB" value={info.cslb} />
          <Row label="DIR" value={info.dir} />
          <Row label="DOT" value={info.dot} />
          <Row label="NAICS" value={info.naics} />
          <Row label="PSC codes" value={info.pscCodes.join(', ')} />
          <Row label="Website" value={info.website} />
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-1 pr-4 text-gray-700">{label}</td>
      <td className="py-1 font-medium">{value}</td>
    </tr>
  );
}
