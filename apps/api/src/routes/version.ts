// Version info endpoint.
//
// GET /api/version → { buildSha, buildTimestamp, promptVersion,
//                       nodeVersion, env }
//
// Useful for debugging "which deploy am I hitting?" + "what
// prompt version did this bid run against?" The browser
// extension popup can also show it in the footer so users
// know they're not on a stale build.
//
// All values come from environment variables set at build time
// (BUILD_SHA, BUILD_TIMESTAMP) or are read live (NODE_ENV).
// Falls back to "unknown" when the build vars aren't set so
// the endpoint never throws.

import { Router } from 'express';

import { PROMPT_VERSION } from '../lib/prompts/plans-to-estimate-v1';

export const versionRouter = Router();

versionRouter.get('/', (_req, res) => {
  // Resolve the build SHA from whatever the platform provides.
  // Render's built-in for the deployed commit is RENDER_GIT_COMMIT;
  // BUILD_SHA is honored too in case a future host wires it
  // directly. /admin/version was showing "unknown" because the
  // render.yaml's `fromCommitSha: true` doesn't actually populate
  // BUILD_SHA at runtime — only RENDER_GIT_COMMIT does.
  const buildSha =
    process.env.BUILD_SHA ??
    process.env.RENDER_GIT_COMMIT ??
    'unknown';
  // Build timestamp: prefer an explicit BUILD_TIMESTAMP (set by
  // CI / build script), otherwise fall back to the process start
  // time since boot. Render doesn't expose a commit-time env var.
  const buildTimestamp =
    process.env.BUILD_TIMESTAMP ?? processStartedAtIso;

  res.json({
    buildSha,
    buildTimestamp,
    promptVersion: PROMPT_VERSION,
    nodeVersion: process.version,
    env: process.env.NODE_ENV ?? 'development',
    at: new Date().toISOString(),
  });
});

// Captured once at module load so /admin/version has a real
// fallback when BUILD_TIMESTAMP isn't set by the host. Reflects
// the deploy boot time, not the commit time, but it's still more
// useful than 'unknown'.
const processStartedAtIso = new Date().toISOString();
