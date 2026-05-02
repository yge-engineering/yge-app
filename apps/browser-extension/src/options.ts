// Options page — set the YGE API base URL.

import { fetchMasterProfile, getApiBase, setApiBase } from './api';

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const apiBase = $<HTMLInputElement>('apiBase');
const saveBtn = $<HTMLButtonElement>('save');
const testBtn = $<HTMLButtonElement>('test');
const status = $('status');

void getApiBase().then((v) => {
  apiBase.value = v;
});

saveBtn.addEventListener('click', async () => {
  const v = apiBase.value.trim();
  try {
    new URL(v); // validate
  } catch {
    status.innerHTML = '<div class="err">Not a valid URL.</div>';
    return;
  }
  await setApiBase(v);
  status.innerHTML = `<div class="ok">Saved. Using <code>${v}</code>.</div>`;
});

testBtn.addEventListener('click', async () => {
  status.innerHTML = '<div class="ok">Testing…</div>';
  await setApiBase(apiBase.value.trim());
  const profile = await fetchMasterProfile();
  if (profile) {
    status.innerHTML = `<div class="ok">✓ Connected. Loaded master profile for <strong>${profile.legalName}</strong>.</div>`;
  } else {
    status.innerHTML = '<div class="err">Could not load /api/master-profile. Check the URL and that the API is running.</div>';
  }
});
