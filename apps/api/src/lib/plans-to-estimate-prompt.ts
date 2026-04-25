// DEPRECATED — kept as a compatibility shim. The canonical prompt now lives
// in apps/api/src/lib/prompts/plans-to-estimate-v1.ts (per CLAUDE.md, prompts
// go in lib/prompts/ and are version-tagged).
//
// Once nothing else imports this path, delete this file (with Ryan's
// approval per the global "never delete without approval" rule).

export {
  SYSTEM_PROMPT,
  buildUserMessage,
  PROMPT_VERSION,
} from './prompts/plans-to-estimate-v1';
