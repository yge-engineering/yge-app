// Popup script. Three actions:
//   1. Refresh master profile from /api/master-profile + cache it
//      so the content script can read it without a round-trip
//   2. Scan the active tab via the content script
//   3. Apply the operator-approved matches
//
// Confidence < 0.6 fields render with the checkbox unchecked so
// the operator opts in deliberately.

import { fetchMasterProfile, getApiBase } from './api';
import type { FieldMatch } from './field-matcher';

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const status = $('status');
const matchesEl = $('matches');
const scanBtn = $<HTMLButtonElement>('scan');
const applyBtn = $<HTMLButtonElement>('apply');
const optionsBtn = $('options');

let currentMatches: FieldMatch[] = [];
let approval: Record<string, boolean> = {};

function setStatus(html: string) {
  status.innerHTML = html;
}

function renderMatches() {
  if (currentMatches.length === 0) {
    matchesEl.innerHTML = '<div class="empty">No matches found on this page yet. Click Scan.</div>';
    applyBtn.disabled = true;
    return;
  }
  matchesEl.innerHTML = currentMatches
    .map((m, i) => {
      const id = `m-${i}`;
      approval[id] = approval[id] ?? m.confidence >= 0.6;
      const checked = approval[id] ? 'checked' : '';
      return `<label class="match" for="${id}">
        <input type="checkbox" id="${id}" ${checked} data-idx="${i}" />
        <div class="label">${escapeHtml(m.label)} <span style="color:#666;font-weight:normal;">· ${(m.confidence * 100).toFixed(0)}%</span></div>
        <div class="value">${escapeHtml(m.proposedValue)}</div>
        <div class="reasons">${escapeHtml(m.reasons.join(' · '))}</div>
      </label>`;
    })
    .join('');
  matchesEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      approval[cb.id] = cb.checked;
      const anyChecked = Object.values(approval).some((v) => v);
      applyBtn.disabled = !anyChecked;
    });
  });
  applyBtn.disabled = !Object.values(approval).some((v) => v);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

scanBtn.addEventListener('click', async () => {
  setStatus('<div class="ok">Refreshing master profile…</div>');
  scanBtn.disabled = true;
  try {
    const profile = await fetchMasterProfile();
    if (!profile) {
      setStatus(`<div class="err">Could not load master profile from ${await getApiBase()}. Check the API URL in Settings.</div>`);
      return;
    }
    await chrome.storage.local.set({ ygeProfileCache: profile });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus('<div class="err">No active tab.</div>');
      return;
    }
    const response = (await chrome.tabs.sendMessage(tab.id, { type: 'yge:scan' })) as
      | { ok: true; matches: FieldMatch[] }
      | { ok: false; error: string };
    if (!response.ok) {
      setStatus(`<div class="err">${escapeHtml(response.error)}</div>`);
      return;
    }
    currentMatches = response.matches;
    approval = {};
    setStatus(
      `<div class="ok">Found ${currentMatches.length} possible field${currentMatches.length === 1 ? '' : 's'}. Untick anything you don't want filled, then click Apply.</div>`,
    );
    renderMatches();
  } catch (err) {
    setStatus(`<div class="err">${escapeHtml(err instanceof Error ? err.message : String(err))}</div>`);
  } finally {
    scanBtn.disabled = false;
  }
});

applyBtn.addEventListener('click', async () => {
  applyBtn.disabled = true;
  const approved = currentMatches.filter((_, i) => approval[`m-${i}`]);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus('<div class="err">No active tab.</div>');
      return;
    }
    const response = (await chrome.tabs.sendMessage(tab.id, {
      type: 'yge:apply',
      matches: approved,
    })) as { ok: true; applied: number; missed: number } | { ok: false; error: string };
    if (!response.ok) {
      setStatus(`<div class="err">${escapeHtml(response.error)}</div>`);
      return;
    }
    setStatus(
      `<div class="ok">Filled ${response.applied} field${response.applied === 1 ? '' : 's'}${response.missed > 0 ? ` (${response.missed} couldn't be reached after the page changed)` : ''}.</div>`,
    );
  } catch (err) {
    setStatus(`<div class="err">${escapeHtml(err instanceof Error ? err.message : String(err))}</div>`);
  }
});

optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

renderMatches();
