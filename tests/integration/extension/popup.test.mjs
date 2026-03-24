/** @vitest-environment jsdom */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function importFreshModule(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const fileUrl = pathToFileURL(absolutePath);
  fileUrl.searchParams.set('t', `${Date.now()}-${Math.random()}`);
  return import(fileUrl.href);
}

function renderPopupDom() {
  document.body.innerHTML = `
    <div id="status"></div>
    <div id="reason"></div>
    <div id="facts"></div>
    <div id="repo"></div>
    <div id="digest"></div>
    <div id="pcrs"></div>
    <pre id="debug"></pre>
  `;
}

describe('popup.js', () => {
  let storageGet;

  beforeEach(() => {
    vi.resetModules();
    renderPopupDom();
    storageGet = vi.fn();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: storageGet
        }
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('renders locked state, workload metadata, PCRs and debug trace', async () => {
    storageGet.mockImplementation((_keys, callback) => {
      callback({
        workingEnv: true,
        codeValidated: true,
        reason: 'ok',
        factsMatched: true,
        workload: {
          repo_url: 'https://github.com/example/demo-service',
          oci_image_digest: 'sha256:abc123'
        },
        verifiedPcrs: {
          pcr0: '11'.repeat(48),
          pcr1: '22'.repeat(48),
          pcr2: '33'.repeat(48),
          pcr8: '44'.repeat(48)
        },
        debugSteps: [
          { step: 'validate_start' },
          { step: 'verify_ok', reason: 'ok' }
        ]
      });
    });

    await importFreshModule('ztbrowser-chrome-extension/popup.js');

    expect(document.getElementById('status')?.textContent).toBe('Status: locked (env=true, code=true)');
    expect(document.getElementById('status')?.className).toBe('row ok');
    expect(document.getElementById('reason')?.textContent).toBe('Reason: ok');
    expect(document.getElementById('facts')?.textContent).toBe('Facts match: yes');
    expect(document.getElementById('repo')?.textContent).toBe('repo: https://github.com/example/demo-service');
    expect(document.getElementById('digest')?.textContent).toBe('image: sha256:abc123');
    expect(document.getElementById('pcrs')?.textContent).toContain('PCR0=111111111111...111111111111');
    expect(document.getElementById('debug')?.textContent).toContain('"step":"verify_ok"');
  });

  it('renders unlocked fallback values when storage is mostly empty', async () => {
    storageGet.mockImplementation((_keys, callback) => {
      callback({
        workingEnv: false,
        codeValidated: false,
        factsMatched: false
      });
    });

    await importFreshModule('ztbrowser-chrome-extension/popup.js');

    expect(document.getElementById('status')?.textContent).toBe('Status: unlocked (env=false, code=false)');
    expect(document.getElementById('status')?.className).toBe('row bad');
    expect(document.getElementById('reason')?.textContent).toBe('Reason: n/a');
    expect(document.getElementById('facts')?.textContent).toBe('Facts match: no');
    expect(document.getElementById('repo')?.textContent).toBe('');
    expect(document.getElementById('digest')?.textContent).toBe('');
    expect(document.getElementById('pcrs')?.textContent).toBe('');
    expect(document.getElementById('debug')?.textContent).toBe('Debug: n/a');
  });
});
