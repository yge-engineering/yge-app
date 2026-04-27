// /vendors/new — create a new vendor.

import Link from 'next/link';
import { VendorEditor } from '../../../components/vendor-editor';

export default function NewVendorPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/vendors" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Vendors
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">New vendor</h1>
      <p className="mt-2 text-gray-700">
        Add a supplier, subcontractor, or service provider to the vendor master.
      </p>
      <div className="mt-6">
        <VendorEditor mode="create" />
      </div>
    </main>
  );
}
