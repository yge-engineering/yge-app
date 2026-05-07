/** Map project type → emoji icon for inline labels. Falls back to 🚧. */
const ICONS: Record<string, string> = {
  DRAINAGE: '💧',
  FUEL_BREAK: '🔥',
  GRADING: '🚜',
  PAVING: '🛣️',
  STRUCTURE: '🏗️',
  UTILITIES: '🔌',
  OTHER: '🚧',
};

export function projectTypeIcon(projectType: string | undefined | null): string {
  if (!projectType) return '🚧';
  return ICONS[projectType] ?? '🚧';
}
