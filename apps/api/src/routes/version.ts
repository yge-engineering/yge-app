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
  res.json({
    buildSha: process.env.BUILD_SHA ?? 'unknown',
    buildTimestamp: process.env.BUILD_TIMESTAMP ?? 'unknown',
    promptVersion: PROMPT_VERSION,
    nodeVersion: process.version,
    env: process.env.NODE_ENV ?? 'development',
    at: new Date().toISOString(),
  });
});
