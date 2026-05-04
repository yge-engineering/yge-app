// /weather/new — log a new day's weather.

import Link from 'next/link';

import { AppShell } from '../../../components/app-shell';
import { WeatherLogEditor } from '../../../components/weather-log-editor';
import { getTranslator } from '../../../lib/locale';

export default function NewWeatherLogPage() {
  const t = getTranslator();
  return (
    <AppShell>
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/weather" className="text-sm text-yge-blue-500 hover:underline">
          {t('newWeatherPg.back')}
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">{t('newWeatherPg.title')}</h1>
      <p className="mt-2 text-gray-700">
        {t('newWeatherPg.subtitle')}
      </p>
      <div className="mt-6">
        <WeatherLogEditor mode="create" />
      </div>
    </main>
    </AppShell>
  );
}
