import { describe, expect, it } from 'vitest';
import { buildCrewRoster, renderCrewRosterText } from './crew-roster';
import type { Employee } from './employee';
import type { Tool } from './tool';

const NOW = new Date('2026-04-25T12:00:00Z');

function emp(over: Partial<Employee>): Employee {
  return {
    id: over.id ?? 'emp-aaaaaaa1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    firstName: 'First',
    lastName: 'Last',
    role: 'LABORER',
    classification: 'NOT_APPLICABLE',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  };
}

function tool(over: Partial<Tool>): Tool {
  return {
    id: over.id ?? 'tool-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    name: 'Test Tool',
    category: 'OTHER',
    status: 'IN_YARD',
    ...over,
  };
}

describe('buildCrewRoster', () => {
  it('groups every employee under their foreman', () => {
    const foreman = emp({
      id: 'emp-fore0001',
      firstName: 'Mike',
      lastName: 'Foreman',
      role: 'FOREMAN',
    });
    const op = emp({
      id: 'emp-op000001',
      firstName: 'Joe',
      lastName: 'Operator',
      role: 'OPERATOR',
      foremanId: foreman.id,
    });
    const lab = emp({
      id: 'emp-lab00001',
      firstName: 'Sam',
      lastName: 'Smith',
      role: 'LABORER',
      foremanId: foreman.id,
    });

    const r = buildCrewRoster({ employees: [op, foreman, lab], tools: [], now: NOW });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.label).toContain('Mike Foreman');
    // Foreman is pinned at index 0
    expect(r.groups[0]!.members[0]!.employee.id).toBe(foreman.id);
    // Crew sorted alphabetically after the foreman
    expect(r.groups[0]!.members[1]!.employee.id).toBe(op.id);
    expect(r.groups[0]!.members[2]!.employee.id).toBe(lab.id);
  });

  it('puts unassigned employees in an Office staff bucket', () => {
    const ryan = emp({
      id: 'emp-ryan0001',
      firstName: 'Ryan',
      lastName: 'Young',
      role: 'OWNER',
    });
    const r = buildCrewRoster({ employees: [ryan], tools: [], now: NOW });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]!.label).toBe('Office staff');
  });

  it('skips terminated employees', () => {
    const term = emp({
      id: 'emp-term0001',
      role: 'LABORER',
      status: 'TERMINATED',
    });
    const r = buildCrewRoster({ employees: [term], tools: [], now: NOW });
    expect(r.totalActive).toBe(0);
    expect(r.totalInactive).toBe(1);
    expect(r.groups).toHaveLength(0);
  });

  it('attaches assigned tools to the right employee entry', () => {
    const op = emp({
      id: 'emp-op000002',
      firstName: 'Jane',
      lastName: 'Operator',
      role: 'OPERATOR',
    });
    const t1 = tool({
      id: 'tool-aaaaaaa1',
      name: 'Impact Driver',
      status: 'ASSIGNED',
      assignedToEmployeeId: op.id,
    });
    const t2 = tool({
      id: 'tool-aaaaaaa2',
      name: 'Drill',
      status: 'IN_YARD',
    });
    const r = buildCrewRoster({ employees: [op], tools: [t1, t2], now: NOW });
    const entry = r.groups[0]!.members[0]!;
    expect(entry.tools).toHaveLength(1);
    expect(entry.tools[0]!.id).toBe(t1.id);
  });

  it('flags expired and expiring-soon certs', () => {
    const op = emp({
      id: 'emp-op000003',
      firstName: 'Hank',
      lastName: 'Operator',
      role: 'OPERATOR',
      certifications: [
        // Already expired (2026-01-01 vs NOW = 2026-04-25)
        { kind: 'CDL_A', label: 'CDL Class A', expiresOn: '2026-01-01' },
        // Expires 2026-05-10 — within 30 days of NOW
        { kind: 'OSHA_30', label: 'OSHA 30', expiresOn: '2026-05-10' },
        // Far away — current
        { kind: 'FORKLIFT', label: 'Forklift', expiresOn: '2027-01-01' },
        // No expiry — lifetime cert
        { kind: 'OSHA_10', label: 'OSHA 10' },
      ],
    });
    const r = buildCrewRoster({ employees: [op], tools: [], now: NOW });
    const entry = r.groups[0]!.members[0]!;
    expect(entry.anyExpired).toBe(true);
    expect(entry.anyExpiringSoon).toBe(true);
    expect(r.expiredCertCount).toBe(1);
    expect(r.expiringSoonCertCount).toBe(1);
  });
});

describe('renderCrewRosterText', () => {
  it('produces a plain-text roster suitable for email body', () => {
    const foreman = emp({
      id: 'emp-fore0002',
      firstName: 'Mike',
      lastName: 'Foreman',
      role: 'FOREMAN',
      phone: '707-555-0100',
    });
    const op = emp({
      id: 'emp-op000004',
      firstName: 'Joe',
      lastName: 'Operator',
      role: 'OPERATOR',
      foremanId: foreman.id,
      phone: '707-555-0101',
    });
    const r = buildCrewRoster({ employees: [foreman, op], tools: [], now: NOW });
    const text = renderCrewRosterText(r);
    expect(text).toContain('YGE Crew Roster');
    expect(text).toContain("Mike Foreman's Crew");
    expect(text).toContain('Mike Foreman (FOREMAN)');
    expect(text).toContain('Joe Operator (OPERATOR)');
    expect(text).toContain('707-555-0101');
  });
});
