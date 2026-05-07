// /photos/new — log a new photo entry.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import {
  PhotoEditor,
  type PhotoEditorPrefill,
} from '../../../components/photo-editor';
import { getTranslator } from '../../../lib/locale';

const PREFILL_KEYS = [
  'jobId',
  'dailyReportId',
  'rfiId',
  'changeOrderId',
  'swpppInspectionId',
  'incidentId',
  'punchItemId',
] as const;

function buildPrefill(
  searchParams: Record<string, string | string[] | undefined>,
): PhotoEditorPrefill | undefined {
  const out: PhotoEditorPrefill = {};
  let any = false;
  for (const k of PREFILL_KEYS) {
    const v = searchParams[k];
    if (typeof v === 'string' && v.length > 0) {
      out[k] = v;
      any = true;
    }
  }
  const cat = searchParams.category;
  if (typeof cat === 'string' && cat.length > 0) {
    // Cast — invalid values fall through harmlessly to the form.
    out.category = cat as PhotoEditorPrefill['category'];
    any = true;
  }
  return any ? out : undefined;
}

export default function NewPhotoPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = getTranslator();
  const prefill = buildPrefill(searchParams);
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/photos" className="text-sm text-yge-blue-500 hover:underline">
          {t('newPhotoPg.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newPhotoPg.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newPhotoPg.subtitle')}
      </p>
      <div className="mt-6">
        <PhotoEditor mode="create" prefill={prefill} />
      </div>
    </main>
    </AppShell>
  );
}
