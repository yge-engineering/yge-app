// /weather/new — log a new day's weather.

import Link from 'next/link';
import { WeatherLogEditor } from '../../../components/weather-log-editor';

export default function NewWeatherLogPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/weather" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Weather Log
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">Log day</h1>
      <p className="mt-2 text-gray-700">
        Record per-job weather. Heat-illness flags fire automatically at 80°F
        and 95°F.
      </p>
      <div className="mt-6">
        <WeatherLogEditor mode="create" />
      </div>
    </main>
  );
}
