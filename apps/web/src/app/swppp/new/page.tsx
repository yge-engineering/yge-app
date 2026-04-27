// /swppp/new — log a new SWPPP/BMP inspection.

import Link from 'next/link';
import { SwpppInspectionEditor } from '../../../components/swppp-inspection-editor';

export default function NewSwpppInspectionPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/swppp" className="text-sm text-yge-blue-500 hover:underline">
          &larr; SWPPP Inspections
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">New inspection</h1>
      <p className="mt-2 text-gray-700">
        Log today's SWPPP / BMP inspection. List each BMP checked, status, and
        any corrective action.
      </p>
      <div className="mt-6">
        <SwpppInspectionEditor mode="create" />
      </div>
    </main>
  );
}
