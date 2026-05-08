'use client';

import type { Vendor, Vendor1099Row } from '@yge/shared';

export interface Vendor1099CsvButtonProps {
  rows: Vendor1099Row[];
  vendors: Vendor[];
  year: number;
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function Vendor1099CsvButton({
  rows,
  vendors,
  year,
}: Vendor1099CsvButtonProps) {
  // Only export over-threshold rows by default — that's what gets
  // filed. The CPA can rerun without filtering if they want the
  // long tail.
  const filed = rows.filter((r) => r.overThreshold);

  function download() {
    const vendorById = new Map(vendors.map((v) => [v.id, v]));
    const header = [
      'VendorName',
      'TaxID',
      'AddressLine',
      'City',
      'State',
      'Zip',
      'AmountPaidCents',
      'AmountPaid',
      'W9OnFile',
      'MissingTaxId',
      'PaymentCount',
    ];
    const lines: string[] = [header.join(',')];
    for (const r of filed) {
      const v = r.vendorId ? vendorById.get(r.vendorId) : undefined;
      const cents = r.paidYtdCents;
      const dollars = (cents / 100).toFixed(2);
      const fields = [
        r.vendorName,
        v?.taxId ?? '',
        v?.addressLine ?? '',
        v?.city ?? '',
        v?.state ?? '',
        v?.zip ?? '',
        String(cents),
        dollars,
        v?.w9OnFile ? 'Y' : 'N',
        r.missingTaxId ? 'Y' : 'N',
        String(r.paymentCount),
      ];
      lines.push(fields.map((f) => escapeCsv(String(f ?? ''))).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `1099-nec-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={filed.length === 0}
      className="rounded-md border border-yge-blue-500 bg-white px-3 py-1.5 text-xs font-semibold text-yge-blue-700 hover:bg-yge-blue-50 disabled:opacity-50"
      title={
        filed.length === 0
          ? 'No over-threshold vendors yet — nothing to file.'
          : `Download ${filed.length} reportable vendor${filed.length === 1 ? '' : 's'} as CSV`
      }
    >
      📥 Download CSV
    </button>
  );
}
