// /toolbox-talks/new — log a new tailgate meeting.

import Link from 'next/link';
import { ToolboxTalkEditor } from '../../../components/toolbox-talk-editor';

export default function NewToolboxTalkPage() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/toolbox-talks" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Toolbox Talks
        </Link>
      </div>
      <h1 className="text-3xl font-bold text-yge-blue-500">New toolbox talk</h1>
      <p className="mt-2 text-gray-700">
        Log a tailgate safety meeting. Print the sign-in sheet from the detail
        page so the crew can sign in person.
      </p>
      <div className="mt-6">
        <ToolboxTalkEditor mode="create" />
      </div>
    </main>
  );
}
