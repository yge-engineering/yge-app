// /toolbox-talks/new — log a new tailgate meeting.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { ToolboxTalkEditor } from '../../../components/toolbox-talk-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewToolboxTalkPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/toolbox-talks" className="text-sm text-yge-blue-500 hover:underline">
          {t('newToolboxPg.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newToolboxPg.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newToolboxPg.subtitle')}
      </p>
      <div className="mt-6">
        <ToolboxTalkEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
