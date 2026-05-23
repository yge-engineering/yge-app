'use client';

// PlanEditor — interactive PDF viewer + measurement overlay.
//
// Tools shipped so far:
//   - pan    : no-op overlay (canvas drag/scroll the underlying pane)
//   - scale  : 2-click calibration, modal for real distance + unit, persists on sheet
//   - length : 2-click line measurement (LF). Disabled until scale is set.
//   - count  : click to stamp; clicks accumulate into a single "count group"
//              until the user switches tools. Each click persists.
//
// All geometry is stored in plan-page coords (zoom-independent). The SVG
// overlay's viewBox = the PDF page user-space, so e.clientX/Y → plan-page
// coords via getScreenCTM().inverse().

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  getDocument,
  GlobalWorkerOptions,
  version as pdfjsVersion,
  type PDFDocumentProxy,
} from 'pdfjs-dist';
import {
  defaultMeasurementColor,
  feetPerPlanUnit,
  measurementValue,
  newPlanMeasurementId,
  type PlanPoint,
  type PlanScale,
  type PlanSheetTakeoff,
  type PlanTakeoff,
  type ScaleUnit,
  type TakeoffMeasurement,
} from '@yge/shared';

if (typeof window !== 'undefined' && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`;
}

type Tool = 'pan' | 'scale' | 'length' | 'count';

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
  const [scaleDraft, setScaleDraft] = useState<{ pointA?: PlanPoint; pointB?: PlanPoint }>({});
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [scaleDistance, setScaleDistance] = useState('');
  const [scaleUnit, setScaleUnit] = useState<ScaleUnit>('FT');
  const [lengthDraft, setLengthDraft] = useState<{ pointA?: PlanPoint }>({});
  const [activeCountId, setActiveCountId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const url = takeoff.planRef;
  const sheetIndex = page - 1;
  const currentSheet: PlanSheetTakeoff | undefined = takeoff.sheets.find(
    (s) => s.sheetIndex === sheetIndex,
  );
  const currentScale = currentSheet?.scale;
  const currentMeasurements = currentSheet?.measurements ?? [];

  // ---- PDF loading + render -------------------------------------------------
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load PDF');
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to render page');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, page, zoom]);

  // ---- Tool helpers ---------------------------------------------------------
  function activateTool(next: Tool) {
    setTool(next);
    setScaleDraft({});
    setLengthDraft({});
    setActiveCountId(null);
    setSaveError(null);
  }

  function svgPointFromEvent(e: ReactMouseEvent<SVGSVGElement>): PlanPoint | null {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const planPt = pt.matrixTransform(ctm.inverse());
    return { x: planPt.x, y: planPt.y };
  }

  /** PATCH the current sheet via a sheet-updater fn. Returns the saved takeoff
   *  on success, null on failure (saveError is set). */
  async function patchCurrentSheet(
    updater: (sheet: PlanSheetTakeoff) => PlanSheetTakeoff,
  ): Promise<PlanTakeoff | null> {
    const newSheets: PlanSheetTakeoff[] = takeoff.sheets.map((s) => ({ ...s }));
    const existingIdx = newSheets.findIndex((s) => s.sheetIndex === sheetIndex);
    if (existingIdx >= 0) {
      const existing = newSheets[existingIdx];
      if (existing) newSheets[existingIdx] = updater(existing);
    } else {
      newSheets.push(updater({ sheetIndex, measurements: [] }));
    }
    setSaving(true);
    setSaveError(null);
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
        return null;
      }
      const body = (await res.json()) as { takeoff: PlanTakeoff };
      setTakeoff(body.takeoff);
      return body.takeoff;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  }

  // ---- Scale tool -----------------------------------------------------------
  function handleScaleClick(point: PlanPoint) {
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
    const newScale: PlanScale = {
      pointA: scaleDraft.pointA,
      pointB: scaleDraft.pointB,
      realDistance: dist,
      realUnit: scaleUnit,
    };
    const ok = await patchCurrentSheet((sheet) => ({ ...sheet, scale: newScale }));
    if (ok) {
      setScaleDialogOpen(false);
      setScaleDraft({});
      setScaleDistance('');
      setTool('pan');
    }
  }

  // ---- Length tool ----------------------------------------------------------
  async function handleLengthClick(point: PlanPoint) {
    if (!lengthDraft.pointA) {
      setLengthDraft({ pointA: point });
      return;
    }
    const a = lengthDraft.pointA;
    setLengthDraft({});
    const m: TakeoffMeasurement = {
      id: newPlanMeasurementId(),
      kind: 'LENGTH',
      points: [a, point],
      color: defaultMeasurementColor('LENGTH'),
    };
    await patchCurrentSheet((sheet) => ({
      ...sheet,
      measurements: [...sheet.measurements, m],
    }));
  }

  // ---- Count tool -----------------------------------------------------------
  async function handleCountClick(point: PlanPoint) {
    if (!activeCountId) {
      const newId = newPlanMeasurementId();
      setActiveCountId(newId);
      const existingCounts = currentMeasurements.filter((m) => m.kind === 'COUNT').length;
      const m: TakeoffMeasurement = {
        id: newId,
        kind: 'COUNT',
        points: [point],
        color: defaultMeasurementColor('COUNT'),
        label: `Count ${existingCounts + 1}`,
      };
      await patchCurrentSheet((sheet) => ({
        ...sheet,
        measurements: [...sheet.measurements, m],
      }));
      return;
    }
    const id = activeCountId;
    await patchCurrentSheet((sheet) => ({
      ...sheet,
      measurements: sheet.measurements.map((m) =>
        m.id === id ? { ...m, points: [...m.points, point] } : m,
      ),
    }));
  }

  // ---- Overlay click dispatcher ---------------------------------------------
  function handleOverlayClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (tool === 'pan') return;
    const point = svgPointFromEvent(e);
    if (!point) return;
    if (tool === 'scale') handleScaleClick(point);
    else if (tool === 'length') void handleLengthClick(point);
    else if (tool === 'count') void handleCountClick(point);
  }

  // ---- Sheet rollup ---------------------------------------------------------
  const totals = currentMeasurements.reduce<Record<string, number>>((acc, m) => {
    const v = measurementValue(m, currentScale);
    acc[v.unit] = (acc[v.unit] ?? 0) + v.value;
    return acc;
  }, {});

  // ---- Render ---------------------------------------------------------------
  const strokePx = pageSize ? 2 / Math.max(zoom, 0.001) : 1;
  const textPx = pageSize ? 12 / Math.max(zoom, 0.001) : 1;
  const overlayActive = tool !== 'pan';

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <ToolBtn label="✋ Pan" active={tool === 'pan'} onClick={() => activateTool('pan')} />
        <ToolBtn
          label="📏 Scale"
          tone="red"
          active={tool === 'scale'}
          disabled={!pdf}
          onClick={() => activateTool('scale')}
          title="Click two points with a known real-world distance"
        />
        <ToolBtn
          label="📐 Length"
          tone="red"
          active={tool === 'length'}
          disabled={!pdf || !currentScale}
          onClick={() => activateTool('length')}
          title={currentScale ? 'Two-click line measurement' : 'Set a scale first'}
        />
        <ToolBtn
          label="🔢 Count"
          tone="blue"
          active={tool === 'count'}
          disabled={!pdf}
          onClick={() => activateTool('count')}
          title="Click to stamp items (catch basins, trees, signs…)"
        />
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
            <strong>1 plan unit = {feetPerPlanUnit(currentScale).toFixed(4)} ft</strong>
          ) : (
            <em className="text-amber-700">not set on this sheet</em>
          )}
        </span>
      </div>

      {/* Rollup row (per-sheet measurement totals) */}
      {currentMeasurements.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-3 py-1 text-[11px] text-gray-700">
          <span className="font-semibold text-gray-500 uppercase tracking-wide">Sheet rollup:</span>
          {Object.entries(totals).map(([unit, value]) => (
            <span key={unit}>
              <strong>{value.toFixed(unit === 'EA' ? 0 : 2)}</strong> {unit}
            </span>
          ))}
          <span className="text-gray-500">·</span>
          <span>{currentMeasurements.length} measurements</span>
          {saving ? <span className="text-blue-700">saving…</span> : null}
          {saveError ? <span className="text-red-700">{saveError}</span> : null}
        </div>
      ) : null}

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
                  cursor: overlayActive ? 'crosshair' : 'default',
                  pointerEvents: overlayActive ? 'auto' : 'none',
                }}
              >
                {/* Saved measurements */}
                {currentMeasurements.map((m) =>
                  renderMeasurement(m, currentScale, strokePx, textPx),
                )}

                {/* Saved scale calibration line */}
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

                {/* Drafts */}
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
                {lengthDraft.pointA ? (
                  <circle cx={lengthDraft.pointA.x} cy={lengthDraft.pointA.y} r={strokePx * 3} fill={defaultMeasurementColor('LENGTH')} />
                ) : null}
              </svg>
            ) : null}
            {overlayActive && !scaleDialogOpen ? (
              <div className="pointer-events-none absolute left-2 top-2 rounded bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 shadow">
                {tool === 'scale'
                  ? scaleDraft.pointA
                    ? 'Click the second point of a known distance.'
                    : 'Click the first point of a known distance.'
                  : tool === 'length'
                    ? lengthDraft.pointA
                      ? 'Click the end of the line.'
                      : 'Click the start of the line.'
                    : 'Click to stamp. Switch tools to end this count group.'}
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

// ---- Sub-components / render helpers ----------------------------------------

interface ToolBtnProps {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'red' | 'blue';
  title?: string;
}
function ToolBtn({ label, active, onClick, disabled, tone, title }: ToolBtnProps) {
  const activeClass =
    tone === 'red'
      ? 'border-red-600 bg-red-600 text-white'
      : tone === 'blue'
        ? 'border-blue-600 bg-blue-600 text-white'
        : 'border-slate-700 bg-slate-700 text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded border px-2 py-1 text-xs ${
        active ? activeClass : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      } disabled:opacity-40`}
    >
      {label}
    </button>
  );
}

function renderMeasurement(
  m: TakeoffMeasurement,
  scale: PlanScale | undefined,
  strokePx: number,
  textPx: number,
): React.ReactNode {
  const color = m.color ?? defaultMeasurementColor(m.kind);
  if (m.kind === 'LENGTH') {
    const a = m.points[0];
    const b = m.points[1];
    if (!a || !b) return null;
    const v = measurementValue(m, scale);
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    return (
      <g key={m.id}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={strokePx} />
        <circle cx={a.x} cy={a.y} r={strokePx * 2} fill={color} />
        <circle cx={b.x} cy={b.y} r={strokePx * 2} fill={color} />
        <text
          x={midX}
          y={midY - textPx * 0.5}
          fontSize={textPx}
          fill={color}
          textAnchor="middle"
          paintOrder="stroke"
          stroke="white"
          strokeWidth={strokePx * 0.8}
        >
          {v.value.toFixed(1)} {v.unit}
        </text>
      </g>
    );
  }
  if (m.kind === 'COUNT') {
    return (
      <g key={m.id}>
        {m.points.map((p, i) => (
          <g key={`${m.id}-${i}`}>
            <circle
              cx={p.x}
              cy={p.y}
              r={strokePx * 4}
              fill={color}
              fillOpacity={0.8}
              stroke="white"
              strokeWidth={strokePx * 0.6}
            />
            <text
              x={p.x}
              y={p.y + strokePx * 1.5}
              fontSize={strokePx * 4}
              fill="white"
              textAnchor="middle"
              fontWeight="bold"
            >
              {i + 1}
            </text>
          </g>
        ))}
      </g>
    );
  }
  return null;
}
