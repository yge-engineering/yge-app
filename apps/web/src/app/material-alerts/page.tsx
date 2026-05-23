// /material-alerts — material price-jump alerts from AP invoices.
//
// Wires bundle 2514's scanForPriceJumps into a real page. Reads all
// AP invoices, flattens them into MaterialPurchase rows (one per
// line item), and surfaces the price-jump alerts grouped by severity.
//
// Server component — no client interactivity beyond the linkouts.

import Link from 'next/link';
import {
  attentionAlerts,
  scanForPriceJumps,
  type ApInvoice,
  type MaterialPriceAlert,
  type MaterialPurchase,
} from '@yge/shared';

import { AppShell, PageHeader, Tile } from '../../components';
import { requirePermission } from '../../lib/permissions';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchInvoices(): Promise<ApInvoice[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/ap-invoices`, { cache: 'no-store' });
    if (!res.ok) return [];
    return ((await res.json()) as { apInvoices: ApInvoice[] }).apInvoices ?? [];
  } catch {
    return [];
  }
}

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const SEVERITY_TONE: Record<MaterialPriceAlert['severity'], string> = {
  critical: 'border-red-300 bg-red-50 text-red-900',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  info: 'border-blue-300 bg-blue-50 text-blue-900',
};

export default async function MaterialAlertsPage() {
  requirePermission('financials:view');
  const invoices = await fetchInvoices();

  const purchases: MaterialPurchase[] = invoices.flatMap((inv) =>
    (inv.lineItems ?? [])
      .filter((li) => li.description && li.unitPriceCents > 0 && li.quantity > 0)
      .map((li) => ({
        invoiceId: inv.id,
        postedOn: inv.invoiceDate,
        vendorName: inv.vendorName,
        description: li.description,
        unit: li.unit,
        unitPriceCents: li.unitPriceCents,
      })),
  );

  const alerts = scanForPriceJumps(purchases);
  const attention = attentionAlerts(alerts);
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warnCount = alerts.filter((a) => a.severity === 'warn').length;
  const infoCount = alerts.filter((a) => a.severity === 'info').length;

  return (
    <AppShell>
      <main className="mx-auto max-w-5xl p-8">
        <PageHeader
          title="Material price alerts"
          subtitle="Per-line AP scan for jumps > 15% from the prior purchase of the same material. Warn at 22.5%, critical at 30%."
        />

        <div className="grid gap-3 sm:grid-cols-4">
          <Tile label="Scanned purchases" value={String(purchases.length)} />
          <Tile label="Critical" value={String(criticalCount)} />
          <Tile label="Warn" value={String(warnCount)} />
          <Tile label="Info" value={String(infoCount)} />
        </div>

        {alerts.length === 0 ? (
          <p className="mt-8 rounded-lg border border-green-300 bg-green-50 p-6 text-sm text-green-900">
            No price-jump alerts across {purchases.length} AP material purchases. Pricing looks stable.
          </p>
        ) : (
          <>
            {attention.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-gray-900">Needs attention ({attention.length})</h2>
                <ul className="mt-3 space-y-2">
                  {attention.map((a, i) => (
                    <AlertCard key={`${a.materialKey}-${i}`} alert={a} />
                  ))}
                </ul>
              </section>
            )}

            {alerts.filter((a) => a.severity === 'info').length > 0 && (
              <section className="mt-8">
                <h2 className="text-sm font-semibold text-gray-700">
                  Informational ({alerts.filter((a) => a.severity === 'info').length})
                </h2>
                <ul className="mt-2 space-y-2">
                  {alerts
                    .filter((a) => a.severity === 'info')
                    .map((a, i) => (
                      <AlertCard key={`${a.materialKey}-${i}`} alert={a} />
                    ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}

function AlertCard({ alert }: { alert: MaterialPriceAlert }) {
  const sign = alert.changePct >= 0 ? '+' : '';
  return (
    <li className={`rounded border-l-4 px-4 py-3 text-sm ${SEVERITY_TONE[alert.severity]}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-semibold">{alert.description}</div>
        <div className="font-mono">
          {sign}
          {(alert.changePct * 100).toFixed(1)}%
        </div>
      </div>
      <div className="mt-1 text-xs">
        Prior: {fmtMoney(alert.priorPurchase.unitPriceCents)}/{alert.unit ?? 'unit'} from{' '}
        <Link className="underline" href={`/ap-invoices/${alert.priorPurchase.invoiceId}`}>
          {alert.priorPurchase.vendorName}
        </Link>{' '}
        on {alert.priorPurchase.postedOn}.
      </div>
      <div className="text-xs">
        New: {fmtMoney(alert.newPurchase.unitPriceCents)}/{alert.unit ?? 'unit'} from{' '}
        <Link className="underline" href={`/ap-invoices/${alert.newPurchase.invoiceId}`}>
          {alert.newPurchase.vendorName}
        </Link>{' '}
        on {alert.newPurchase.postedOn}.
      </div>
    </li>
  );
}
