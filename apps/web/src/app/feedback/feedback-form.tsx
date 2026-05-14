'use client';

import { useState } from 'react';

export function FeedbackForm() {
  const [subject, setSubject] = useState('YGE app feedback');
  const [body, setBody] = useState('');
  const mailto = `mailto:ryoung@youngge.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="block text-xs font-semibold text-gray-700">Subject</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-semibold text-gray-700">Body</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          placeholder="What broke? What's missing? What would help?"
          className="mt-1 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      <a
        href={mailto}
        className="inline-block rounded bg-yge-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700"
      >
        Open in Mail
      </a>
      <p className="text-xs text-gray-500">
        Opens your default mail app with the message pre-filled and addressed to ryoung@youngge.com.
      </p>
    </div>
  );
}
