'use client';

// PlanEditor — interactive PDF viewer + measurement overlay.

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  getDocument,
  GlobalWorkerOptions,
  version as pdfjsVersion,
  type PDFDocumentProxy,
} from 'pdfjs-dist';
import {
  feetPerPlanUnit,
  type PlanPoint,
  type PlanScale,
  type PlanSheetTakeoff,
  type PlanTakeoff,
  type ScaleUnit,
} from '@yge/shared';

if (typeof window !== 'undefined' && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`;
}

type Tool = 'pan' | 'scale';

interface ScaleDraft {
  pointA?: PlanPoint;
  pointB?: PlanPoint;
}

interface Props {
  takeoff: PlanTakeoff;
  apiBaseUrl: string;
}

const SCALE_UNITS: ScaleUnit[] = ['FT', 'IN', 'YD', 'M', 'CM'];

export function PlanEditor({ takeoff: initial, apiBaseUrl }: Props) {
  const [takeoff, setTakeoff] = useState<PlanTakeoff>(initial);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [tool, setTool] = useState<Tool>('pan');
  const [scaleDraft, setScaleDraft] = useState<ScaleDraft>({});
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [scaleDistance, setScaleDistance] = useState('');
  const [scaleUnit, setScaleUnit] = useState<ScaleUnit>('FT');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const url = takeoff.planRef;
  const sheetIndex = page - 1;
  const currentSheet: PlanSheetTakeoff | undefined = takeoff.sheets.find(
    (s) => s.sheetIndex === sheetIndex,
  );
  const currentScale = currentSheet?.scale;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    setPdf(null);
    if (!url) {
      setError('No PDF URL provided.');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const task = getDocument(url);
        const doc = await task.promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        setPdf(doc);
        setPageCount(doc.numPages);
        setPage(1);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    void (async () => {
      try {
        const pageObj = await pdf.getPage(page);
        if (cancelled) return;
        const baseViewport = pageObj.getViewport({ scale: 1 });
        setPageSize({ width: baseViewport.width, height: baseViewport.height });
        const viewport = pageObj.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await pageObj.render({ canvas, canvasContext: ctx, viewport }).promise;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render page');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, page, zoom]);

  function activateTool(next: Tool) {
    setTool(next);
    setScaleDraft({});
    setSaveError(null);
  }

  function handleOverlayClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (tool !== 'scale') return;
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const planPt = pt.matrixTransform(ctm.inverse());
    const point: PlanPoint = { x: planPt.x, y: planPt.y };
    if (!scaleDraft.pointA) {
      setScaleDraft({ pointA: point });
    } else if (!scaleDraft.pointB) {
      setScaleDraft({ pointA: scaleDraft.pointA, pointB: point });
      setScaleDialogOpen(true);
    }
  }

  function cancelScale() {
    setScaleDraft({});
    setScaleDialogOpen(false);
    setScaleDistance('');
    setSaveError(null);
  }

  async function saveScale() {
    if (!scaleDraft.pointA || !scaleDraft.pointB) return;
    const dist = Number(scaleDistance);
    if (!Number.isFinite(dist) || dist <= 0) {
      setSaveError('Enter a positive real-world distance.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const newScale: PlanScale = {
      pointA: scaleDraft.pointA,
      pointB: scaleDraft.pointB,
      realDistance: dist,
      realUnit: scaleUnit,
    };
    const newSheets: PlanSheetTakeoff[] = takeoff.sheets.map((s) => ({ ...s }));
    const existingIdx = newSheets.findIndex((s) => s.sheetIndex === sheetIndex);
    if (existingIdx >= 0) {
      const existing = newSheets[existingIdx];
      if (existing) newSheets[existingIdx] = { ...existing, scale: newScale };
    } else {
      newSheets.push({ sheetIndex, scale: newScale, measurements: [] });
    }
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/plan-takeoffs/${encodeURIComponent(takeoff.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sheets: newSheets }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(body.error ?? `Save failed (${res.status})`);
        setSaving(false);
        return;
      }
      const body = (await res.json()) as { takeoff: PlanTakeoff };
      setTakeoff(body.takeoff);
      setScaleDialogOpen(false);
      setScaleDraft({});
      setScaleDistance('');
      setTool('pan');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const strokePx = pageSize ? 2 / Math.max(zoom, 0.001) : 1;

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => activateTool('pan')}
            className={`rounded border px-2 py-1 text-xs ${
              tool === 'pan'
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            ✋ Pan
          </button>
          <button
            type="button"
            onClick={() => activateTool('scale')}
            disabled={!pdf}
            className={`rounded border px-2 py-1 text-xs ${
              tool === 'scale'
                ? 'border-red-600 bg-red-600 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            } disabled:opacity-40`}
            title="Click two points with a known real-world distance"
          >
            📏 Set scale
          </button>
        </div>
        <span className="mx-2 h-4 w-px bg-gray-300" />
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || !pdf}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="text-xs text-gray-700">
          Page {page} of {pageCount || '…'}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(pageCount || p, p + 1))}
          disabled={page >= pageCount || !pdf}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-40"
        >
          Next →
        </button>
        <span className="mx-2 h-4 w-px bg-gray-300" />
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.25, z / 1.2))}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
        >
          −
        </button>
        <span className="text-xs text-gray-700">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(8, z * 1.2))}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50"
        >
          Reset
        </button>
        <span className="ml-auto text-xs text-gray-600">
          Scale:{' '}
          {currentScale ? (
            <strong>
              1 plan unit = {feetPerPlanUnit(currentScale).toFixed(4)} ft
            </strong>
          ) : (
            <em className="text-amber-700">not set on this sheet</em>
          )}
        </span>
      </div>

      <div className="relative max-h-[80vh] overflow-auto bg-gray-100 p-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading PDF…</div>
        ) : error ? (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <div
            className="relative mx-auto inline-block"
            style={{
              width: pageSize ? pageSize.width * zoom : undefined,
              height: pageSize ? pageSize.height * zoom : undefined,
            }}
          >
            <canvas ref={canvasRef} className="block shadow-md" />
            {pageSize ? (
              <svg
                viewBox={`0 0 ${pageSize.width} ${pageSize.height}`}
                onClick={handleOverlayClick}
                className="absolute inset-0 h-full w-full"
                style={{
                  cursor: tool === 'scale' ? 'crosshair' : 'default',
                  pointerEvents: tool === 'pan' ? 'none' : 'auto',
                }}
              >
                {currentScale ? (
                  <g>
                    <line
                      x1={currentScale.pointA.x}
                      y1={currentScale.pointA.y}
                      x2={currentScale.pointB.x}
                      y2={currentScale.pointB.y}
                      stroke="#dc2626"
                      strokeWidth={strokePx}
                      strokeDasharray={`${strokePx * 3} ${strokePx * 2}`}
                    />
                    <circle cx={currentScale.pointA.x} cy={currentScale.pointA.y} r={strokePx * 3} fill="#dc2626" />
                    <circle cx={currentScale.pointB.x} cy={currentScale.pointB.y} r={strokePx * 3} fill="#dc2626" />
                  </g>
                ) : null}
                {scaleDraft.pointA ? (
                  <circle cx={scaleDraft.pointA.x} cy={scaleDraft.pointA.y} r={strokePx * 3} fill="#f59e0b" />
                ) : null}
                {scaleDraft.pointA && scaleDraft.pointB ? (
                  <g>
                    <line
                      x1={scaleDraft.pointA.x}
                      y1={scaleDraft.pointA.y}
                      x2={scaleDraft.pointB.x}
                      y2={scaleDraft.pointB.y}
                      stroke="#f59e0b"
                      strokeWidth={strokePx}
                    />
                    <circle cx={scaleDraft.pointB.x} cy={scaleDraft.pointB.y} r={strokePx * 3} fill="#f59e0b" />
                  </g>
                ) : null}
              </svg>
            ) : null}
            {tool === 'scale' && !scaleDialogOpen ? (
              <div className="pointer-events-none absolute left-2 top-2 rounded bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 shadow">
                {scaleDraft.pointA
                  ? 'Click the second point of a known distance.'
                  : 'Click the first point of a known distance.'}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {scaleDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-md border border-gray-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Set scale</h2>
            <p className="mt-1 text-sm text-gray-700">
              How long is the distance you just drew, in real-world units?
            </p>
            <div className="mt-4 flex items-end gap-2">
              <label className="flex-1 text-sm">
                <span className="mb-1 block font-medium text-gray-700">Distance</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={scaleDistance}
                  onChange={(e) => setScaleDistance(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. 50"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-gray-700">Unit</span>
                <select
                  value={scaleUnit}
                  onChange={(e) => setScaleUnit(e.target.value as ScaleUnit)}
                  className="rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {SCALE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {saveError ? (
              <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
                {saveError}
              </div>
            ) : null}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelScale}
                disabled={saving}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveScale()}
                disabled={saving}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Set scale'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
