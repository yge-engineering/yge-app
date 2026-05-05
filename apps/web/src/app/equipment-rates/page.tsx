// /equipment-rates — master rate book for owned + rental equipment.

import type { EquipmentRate } from '@yge/shared';

import { AppShell, PageHeader } from '../../components';
import { EquipmentRatesTable } from './equipment-rates-table';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}

async function fetchEquipmentRates(): Promise<EquipmentRate[]> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/equipment-rates`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as { equipmentRates?: EquipmentRate[] };
    return body.equipmentRates ?? [];
  } catch {
    return [];
  }
}

export default async function EquipmentRatesPage() {
  const rates = await fetchEquipmentRates();
  const owned = rates.filter((r) => r.kind === 'OWNED').length;
  const rental = rates.filter((r) => r.kind === 'RENTAL').length;
  return (
    <AppShell>
      <main className="mx-auto max-w-6xl">
        <PageHeader
          title="Equipment rates"
          subtitle={`${owned} owned + ${rental} rental rates from YGE Excel master`}
        />
        <EquipmentRatesTable rates={rates} />
      </main>
    </AppShell>
  );
}
