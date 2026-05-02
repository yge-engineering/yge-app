// Drawn-signature signing form.
//
// Renders an HTML5 canvas the signer draws into with mouse / touch /
// stylus, then POSTs the captured PNG dataUrl alongside the same
// consent + auth context the typed form sends. ESIGN/UETA still
// applies — the drawing is the act, the disclosure-hash + affirmation
// + auth context are the surrounding proof.
//
// Phase-1 attribution: IN_PERSON. The signer is drawing in front of
// the operator running the bid binder. OTP-attached DRAWN can layer
// in once the OTP form is generalized to take a signatureImage.

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sha256Hex } from '@yge/shared';

interface Props {
  apiBaseUrl: string;
  signatureId: string;
  expectedSignerName: string;
  disclosureText: string;
  affirmationText: string;
}

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 200;

export function SignFormDrawn({
  apiBaseUrl,
  signatureId,
  expectedSignerName,
  disclosureText,
  affirmationText,
}: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<boolean>(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, []);

  function pointerPos(ev: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) * canvas.width) / rect.width,
      y: ((ev.clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function onPointerDown(ev: React.PointerEvent<HTMLCanvasElement>) {
    if (signed) return;
    drawingRef.current = true;
    const p = pointerPos(ev);
    lastPointRef.current = p;
    canvasRef.current?.setPointerCapture(ev.pointerId);
  }

  function onPointerMove(ev: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const p = pointerPos(ev);
    const last = lastPointRef.current ?? p;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    if (!hasInk) setHasInk(true);
  }

  function onPointerUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    setError(null);
  }

  async function submit() {
    if (busy) return;
    if (!hasInk) {
      setError('Draw your signature in the box first.');
      return;
    }
    if (!agreed) {
      setError('Tick the consent box to proceed.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas unavailable');
      const dataUrl = canvas.toDataURL('image/png');
      const now = new Date();
      const disclosureSha256 = await sha256Hex(disclosureText);
      const res = await fetch(`${apiBaseUrl}/api/signatures/${signatureId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: {
            agreedAt: now.toISOString(),
            disclosureSha256,
            affirmationText,
          },
          authContext: {
            authMethod: 'IN_PERSON',
            authenticatedAt: now.toISOString(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          },
          signatureImage: {
            dataUrl,
            widthPx: CANVAS_WIDTH,
            heightPx: CANVAS_HEIGHT,
          },
          signedAt: now.toISOString(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Sign failed (${res.status})`);
        return;
      }
      setSigned(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-md border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
        Sign — drawn
      </h2>

      <p className="mb-2 text-sm text-gray-700">
        Sign as <strong className="font-medium text-gray-900">{expectedSignerName}</strong>.
        Use a finger / stylus on touch screens or click-and-drag with a mouse.
      </p>

      <div className="mb-3 inline-block rounded border-2 border-dashed border-gray-300 bg-white">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="touch-none"
          style={{
            width: '100%',
            maxWidth: `${CANVAS_WIDTH}px`,
            height: 'auto',
            cursor: signed ? 'default' : 'crosshair',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={clear}
          disabled={busy || signed || !hasInk}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Clear
        </button>
        <span className="text-xs text-gray-500">
          {hasInk ? '✓ Captured' : 'Empty — draw above to enable submit'}
        </span>
      </div>

      <label className="mb-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          disabled={busy || signed}
          className="mt-0.5"
        />
        <span className="text-gray-800">{affirmationText}</span>
      </label>

      {error && (
        <div className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {signed ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          ✓ Signed. The drawn-signature image and audit context have been
          recorded on the signature row.
        </div>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={!hasInk || !agreed || busy}
          className="rounded bg-yge-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-yge-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Signing…' : 'Sign'}
        </button>
      )}

      <p className="mt-4 text-xs text-gray-500">
        The PNG of your drawn signature, the SHA-256 of the disclosure text
        you saw, the affirmation line above, your user agent, your IP
        address (captured server-side), and the signing timestamp are all
        bound to this signature row when you click Sign.
      </p>
    </section>
  );
}
