// Unit tests for the Plans-to-Estimate service.
// Uses an injected fake Anthropic client so no network calls happen.

import { describe, it, expect, vi } from 'vitest';
import { runPlansToEstimate, PlansToEstimateError } from './plans-to-estimate';

function fakeClient(toolInput: unknown, opts: { stopReason?: string } = {}) {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'tool_test', name: 'submit_draft_estimate', input: toolInput },
        ],
        model: 'claude-sonnet-4-6',
        stop_reason: opts.stopReason ?? 'tool_use',
        usage: { input_tokens: 1234, output_tokens: 567 },
      }),
    },
  };
}

const validOutput = {
  projectName: 'Soquol Road Site Improvement',
  projectType: 'ROAD_RECONSTRUCTION',
  location: 'Shasta County, CA',
  ownerAgency: 'CAL FIRE',
  bidDueDate: '2026-04-30',
  bidItems: [
    {
      itemNumber: '1',
      description: 'Mobilization',
      unit: 'LS',
      quantity: 1,
      confidence: 'HIGH',
      pageReference: 'p. 12',
    },
    {
      itemNumber: '2',
      description: 'Aggregate base, Class 2',
      unit: 'TON',
      quantity: 850,
      confidence: 'MEDIUM',
      notes: 'Quantity derived from typical section x road length.',
      pageReference: 'sheet C-3',
    },
  ],
  assumptions: ['Outside trucking treated as direct cost (YGE convention).'],
  questionsForEstimator: ['Are CAL FIRE prevailing wage classifications confirmed?'],
  overallConfidence: 'MEDIUM',
};

describe('runPlansToEstimate', () => {
  it('returns parsed output and usage when the model emits valid tool input', async () => {
    const client = fakeClient(validOutput);
    const result = await runPlansToEstimate({
      documentText: 'Mock RFP body covering Sulphur Springs Soquol Road improvements.',
      client: client as never,
    });

    expect(result.output.projectName).toBe('Soquol Road Site Improvement');
    expect(result.output.bidItems).toHaveLength(2);
    expect(result.output.bidItems[1].quantity).toBe(850);
    expect(result.usage).toEqual({ inputTokens: 1234, outputTokens: 567 });
    expect(client.messages.create).toHaveBeenCalledTimes(1);

    const callArg = client.messages.create.mock.calls[0][0];
    expect(callArg.tools[0].name).toBe('submit_draft_estimate');
    expect(callArg.tool_choice).toEqual({ type: 'tool', name: 'submit_draft_estimate' });
    expect(callArg.system).toContain('Young General Engineering');
  });

  it('forwards estimator session notes into the user message', async () => {
    const client = fakeClient(validOutput);
    await runPlansToEstimate({
      documentText: 'Doc body',
      sessionNotes: 'Mandatory site walk Tuesday 4/28; mandatory pre-bid Friday 4/24.',
      client: client as never,
    });

    const userMsg = client.messages.create.mock.calls[0][0].messages[0].content;
    expect(userMsg).toContain('ESTIMATOR NOTES');
    expect(userMsg).toContain('Mandatory site walk Tuesday');
  });

  it('throws when documentText is empty', async () => {
    await expect(runPlansToEstimate({ documentText: '   ' })).rejects.toBeInstanceOf(
      PlansToEstimateError,
    );
  });

  it('throws when the model does not use the tool', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Refusing to call the tool' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      },
    };
    await expect(
      runPlansToEstimate({ documentText: 'doc', client: client as never }),
    ).rejects.toThrow(/did not call submit_draft_estimate/);
  });

  it('throws when the tool input fails Zod validation', async () => {
    const broken = { ...validOutput, bidItems: [] };
    const client = fakeClient(broken);
    await expect(
      runPlansToEstimate({ documentText: 'doc', client: client as never }),
    ).rejects.toThrow(/failed validation/);
  });
});
