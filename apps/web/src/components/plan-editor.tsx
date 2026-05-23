'use client';

// PlanEditor — interactive PDF viewer + measurement overlay.
//
// Tools: pan / scale / length / count / area / polyline / radius / volume.
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
import { MeasurementsPanel } from './plan-editor-measurements';
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
  type TakeoffMeasurementKind,
} from '@yge/shared';

if (typeof window !== 'undefined' && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`;
}

type Tool =
  | 'pan'
  | 'scale'
  | 'length'
  | 'count'
  | 'area'
  | 'polyline'
  | 'radius'
  | 'volume';

interface Props {
  takeoff: PlanTakeoff;
  apiBaseUrl: string;
}

const SCALE_UNITS: ScaleUnit[] = ['FT', 'IN', 'YD', 'M', 'CM'];

/** Tools that accumulate points and need a "Finish" button. */
const POLY_TOOLS: Tool[] = ['area', 'polyline', 'volume'];

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
  const [polygonPoints, setPolygonPoints] = useState<PlanPoint[]>([]);
  const [radiusDraft, setRadiusDraft] = useState<{ pointA?: PlanPoint }>({});
  const [volumeDialogOpen, setVolumeDialogOpen] = useState(false);
  const [volumeDepth, setVolumeDepth] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());

  function toggleLayer(layer: string) {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      return next;
    });
  }

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const url = takeoff.planRef;
  const sheetIndex = page - 1;
  const currentSheet: PlanSheetTakeoff | undefined = takeoff.sheets.find(
    (s) => s.sheetIndex === sheetIndex,
  );
  const currentScale = currentSheet?.scale;
  const currentMeasurements = currentSheet?.measurements ?? [];
  const visibleMeasurements = currentMeasurements.filter(
    (m) => !hiddenLayers.has(m.layer ?? '__nolayer__'),
  );
  const needsScale = (k: TakeoffMeasurementKind) => k !== 'COUNT';

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
    setPolygonPoints([]);
    setRadiusDraft({});
    setVolumeDialogOpen(false);
    setVolumeDepth('');
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

  async function appendMeasurement(m: TakeoffMeasurement): Promise<boolean> {
    const out = await patchCurrentSheet((sheet) => ({
      ...sheet,
      measurements: [...sheet.measurements, m],
    }));
    return out !== null;
  }

  // ---- Scale tool -----------------------------------------------------------
  function handleScaleClick(point: PlanPoint) {
    if (!scaleDraft.pointA) setScaleDraft({ pointA: point });
    else if (!scaleDraft.pointB) {
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
    await appendMeasurement({
      id: newPlanMeasurementId(),
      kind: 'LENGTH',
      points: [a, point],
      color: defaultMeasurementColor('LENGTH'),
    });
  }

  // ---- Count tool -----------------------------------------------------------
  async function handleCountClick(point: PlanPoint) {
    if (!activeCountId) {
      const newId = newPlanMeasurementId();
      setActiveCountId(newId);
      const n = currentMeasurements.filter((m) => m.kind === 'COUNT').length + 1;
      await appendMeasurement({
        id: newId,
        kind: 'COUNT',
        points: [point],
        color: defaultMeasurementColor('COUNT'),
        label: `Count ${n}`,
      });
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

  // ---- Radius tool ----------------------------------------------------------
  async function handleRadiusClick(point: PlanPoint) {
    if (!radiusDraft.pointA) {
      setRadiusDraft({ pointA: point });
      return;
    }
    const a = radiusDraft.pointA;
    setRadiusDraft({});
    await appendMeasurement({
      id: newPlanMeasurementId(),
      kind: 'RADIUS',
      points: [a, point],
      color: defaultMeasurementColor('RADIUS'),
    });
  }

  // ---- Area / polyline / volume drafts --------------------------------------
  function handlePolyClick(point: PlanPoint) {
    setPolygonPoints((pts) => [...pts, point]);
  }

  async function finishAreaOrPolyline() {
    if (tool === 'area' && polygonPoints.length >= 3) {
      const pts = polygonPoints;
      setPolygonPoints([]);
      await appendMeasurement({
        id: newPlanMeasurementId(),
        kind: 'AREA',
        points: pts,
        color: defaultMeasurementColor('AREA'),
      });
    } else if (tool === 'polyline' && polygonPoints.length >= 2) {
      const pts = polygonPoints;
      setPolygonPoints([]);
      await appendMeasurement({
        id: newPlanMeasurementId(),
        kind: 'POLYLINE',
        points: pts,
        color: defaultMeasurementColor('POLYLINE'),
      });
    } else if (tool === 'volume' && polygonPoints.length >= 3) {
      // Open the depth dialog — measurement is created on saveVolume().
      setVolumeDialogOpen(true);
    } else {
      setSaveError(
        tool === 'polyline'
          ? 'Click at least 2 points before finishing.'
          : 'Click at least 3 points before finishing.',
      );
    }
  }

  function cancelVolume() {
    setVolumeDialogOpen(false);
    setVolumeDepth('');
    setSaveError(null);
  }
  async function saveVolume() {
    const depth = Number(volumeDepth);
    if (!Number.isFinite(depth) || depth <= 0) {
      setSaveError('Enter a positive depth in feet.');
      return;
    }
    const pts = polygonPoints;
    if (pts.length < 3) return;
    const ok = await appendMeasurement({
      id: newPlanMeasurementId(),
      kind: 'VOLUME',
      points: pts,
      depthFeet: depth,
      color: defaultMeasurementColor('VOLUME'),
    });
    if (ok) {
      setPolygonPoints([]);
      setVolumeDialogOpen(false);
      setVolumeDepth('');
    }
  }

  // ---- Overlay click dispatcher ---------------------------------------------
  function handleOverlayClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (tool === 'pan') return;
    const point = svgPointFromEvent(e);
    if (!point) return;
    if (tool === 'scale') handleScaleClick(point);
    else if (tool === 'length') void handleLengthClick(point);
    else if (tool === 'count') void handleCountClick(point);
    else if (tool === 'radius') void handleRadiusClick(point);
    else handlePolyClick(point);
  }

  // ---- Sheet rollup ---------------------------------------------------------
  const totals = currentMeasurements.reduce<Record<string, number>>((acc, m) => {
    const v = measurementValue(m, currentScale);
    acc[v.unit] = (acc[v.unit] ?? 0) + v.value;
    return acc;
  }, {});

  const strokePx = pageSize ? 2 / Math.max(zoom, 0.001) : 1;
  const textPx = pageSize ? 12 / Math.max(zoom, 0.001) : 1;
  const overlayActive = tool !== 'pan';
  const polyActive = POLY_TOOLS.includes(tool);

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
          title="Click to stamp items"
        />
        <ToolBtn
          label="⬢ Area"
          tone="green"
          active={tool === 'area'}
          disabled={!pdf || !currentScale}
          onClick={() => activateTool('area')}
          title={currentScale ? 'Multi-click polygon → Finish' : 'Set a scale first'}
        />
        <ToolBtn
          label="〰 Polyline"
          tone="orange"
          active={tool === 'polyline'}
          disabled={!pdf || !currentScale}
          onClick={() => activateTool('polyline')}
          title={currentScale ? 'Multi-click chain → Finish' : 'Set a scale first'}
        />
        <ToolBtn
          label="◯ Radius"
          tone="amber"
          active={tool === 'radius'}
          disabled={!pdf || !currentScale}
          onClick={() => activateTool('radius')}
          title={currentScale ? 'Click center, then edge' : 'Set a scale first'}
        />
        <ToolBtn
          label="⛏ Volume"
          tone="teal"
          active={tool === 'volume'}
          disabled={!pdf || !currentScale}
          onClick={() => activateTool('volume')}
          title={currentScale ? 'Multi-click polygon → Finish → enter depth' : 'Set a scale first'}
        />
        {polyActive && polygonPoints.length > 0 ? (
          <>
            <span className="mx-2 h-4 w-px bg-gray-300" />
            <button
              type="button"
              onClick={() => void finishAreaOrPolyline()}
              className="rounded border border-emerald-600 bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              ✓ Finish ({polygonPoints.length} pts)
            </button>
            <button
              type="button"
              onClick={() => setPolygonPoints([])}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </>
        ) : null}
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

      {currentMeasurements.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-3 py-1 text-[11px] text-gray-700">
          <span className="font-semibold uppercase tracking-wide text-gray-500">Sheet rollup:</span>
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

      <MeasurementsPanel
        measurements={currentMeasurements}
        scale={currentScale}
        saving={saving}
        saveError={saveError}
        hiddenLayers={hiddenLayers}
        onToggleLayer={toggleLayer}
        onPatchSheet={patchCurrentSheet}
      />

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
                {visibleMeasurements.map((m) =>
                  renderMeasurement(m, currentScale, strokePx, textPx),
                )}

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
                {lengthDraft.pointA ? (
                  <circle cx={lengthDraft.pointA.x} cy={lengthDraft.pointA.y} r={strokePx * 3} fill={defaultMeasurementColor('LENGTH')} />
                ) : null}
                {radiusDraft.pointA ? (
                  <circle cx={radiusDraft.pointA.x} cy={radiusDraft.pointA.y} r={strokePx * 3} fill={defaultMeasurementColor('RADIUS')} />
                ) : null}
                {polyActive && polygonPoints.length > 0 ? (
                  <g>
                    {polygonPoints.length >= 2 ? (
                      <polyline
                        points={polygonPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={defaultMeasurementColor(tool === 'polyline' ? 'POLYLINE' : tool === 'volume' ? 'VOLUME' : 'AREA')}
                        strokeWidth={strokePx}
                        strokeDasharray={`${strokePx * 2} ${strokePx * 2}`}
                      />
                    ) : null}
                    {polygonPoints.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={strokePx * 2}
                        fill={defaultMeasurementColor(tool === 'polyline' ? 'POLYLINE' : tool === 'volume' ? 'VOLUME' : 'AREA')}
                      />
                    ))}
                  </g>
                ) : null}
              </svg>
            ) : null}
            {overlayActive && !scaleDialogOpen && !volumeDialogOpen ? (
              <div className="pointer-events-none absolute left-2 top-2 max-w-xs rounded bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-900 shadow">
                {tool === 'scale'
                  ? scaleDraft.pointA
                    ? 'Click the second point of a known distance.'
                    : 'Click the first point of a known distance.'
                  : tool === 'length'
                    ? lengthDraft.pointA
                      ? 'Click the end of the line.'
                      : 'Click the start of the line.'
                  : tool === 'count'
                    ? 'Click to stamp. Switch tools to end this count group.'
                  : tool === 'radius'
                    ? radiusDraft.pointA
                      ? 'Click a point on the edge of the circle.'
                      : 'Click the center of the circle.'
                  : polyActive
                    ? polygonPoints.length === 0
                      ? `Click points to outline the ${tool === 'polyline' ? 'chain' : tool === 'volume' ? 'volume area' : 'polygon'}.`
                      : `Click more points, then “Finish” (${polygonPoints.length} so far).`
                    : ''}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {scaleDialogOpen ? (
        <ModalDialog title="Set scale" onCancel={cancelScale} onSave={() => void saveScale()} saving={saving} saveError={saveError} saveLabel="Set scale">
          <p className="text-sm text-gray-700">How long is the distance you just drew, in real-world units?</p>
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
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>
        </ModalDialog>
      ) : null}

      {volumeDialogOpen ? (
        <ModalDialog title="Enter depth" onCancel={cancelVolume} onSave={() => void saveVolume()} saving={saving} saveError={saveError} saveLabel="Save volume">
          <p className="text-sm text-gray-700">How deep is the volume, in feet? Cubic yards = area × depth ÷ 27.</p>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Depth (ft)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              value={volumeDepth}
              onChange={(e) => setVolumeDepth(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="e.g. 1.5"
            />
          </label>
        </ModalDialog>
      ) : null}
    </div>
  );
}

// ---- Sub-components ---------------------------------------------------------

interface ToolBtnProps {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'red' | 'blue' | 'green' | 'orange' | 'amber' | 'teal';
  title?: string;
}
function ToolBtn({ label, active, onClick, disabled, tone, title }: ToolBtnProps) {
  const TONE_CLASSES: Record<NonNullable<ToolBtnProps['tone']>, string> = {
    red: 'border-red-600 bg-red-600 text-white',
    blue: 'border-blue-600 bg-blue-600 text-white',
    green: 'border-green-600 bg-green-600 text-white',
    orange: 'border-orange-600 bg-orange-600 text-white',
    amber: 'border-amber-600 bg-amber-600 text-white',
    teal: 'border-teal-700 bg-teal-700 text-white',
  };
  const activeClass = tone ? TONE_CLASSES[tone] : 'border-slate-700 bg-slate-700 text-white';
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

interface ModalDialogProps {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  saveLabel: string;
  children: React.ReactNode;
}
function ModalDialog({ title, onCancel, onSave, saving, saveError, saveLabel, children }: ModalDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-md border border-gray-200 bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <div className="mt-1">{children}</div>
        {saveError ? (
          <div className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">{saveError}</div>
        ) : null}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : saveLabel}
          </button>
        </div>
      </div>
    </div>
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
        <text x={midX} y={midY - textPx * 0.5} fontSize={textPx} fill={color} textAnchor="middle" paintOrder="stroke" stroke="white" strokeWidth={strokePx * 0.8}>
          {v.value.toFixed(1)} {v.unit}
        </text>
      </g>
    );
  }
  if (m.kind === 'POLYLINE' && m.points.length >= 2) {
    const v = measurementValue(m, scale);
    const last = m.points[m.points.length - 1];
    return (
      <g key={m.id}>
        <polyline
          points={m.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={strokePx}
        />
        {m.points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={strokePx * 1.5} fill={color} />
        ))}
        {last ? (
          <text x={last.x + textPx * 0.4} y={last.y - textPx * 0.4} fontSize={textPx} fill={color} paintOrder="stroke" stroke="white" strokeWidth={strokePx * 0.8}>
            {v.value.toFixed(1)} {v.unit}
          </text>
        ) : null}
      </g>
    );
  }
  if ((m.kind === 'AREA' || m.kind === 'VOLUME') && m.points.length >= 3) {
    const v = measurementValue(m, scale);
    const cx = m.points.reduce((s, p) => s + p.x, 0) / m.points.length;
    const cy = m.points.reduce((s, p) => s + p.y, 0) / m.points.length;
    return (
      <g key={m.id}>
        <polygon
          points={m.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeWidth={strokePx}
        />
        <text x={cx} y={cy} fontSize={textPx} fill={color} textAnchor="middle" paintOrder="stroke" stroke="white" strokeWidth={strokePx * 0.8}>
          {v.value.toFixed(1)} {v.unit}
        </text>
      </g>
    );
  }
  if (m.kind === 'RADIUS') {
    const a = m.points[0];
    const b = m.points[1];
    if (!a || !b) return null;
    const r = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    const v = measurementValue(m, scale);
    return (
      <g key={m.id}>
        <circle cx={a.x} cy={a.y} r={r} fill="none" stroke={color} strokeWidth={strokePx} />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={strokePx * 0.6} strokeDasharray={`${strokePx * 2} ${strokePx * 2}`} />
        <circle cx={a.x} cy={a.y} r={strokePx * 1.5} fill={color} />
        <text x={a.x} y={a.y - r - textPx * 0.4} fontSize={textPx} fill={color} textAnchor="middle" paintOrder="stroke" stroke="white" strokeWidth={strokePx * 0.8}>
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
            <circle cx={p.x} cy={p.y} r={strokePx * 4} fill={color} fillOpacity={0.8} stroke="white" strokeWidth={strokePx * 0.6} />
            <text x={p.x} y={p.y + strokePx * 1.5} fontSize={strokePx * 4} fill="white" textAnchor="middle" fontWeight="bold">
              {i + 1}
            </text>
          </g>
        ))}
      </g>
    );
  }
  return null;
}
