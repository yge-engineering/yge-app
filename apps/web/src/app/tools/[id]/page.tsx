// /tools/[id] — edit a single tool. Inline patches against PATCH /api/tools/:id.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Tool, Employee } from '@yge/shared';
import { ToolEditor } from '@/components/tool-editor';

function apiBaseUrl(): string {
  return (
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
  );
}
function publicApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

async function fetchTool(id: string): Promise<Tool | null> {
  const res = await fetch(`${apiBaseUrl()}/api/tools/${encodeURIComponent(id)}`, {
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  const json = (await res.json()) as { tool: Tool };
  return json.tool;
}

async function fetchEmployees(): Promise<Employee[]> {
  const res = await fetch(`${apiBaseUrl()}/api/employees`, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = (await res.json()) as { employees: Employee[] };
  return json.employees;
}

export default async function ToolDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [tool, employees] = await Promise.all([
    fetchTool(params.id),
    fetchEmployees(),
  ]);
  if (!tool) notFound();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6">
        <Link href="/tools" className="text-sm text-yge-blue-500 hover:underline">
          &larr; Back to tools
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <ToolEditor
          initial={tool}
          employees={employees}
          apiBaseUrl={publicApiBaseUrl()}
        />
      </div>
    </main>
  );
}
