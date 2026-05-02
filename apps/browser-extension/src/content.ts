// Content script — runs in the page context. Listens for messages
// from the popup ('scan' / 'apply') and reports back match plans /
// apply counts.
//
// The matcher pulls the master profile through chrome.storage.local
// (cached by the popup before it asks us to scan) so we don't burn
// an HTTP round-trip per scan.

import { applyMatches, findMatches, type FieldMatch } from './field-matcher';
import type { MasterProfile } from '@yge/shared';

interface ScanMessage {
  type: 'yge:scan';
}
interface ApplyMessage {
  type: 'yge:apply';
  matches: FieldMatch[];
}
type IncomingMessage = ScanMessage | ApplyMessage;

chrome.runtime.onMessage.addListener((message: IncomingMessage, _sender, sendResponse) => {
  (async () => {
    if (message.type === 'yge:scan') {
      const { ygeProfileCache } = await chrome.storage.local.get('ygeProfileCache');
      if (!ygeProfileCache) {
        sendResponse({ ok: false, error: 'no master profile cached — open the popup first' });
        return;
      }
      const matches = findMatches(ygeProfileCache as MasterProfile);
      sendResponse({ ok: true, matches });
      return;
    }
    if (message.type === 'yge:apply') {
      const result = applyMatches(message.matches);
      sendResponse({ ok: true, ...result });
      return;
    }
    sendResponse({ ok: false, error: `unknown message: ${(message as { type?: string }).type}` });
  })();
  return true; // keep the channel open for the async sendResponse
});
