// LicenseRenewalBanner — surfaces expiring CSLB / DIR / DOT licenses
// on the dashboard so renewals don't blow past their dates.
//
// Plain English: bond agents and bid forms ask for these every time.
// If a license expires, YGE can't bid on public work. This watches
// the master profile expiration dates and shows a yellow banner at
// 60 days, red at 30, expired in red. Hidden when nothing is close.

import { Alert } from './alert';
import type { MasterProfile } from '@yge/shared';

interface Props {
  profile: MasterProfile | null;
  /** Days-until thresholds; default 60d warn, 30d danger. */
  warnDays?: number;
  dangerDays?: number;
}

interface Item {
  label: string;
  expiresOn: string;
}

function daysUntil(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const d = new Date(iso + 'T23:59:59');
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

export function LicenseRenewalBanner({
  profile,
  warnDays = 60,
  dangerDays = 30,
}: Props) {
  if (!profile) return null;
  const now = new Date();
  const tracked: Item[] = [];
  if (profile.cslbExpiresOn)
    tracked.push({ label: `CSLB ${profile.cslbLicense}`, expiresOn: profile.cslbExpiresOn });
  if (profile.dirExpiresOn)
    tracked.push({ label: `DIR ${profile.dirNumber}`, expiresOn: profile.dirExpiresOn });
  if (profile.dotExpiresOn && profile.dotNumber)
    tracked.push({ label: `USDOT ${profile.dotNumber}`, expiresOn: profile.dotExpiresOn });
  if (profile.caMcpExpiresOn && profile.caMcpNumber)
    tracked.push({ label: `CA MCP ${profile.caMcpNumber}`, expiresOn: profile.caMcpExpiresOn });

  const flagged = tracked
    .map((it) => ({ ...it, days: daysUntil(it.expiresOn, now) }))
    .filter((it) => it.days !== null && it.days <= warnDays)
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  if (flagged.length === 0) return null;

  const worst = flagged[0]!.days!;
  const tone =
    worst < 0 ? 'danger' : worst <= dangerDays ? 'danger' : 'warn';
  const summary = flagged
    .map((it) =>
      it.days! < 0
        ? `${it.label} expired ${Math.abs(it.days!)} days ago`
        : `${it.label} expires in ${it.days} days (${it.expiresOn})`,
    )
    .join(' · ');

  return (
    <Alert tone={tone}>
      <strong>License renewal alert:</strong> {summary}.{' '}
      <a href="/master-profile" className="underline">
        Update on the master profile →
      </a>
    </Alert>
  );
}
