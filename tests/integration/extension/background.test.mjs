import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function importFreshBackground() {
  const absolutePath = path.resolve(process.cwd(), 'ztbrowser-chrome-extension/background.js');
  const fileUrl = pathToFileURL(absolutePath);
  fileUrl.searchParams.set('t', `${Date.now()}-${Math.random()}`);
  return import(fileUrl.href);
}

describe('background.js', () => {
  let addListener;
  let setIcon;
  let registeredListener;
  let fetchSpy;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock('../../../ztbrowser-chrome-extension/verifier/attestationVerifier.mjs');

    addListener = vi.fn((listener) => {
      registeredListener = listener;
    });
    setIcon = vi.fn();

    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener
        }
      },
      action: {
        setIcon
      }
    });

    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
  });

  it('registers a fetch_json handler that returns parsed response payload', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ hello: 'world' })
    });

    await importFreshBackground();

    const sendResponse = vi.fn();
    const returnValue = registeredListener(
      {
        type: 'fetch_json',
        url: 'https://example.test/api',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"ok":true}'
      },
      {},
      sendResponse
    );

    expect(addListener).toHaveBeenCalledTimes(1);
    expect(returnValue).toBe(true);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        result: {
          ok: true,
          status: 200,
          json: { hello: 'world' },
          text: '{"hello":"world"}'
        }
      });
    });

    expect(fetchSpy).toHaveBeenCalledWith('https://example.test/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"ok":true}'
    });
  });

  it('returns a structured error when fetch_json fails', async () => {
    fetchSpy.mockRejectedValue(new Error('network_down'));

    await importFreshBackground();

    const sendResponse = vi.fn();
    const returnValue = registeredListener(
      {
        type: 'fetch_json',
        url: 'https://example.test/api',
        method: 'POST'
      },
      {},
      sendResponse
    );

    expect(returnValue).toBe(true);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        error: 'fetch_failed:POST:https://example.test/api:network_down'
      });
    });
  });

  it('passes verify-attestation responses through to the caller', async () => {
    vi.doMock('../../../ztbrowser-chrome-extension/verifier/attestationVerifier.mjs', () => ({
      verifyAttestationRequest: vi.fn().mockResolvedValue({
        ok: true,
        json: {
          workingEnv: true,
          codeValidated: true,
          reason: 'ok'
        }
      })
    }));

    await importFreshBackground();

    const sendResponse = vi.fn();
    const payload = { platform: 'aws_nitro_eif', nonce_sent: 'abc', attestation_doc_b64: 'doc' };
    const returnValue = registeredListener({ type: 'verify-attestation', payload }, {}, sendResponse);

    expect(returnValue).toBe(true);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        json: {
          workingEnv: true,
          codeValidated: true,
          reason: 'ok'
        }
      });
    });
  });

  it('returns invalid_doc responses when verification fails', async () => {
    vi.doMock('../../../ztbrowser-chrome-extension/verifier/attestationVerifier.mjs', () => ({
      verifyAttestationRequest: vi.fn().mockRejectedValue(new Error('boom'))
    }));

    await importFreshBackground();

    const sendResponse = vi.fn();
    const returnValue = registeredListener(
      {
        type: 'verify-attestation',
        payload: { platform: 'aws_nitro_eif', nonce_sent: 'abc', attestation_doc_b64: 'doc' }
      },
      {},
      sendResponse
    );

    expect(returnValue).toBe(true);

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: false,
        json: expect.objectContaining({
          workingEnv: false,
          codeValidated: false,
          reason: 'invalid_doc',
          details: expect.objectContaining({
            message: expect.any(String)
          })
        })
      });
    });
  });

  it('updates the tab icon for locked and unlocked states', async () => {
    await importFreshBackground();

    expect(registeredListener({ locked: true }, { tab: { id: 7 } }, vi.fn())).toBeUndefined();
    expect(setIcon).toHaveBeenCalledWith({
      path: { 16: 'locked-16x16.png' },
      tabId: 7
    });

    registeredListener({ locked: false }, { tab: { id: 8 } }, vi.fn());
    expect(setIcon).toHaveBeenCalledWith({
      path: { 16: 'unlocked-16x16.png' },
      tabId: 8
    });
  });

  it('ignores icon updates when sender has no tab id', async () => {
    await importFreshBackground();

    expect(registeredListener({ locked: true }, {}, vi.fn())).toBeUndefined();
    expect(setIcon).not.toHaveBeenCalled();
  });
});
