// /weather/[id] — weather log detail / edit page.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { WeatherLog } from '@yge/shared';
import { WeatherLogEditor } from '../../../components/weather-log-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchLog(id: string): Promise<WeatherLog | null> {
  const res = await fetch(`${apiBaseUrl()}/api/weather-logs/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { log: WeatherLog }).log;
}

export default async function WeatherLogDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const log = await fetchLog(params.id);
  if (!log) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/weather" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Weather Log
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">
        {log.observedOn}
      </h1>
      <p className="mt-1 text-sm text-gray-600">{log.jobId}</p>
      <p className="mt-1 text-xs text-gray-500">ID: {log.id}</p>
      <div className="mt-6">
        <WeatherLogEditor mode="edit" log={log} />
      </div>
    </main>
  );
}
