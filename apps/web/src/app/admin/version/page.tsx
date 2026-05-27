// /admin/version — quick read on which deploy + which prompt
// the app is hot on.
//
// Shows two columns:
//   - Web build: BUILD_SHA / BUILD_TIMESTAMP from the Next.js
//     env (set at Vercel build time).
//   - API build + prompt: live fetched from /api/version
//     (bundle 2636).
//
// Useful when Ryan is on the phone with support / Brook / a
// vendor and needs to confirm which build is live. Pairs with
// the extension popup display (bundle 2637).

import { AppShell, PageHeader } from '../../../components';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

interface ApiVersion {
  buildSha?: string;
  buildTimestamp?: string;
  promptVersion?: string;
  nodeVersion?: string;
  env?: string;
  at?: string;
}

async function fetchApiVersion(): Promise<ApiVersion | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/version`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ApiVersion;
  } catch {
    return null;
  }
}

function short(sha: string): string {
  return sha.length >= 7 ? sha.slice(0, 7) : sha;
}

export default async function VersionPage() {
  const apiVersion = await fetchApiVersion();
  const webSha = process.env.BUILD_SHA ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown';
  const webTimestamp =
    process.env.BUILD_TIMESTAMP ?? process.env.NEXT_PUBLIC_BUILD_TIMESTAMP ?? 'unknown';

  // Only flag a mismatch when BOTH sides actually report a SHA —
  // 'unknown' on either side just means the env wasn't wired up at
  // build/start, not a real cutover. Comparing 'unknown' to 'unknown'
  // would spuriously read as "match" too, so we gate on both being
  // known.
  const apiSha = apiVersion?.buildSha;
  const bothShasKnown =
    webSha !== 'unknown' &&
    apiSha !== undefined &&
    apiSha !== null &&
    apiSha !== 'unknown';
  const shaMismatch = bothShasKnown && webSha !== apiSha;

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6 sm:p-8">
        <PageHeader
          title="Build + version info"
          subtitle="Use when you need to confirm which deploy is live. Web side is server-rendered; API side is live-fetched on every page load."
        />

        {shaMismatch && (
          <section className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <h2 className="text-sm font-bold uppercase tracking-wide">
              Build SHAs do not match
            </h2>
            <p className="mt-1 text-sm">
              Web is on <code className="font-mono">{short(webSha)}</code> but
              API is on <code className="font-mono">{short(apiSha ?? '')}</code>.
              The deploy is mid-cutover — give Vercel + the API host a minute
              and refresh. If this persists, the API host did not pick up the
              latest push.
            </p>
          </section>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <header className="mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">
                Web (Next.js)
              </h2>
            </header>
            <dl className="space-y-1 text-sm">
              <Row label="Build SHA" value={webSha} mono />
              <Row label="Build timestamp" value={webTimestamp} mono />
              <Row label="Page rendered at" value={new Date().toISOString()} mono />
            </dl>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">
                API (Express)
              </h2>
              {!apiVersion && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-800">
                  unreachable
                </span>
              )}
            </header>
            {apiVersion ? (
              <dl className="space-y-1 text-sm">
                <Row label="Base URL" value={apiBaseUrl()} mono />
                <Row label="Build SHA" value={apiVersion.buildSha ?? 'unknown'} mono />
                <Row
                  label="Build timestamp"
                  value={apiVersion.buildTimestamp ?? 'unknown'}
                  mono
                />
                <Row
                  label="Prompt version"
                  value={apiVersion.promptVersion ?? 'unknown'}
                  mono
                />
                <Row
                  label="Node version"
                  value={apiVersion.nodeVersion ?? 'unknown'}
                  mono
                />
                <Row label="Env" value={apiVersion.env ?? 'unknown'} mono />
                <Row label="Server time" value={apiVersion.at ?? 'unknown'} mono />
              </dl>
            ) : (
              <p className="text-sm italic text-gray-600">
                Couldn&apos;t reach <code>{apiBaseUrl()}/api/version</code>. The
                API may be offline or the URL may be wrong.
              </p>
            )}
          </section>
        </div>

        <p className="mt-6 text-xs text-gray-600">
          When Web and API SHAs don&apos;t match, the deploy is mid-cutover —
          give Vercel + the API host a minute and refresh. When prompt version
          changes, AI estimates run against the new prompt; record the
          version on every saved Estimate row.
        </p>
      </main>
    </AppShell>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 py-1 last:border-0">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd
        className={`text-right text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}
