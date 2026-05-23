'use client';

// PlanViewer — basic PDF render-to-canvas with page navigation and zoom.
//
// Foundation for the PDF plan editor. Measurement tools (length / area /
// count / etc.) land in follow-up bundles as overlay layers on top of the
// same canvas. Worker is loaded from cdnjs pinned to the installed
// pdfjs-dist version — keeps Next.js bundling simple. We can swap to a
// self-hosted worker later for offline use.

import { useEffect, useRef, useState } from 'react';
import {
  getDocument,
  GlobalWorkerOptions,
  version as pdfjsVersion,
  type PDFDocumentProxy,
} from 'pdfjs-dist';

if (typeof window !== 'undefined' && !GlobalWorkerOptions.workerSrc) {
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.mjs`;
}

interface Props {
  url: string;
}

export function PlanViewer({ url }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load the document when the URL changes.
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

  // Render the current page when pdf / page / zoom changes.
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    void (async () => {
      try {
        const pageObj = await pdf.getPage(page);
        if (cancelled) return;
        const viewport = pageObj.getViewport({ scale: zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        // pdfjs-dist >=4.7 requires `canvas` alongside canvasContext.
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

  return (
    <div className="rounded-md border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
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
      </div>
      <div className="relative max-h-[80vh] overflow-auto bg-gray-100 p-4">
        {loading ? (
          <div className="text-sm text-gray-600">Loading PDF…</div>
        ) : error ? (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <canvas ref={canvasRef} className="mx-auto shadow-md" />
        )}
      </div>
    </div>
  );
}
