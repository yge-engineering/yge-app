// Crew roster builder.
//
// Takes a flat list of employees + the tool inventory and returns a
// foreman-grouped report ready to render or email. The roster groups every
// employee under the foreman they report to (employee.foremanId), with each
// foreman appearing as a section header and the foreman themselves listed
// at the top of their own section.
//
// Office staff (no foreman, role !== 'FOREMAN') roll up into a single
// "Office" group at the bottom so the printed roster is a complete head-
// count with no orphans.
//
// Pure data shaping — no UI assumptions. Both the print page and the
// email-attachment builder consume the same return value.

import {
  certExpiryStatus,
  fullName,
  type Employee,
  type EmployeeCertification,
  type CertExpiryStatus,
} from './employee';
import { toolIdentifier, type Tool } from './tool';

export interface CrewRosterEntry {
  employee: Employee;
  /** Tools currently assigned to this employee. */
  tools: Tool[];
  /** Pre-computed cert urgency rollup so the renderer doesn't re-scan. */
  certs: Array<{
    cert: EmployeeCertification;
    status: CertExpiryStatus;
  }>;
  /** True iff at least one cert is expired. Drives the red-row styling. */
  anyExpired: boolean;
  /** True iff at least one cert is within the warn window (default 30 days). */
  anyExpiringSoon: boolean;
}

export interface CrewRosterGroup {
  /** Stable id used for HTML anchors + email subject lines. */
  id: string;
  /** Header label printed above the rows. "Brook Young's Crew" /
   *  "Office staff". */
  label: string;
  /** The foreman/lead employee for this group, when there is one. */
  foreman?: Employee;
  members: CrewRosterEntry[];
}

export interface CrewRoster {
  generatedAt: string;
  /** Inactive employees are excluded from the active roster but counted
   *  here for the header rollup. */
  totalActive: number;
  totalInactive: number;
  /** Number of certs that are expired across the active roster. */
  expiredCertCount: number;
  /** Number of certs expiring within warnDays across the active roster. */
  expiringSoonCertCount: number;
  groups: CrewRosterGroup[];
}

export interface BuildCrewRosterInput {
  employees: Employee[];
  tools: Tool[];
  /** Defaults to "now" when constructing; tests pin it. */
  now?: Date;
  /** How many days out counts as "expiring soon" for cert urgency.
   *  Defaults to 30. */
  warnDays?: number;
}

export function buildCrewRoster(input: BuildCrewRosterInput): CrewRoster {
  const now = input.now ?? new Date();
  const warnDays = input.warnDays ?? 30;
  const generatedAt = now.toISOString();

  // Index tools by assignee for O(1) lookups in the loop below.
  const toolsByAssignee = new Map<string, Tool[]>();
  for (const t of input.tools) {
    if (t.status !== 'ASSIGNED') continue;
    if (!t.assignedToEmployeeId) continue;
    const list = toolsByAssignee.get(t.assignedToEmployeeId) ?? [];
    list.push(t);
    toolsByAssignee.set(t.assignedToEmployeeId, list);
  }

  // Index employees by id and split active vs inactive.
  const empById = new Map<string, Employee>();
  const active: Employee[] = [];
  let inactive = 0;
  for (const e of input.employees) {
    empById.set(e.id, e);
    if (e.status === 'ACTIVE' || e.status === 'ON_LEAVE') {
      active.push(e);
    } else {
      inactive += 1;
    }
  }

  function makeEntry(emp: Employee): CrewRosterEntry {
    const tools = toolsByAssignee.get(emp.id) ?? [];
    const certs = emp.certifications.map((c) => ({
      cert: c,
      status: certExpiryStatus(c, now, warnDays),
    }));
    const anyExpired = certs.some((x) => x.status === 'expired');
    const anyExpiringSoon = certs.some((x) => x.status === 'expiringSoon');
    return { employee: emp, tools, certs, anyExpired, anyExpiringSoon };
  }

  // Bucket employees by foreman id. Office / unassigned go in 'OFFICE'.
  const byForeman = new Map<string, CrewRosterEntry[]>();
  const office: CrewRosterEntry[] = [];

  for (const emp of active) {
    if (emp.role === 'FOREMAN') {
      // Foreman themselves — initialize their bucket so they appear even
      // before any crew is assigned.
      const bucket = byForeman.get(emp.id) ?? [];
      // Foreman goes first in their own bucket — the renderer reads order.
      bucket.unshift(makeEntry(emp));
      byForeman.set(emp.id, bucket);
      continue;
    }
    if (emp.foremanId && empById.has(emp.foremanId)) {
      const bucket = byForeman.get(emp.foremanId) ?? [];
      bucket.push(makeEntry(emp));
      byForeman.set(emp.foremanId, bucket);
    } else {
      office.push(makeEntry(emp));
    }
  }

  // Sort within each bucket by display name for deterministic output.
  function byName(a: CrewRosterEntry, b: CrewRosterEntry): number {
    return fullName(a.employee).localeCompare(fullName(b.employee));
  }
  for (const arr of byForeman.values()) {
    // Keep foreman pinned at index 0 (already inserted with unshift) and
    // sort the rest of the crew alphabetically.
    if (arr.length > 1) {
      const [head, ...rest] = arr;
      rest.sort(byName);
      arr.length = 0;
      arr.push(head!, ...rest);
    }
  }
  office.sort(byName);

  const groups: CrewRosterGroup[] = [];
  // Foreman groups, sorted by foreman name.
  const foremanIds = Array.from(byForeman.keys()).sort((a, b) => {
    const ea = empById.get(a);
    const eb = empById.get(b);
    if (!ea || !eb) return 0;
    return fullName(ea).localeCompare(fullName(eb));
  });
  for (const fid of foremanIds) {
    const members = byForeman.get(fid)!;
    const foreman = empById.get(fid);
    const label = foreman ? `${fullName(foreman)}'s Crew` : 'Crew';
    groups.push({ id: `foreman-${fid}`, label, foreman, members });
  }
  if (office.length > 0) {
    groups.push({ id: 'office', label: 'Office staff', members: office });
  }

  // Rollup cert counts.
  let expiredCertCount = 0;
  let expiringSoonCertCount = 0;
  for (const g of groups) {
    for (const m of g.members) {
      for (const c of m.certs) {
        if (c.status === 'expired') expiredCertCount += 1;
        if (c.status === 'expiringSoon') expiringSoonCertCount += 1;
      }
    }
  }

  return {
    generatedAt,
    totalActive: active.length,
    totalInactive: inactive,
    expiredCertCount,
    expiringSoonCertCount,
    groups,
  };
}

// ---- Email + export helpers ---------------------------------------------

/** Plain-text rendering of the roster, suitable for an email body or a
 *  copy-paste into Outlook. Width is preserved with normal spaces — the
 *  printable HTML page is what gets actual table layout. */
export function renderCrewRosterText(
  roster: CrewRoster,
  options: { showTools?: boolean; showCerts?: boolean } = {},
): string {
  const showTools = options.showTools ?? true;
  const showCerts = options.showCerts ?? true;
  const lines: string[] = [];
  lines.push('YGE Crew Roster');
  lines.push(`Generated: ${roster.generatedAt}`);
  lines.push(
    `Active: ${roster.totalActive} \u2014 Inactive: ${roster.totalInactive}`,
  );
  if (roster.expiredCertCount > 0) {
    lines.push(`!!! ${roster.expiredCertCount} expired cert(s) on roster !!!`);
  }
  if (roster.expiringSoonCertCount > 0) {
    lines.push(
      `   ${roster.expiringSoonCertCount} cert(s) expiring within 30 days`,
    );
  }
  lines.push('');

  for (const g of roster.groups) {
    lines.push(`== ${g.label} ==`);
    for (const m of g.members) {
      const e = m.employee;
      const phone = e.phone ? ` \u2014 ${e.phone}` : '';
      lines.push(`  ${fullName(e)} (${e.role})${phone}`);
      if (showCerts && m.certs.length > 0) {
        for (const c of m.certs) {
          const stamp =
            c.status === 'expired'
              ? `EXPIRED ${c.cert.expiresOn ?? ''}`
              : c.status === 'expiringSoon'
                ? `expires ${c.cert.expiresOn ?? ''}`
                : c.status === 'lifetime'
                  ? 'lifetime'
                  : `expires ${c.cert.expiresOn ?? ''}`;
          lines.push(`     - ${c.cert.label} (${stamp})`);
        }
      }
      if (showTools && m.tools.length > 0) {
        for (const t of m.tools) {
          lines.push(`     * ${toolIdentifier(t)}`);
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
