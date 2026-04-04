/** @vitest-environment jsdom */

import cbor from 'cbor';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { verifyAttestationRequest } from '../../../ztbrowser-chrome-extension/verifier/attestationVerifier.mjs';

const rootCertPem = fs.readFileSync(path.resolve(process.cwd(), 'fixtures/demo-pki/root-cert.pem'), 'utf8');
const leafCertPem = fs.readFileSync(path.resolve(process.cwd(), 'fixtures/demo-pki/leaf-cert.pem'), 'utf8');
const leafKeyPem = fs.readFileSync(path.resolve(process.cwd(), 'fixtures/demo-pki/leaf-key.pem'), 'utf8');

function pemToDer(pem) {
  const stripped = pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '');
  return Buffer.from(stripped, 'base64');
}

function buildDemoAttestationDoc(nonceHex) {
  const payload = cbor.encodeCanonical(
    new Map([
      ['module_id', 'demo-module'],
      ['digest', 'SHA384'],
      ['timestamp', 1711280000000],
      [
        'pcrs',
        new Map([
          [0, Buffer.from('11'.repeat(48), 'hex')],
          [1, Buffer.from('22'.repeat(48), 'hex')],
          [2, Buffer.from('33'.repeat(48), 'hex')],
          [8, Buffer.from('44'.repeat(48), 'hex')]
        ])
      ],
      ['certificate', pemToDer(leafCertPem)],
      ['cabundle', [pemToDer(rootCertPem)]],
      ['public_key', null],
      ['user_data', null],
      ['nonce', Buffer.from(nonceHex, 'hex')]
    ])
  );

  const protectedHeader = cbor.encodeCanonical(new Map([[1, -35]]));
  const sigStructure = cbor.encodeCanonical(['Signature1', protectedHeader, Buffer.alloc(0), payload]);
  const signature = crypto.sign('sha384', sigStructure, {
    key: leafKeyPem,
    dsaEncoding: 'ieee-p1363'
  });

  return cbor.encodeCanonical([protectedHeader, new Map(), payload, signature]).toString('base64');
}

function buildNitroEnvelope(attestationDoc, nonceHex) {
  return {
    version: 'ztinfra-attestation/v1',
    service: 'ztinfra-enclaveproducedhtml',
    release_id: 'v0.1.3',
    platform: 'aws_nitro_eif',
    nonce: nonceHex,
    claims: {
      workload_pubkey: null,
      identity_hint: null
    },
    evidence: {
      type: 'aws_nitro_attestation_doc',
      payload: {
        nitro_attestation_doc_b64: attestationDoc
      }
    }
  };
}

async function importFreshModule(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const fileUrl = pathToFileURL(absolutePath);
  fileUrl.searchParams.set('t', `${Date.now()}-${Math.random()}`);
  return import(fileUrl.href);
}

describe('content.js', () => {
  let storageSet;
  let sendMessage;
  let intervalSpy;
  let randomValuesSpy;
  let logSpy;
  let errorSpy;
  let nonceBytes;

  beforeEach(() => {
    vi.resetModules();
    storageSet = vi.fn();
    sendMessage = vi.fn();
    intervalSpy = vi.fn();
    nonceBytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1);

    vi.stubGlobal('chrome', {
      storage: {
        local: {
          set: storageSet
        }
      },
      runtime: {
        lastError: null,
        sendMessage
      }
    });
    vi.stubGlobal('setInterval', intervalSpy);

    randomValuesSpy = vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((buffer) => {
      buffer.set(nonceBytes.subarray(0, buffer.length));
      return buffer;
    });
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    randomValuesSpy?.mockRestore();
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
  });

  it('stores a locked state after successful verification and facts lookup', async () => {
    const nonceHex = Buffer.from(nonceBytes).toString('hex');
    const attestationDoc = buildDemoAttestationDoc(nonceHex);

    sendMessage.mockImplementation((message, callback) => {
      if (message?.type === 'fetch_json' && message.url.endsWith('/.well-known/attestation')) {
        callback({
          ok: true,
          result: {
            ok: true,
            status: 200,
            json: buildNitroEnvelope(attestationDoc, nonceHex)
          }
        });
        return;
      }

      if (message?.type === 'verify-attestation') {
        verifyAttestationRequest(message.payload).then(callback);
        return;
      }

      if (message?.type === 'fetch_json' && message.url.includes('/api/v1/lookup-by-realization')) {
        callback({
          ok: true,
          result: {
            ok: true,
            status: 200,
            json: {
              matched: true,
              release: {
                service: 'ztinfra-enclaveproducedhtml',
                release_id: 'v0.1.3'
              },
              realization: {
                platform: 'aws_nitro_eif'
              },
              workload: {
                repo_url: 'https://github.com/example/demo-service',
                oci_image_digest: 'sha256:abc123'
              }
            }
          }
        });
        return;
      }

      callback?.({ ok: true });
    });

    await importFreshModule('ztbrowser-chrome-extension/content.js');

    await vi.waitFor(() => {
      expect(storageSet).toHaveBeenCalledTimes(1);
    });

    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
    expect(sendMessage).toHaveBeenCalledWith({ locked: true });
    expect(storageSet).toHaveBeenCalledWith(
      expect.objectContaining({
        workingEnv: true,
        codeValidated: true,
        reason: 'ok',
        verifiedPlatform: 'aws_nitro_eif',
        verifiedReleaseId: 'v0.1.3',
        verifiedService: 'ztinfra-enclaveproducedhtml',
        verifiedIdentity: {
          type: 'eif_pcr_set',
          value: {
            pcr0: '11'.repeat(48),
            pcr1: '22'.repeat(48),
            pcr2: '33'.repeat(48),
            pcr8: '44'.repeat(48)
          }
        },
        factsMatched: true,
        factsNode: 'https://facts-db.onrender.com',
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
        debugSteps: expect.arrayContaining([
          expect.objectContaining({ step: 'validate_start' }),
          expect.objectContaining({ step: 'fetch_attestation_ok' }),
          expect.objectContaining({ step: 'verify_ok' }),
          expect.objectContaining({ step: 'facts_lookup_done' })
        ])
      })
    );
  });

  it('keeps the lock closed even when facts lookup fails after successful verification', async () => {
    const nonceHex = Buffer.from(nonceBytes).toString('hex');
    const attestationDoc = buildDemoAttestationDoc(nonceHex);

    sendMessage.mockImplementation((message, callback) => {
      if (message?.type === 'fetch_json' && message.url.endsWith('/.well-known/attestation')) {
        callback({
          ok: true,
          result: {
            ok: true,
            status: 200,
            json: buildNitroEnvelope(attestationDoc, nonceHex)
          }
        });
        return;
      }

      if (message?.type === 'verify-attestation') {
        verifyAttestationRequest(message.payload).then(callback);
        return;
      }

      if (message?.type === 'fetch_json' && message.url.includes('/api/v1/lookup-by-realization')) {
        callback({
          ok: false,
          error: 'facts_unavailable'
        });
        return;
      }

      callback?.({ ok: true });
    });

    await importFreshModule('ztbrowser-chrome-extension/content.js');

    await vi.waitFor(() => {
      expect(storageSet).toHaveBeenCalledTimes(1);
    });

    expect(sendMessage).toHaveBeenCalledWith({ locked: true });
    expect(storageSet).toHaveBeenCalledWith(
      expect.objectContaining({
        workingEnv: true,
        codeValidated: true,
        factsMatched: false,
        factsNode: null,
        workload: null,
        debugSteps: expect.arrayContaining([
          expect.objectContaining({ step: 'facts_lookup_done', matched: false, node: null })
        ])
      })
    );
  });

  it('stores an error state when attestation payload is structurally invalid', async () => {
    sendMessage.mockImplementation((message, callback) => {
      if (message?.type === 'fetch_json' && message.url.endsWith('/.well-known/attestation')) {
        callback({
          ok: true,
          result: {
            ok: true,
            status: 200,
            json: {
              version: 'ztinfra-attestation/v1',
              service: 'ztinfra-enclaveproducedhtml',
              release_id: 'v0.1.3',
              platform: 'aws_nitro_eif',
              nonce: '00',
              claims: {},
              evidence: {}
            }
          }
        });
        return;
      }

      callback?.({ ok: true });
    });

    await importFreshModule('ztbrowser-chrome-extension/content.js');

    await vi.waitFor(() => {
      expect(storageSet).toHaveBeenCalledTimes(1);
    });

    expect(sendMessage).toHaveBeenCalledWith({ locked: false });
    expect(storageSet).toHaveBeenCalledWith(
      expect.objectContaining({
        workingEnv: false,
        codeValidated: false,
        reason: 'invalid_attestation_payload',
        verifiedPcrs: null,
        factsMatched: false,
        factsNode: null,
        workload: null,
        debugSteps: expect.arrayContaining([
          expect.objectContaining({ step: 'fetch_attestation_invalid_payload' }),
          expect.objectContaining({ step: 'validate_error', message: 'invalid_attestation_payload' })
        ])
      })
    );
  });

  it('skips facts lookup when verification succeeds without PCR data', async () => {
    sendMessage.mockImplementation((message, callback) => {
      if (message?.type === 'fetch_json' && message.url.endsWith('/.well-known/attestation')) {
        callback({
          ok: true,
          result: {
            ok: true,
            status: 200,
            json: buildNitroEnvelope('unused', Buffer.from(nonceBytes).toString('hex'))
          }
        });
        return;
      }

      if (message?.type === 'verify-attestation') {
        callback({
          ok: true,
          json: {
            workingEnv: true,
            codeValidated: true,
            reason: 'ok'
          }
        });
        return;
      }

      callback?.({ ok: true });
    });

    await importFreshModule('ztbrowser-chrome-extension/content.js');

    await vi.waitFor(() => {
      expect(storageSet).toHaveBeenCalledTimes(1);
    });

    expect(sendMessage).toHaveBeenCalledWith({ locked: true });
    expect(storageSet).toHaveBeenCalledWith(
      expect.objectContaining({
        workingEnv: true,
        codeValidated: true,
        reason: 'ok',
        verifiedPcrs: null,
        factsMatched: false,
        factsNode: null,
        workload: null,
        debugSteps: expect.arrayContaining([
          expect.objectContaining({ step: 'facts_lookup_skipped', reason: 'missing_verified_identity' })
        ])
      })
    );
  });

  it('stores an error state when runtime messaging fails before attestation fetch completes', async () => {
    sendMessage.mockImplementation((_message, callback) => {
      if (typeof callback !== 'function') {
        return;
      }
      globalThis.chrome.runtime.lastError = { message: 'background_unavailable' };
      callback(undefined);
      globalThis.chrome.runtime.lastError = null;
    });

    await importFreshModule('ztbrowser-chrome-extension/content.js');

    await vi.waitFor(() => {
      expect(storageSet).toHaveBeenCalledTimes(1);
    });

    expect(sendMessage).toHaveBeenCalledWith({ locked: false });
    expect(storageSet).toHaveBeenCalledWith(
      expect.objectContaining({
        workingEnv: false,
        codeValidated: false,
        reason: 'background_unavailable',
        verifiedPcrs: null,
        factsMatched: false,
        factsNode: null,
        workload: null,
        debugSteps: expect.arrayContaining([
          expect.objectContaining({ step: 'validate_error', message: 'background_unavailable' })
        ])
      })
    );
  });
});
