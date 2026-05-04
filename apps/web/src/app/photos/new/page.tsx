// /photos/new — log a new photo entry.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { PhotoEditor } from '../../../components/photo-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewPhotoPage() {
  const t = getTranslator();
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
        <PhotoEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
