import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { verifyAttestationRequest } from '../../../ztbrowser-chrome-extension/verifier/attestationVerifier.mjs';

const validAttestationDoc = fs
  .readFileSync(path.resolve(process.cwd(), 'fixtures/attestation-doc-valid.base64'), 'utf8')
  .trim();

const validNonce =
  'bba6bfd51866d2e4e095ba3277f208a4692e62f76b98595bf13204bc5f36be7a13120a5de19a3b5fcebcca0722983901db66d35c419c2e70ea8c7aa48a56df715ae4a39ad5fe0e4d056b2d8b2eb756b69fd231f86e8e39a1607ea5d9ab8d078c5d27147fdc2b0b5404c281f79a45381ed6533c048f38e3765b5e9776d36c7452b9d6cdae09ecfdd088c74b680dcf3bb520d0ff926074e7b6fc2c0b6a5d0b07adeba14295b01bdf7a155d0ad08f40d958ee6a837a5655a7fff35a16f7fb7e40aadaf39399f08987941950c50847e0232cd4a1d3161071f54fdad3e1f5706f4140b28859c169c0fc2526993e9d94d4657644100cd32efd6e6671ab4ae4119c1f21';

function tamperBase64(base64Value) {
  const bytes = Buffer.from(base64Value, 'base64');
  bytes[bytes.length - 1] ^= 0xff;
  return bytes.toString('base64');
}

function buildNitroEnvelope(attestationDocB64, nonce = validNonce) {
  return {
    version: 'ztinfra-attestation/v1',
    service: 'ztinfra-enclaveproducedhtml',
    release_id: 'v0.1.3',
    platform: 'aws_nitro_eif',
    nonce,
    claims: {
      workload_pubkey: null,
      identity_hint: null
    },
    evidence: {
      type: 'aws_nitro_attestation_doc',
      payload: {
        nitro_attestation_doc_b64: attestationDocB64
      }
    }
  };
}

describe('verifyAttestationRequest', () => {
  it('accepts a valid AWS Nitro attestation document', async () => {
    const result = await verifyAttestationRequest({
      nonce_sent: validNonce.toUpperCase(),
      envelope: buildNitroEnvelope(validAttestationDoc)
    });

    expect(result).toEqual({
      ok: true,
      json: {
        workingEnv: true,
        codeValidated: true,
        reason: 'ok',
        verified: {
          service: 'ztinfra-enclaveproducedhtml',
          release_id: 'v0.1.3',
          platform: 'aws_nitro_eif',
          identity: {
            type: 'eif_pcr_set',
            value: {
              pcr0: '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
              pcr1: '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
              pcr2: '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
              pcr8: '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
            }
          },
          workload_pubkey: null,
          nonce_hex: validNonce,
          module_id: 'i-0918f6c55e3b61d89-enc018aa8b8e2285d13',
          timestamp: expect.any(Number),
          root_fingerprint256: '64:1A:03:21:A3:E2:44:EF:E4:56:46:31:95:D6:06:31:7E:D7:CD:CC:3C:17:56:E0:98:93:F3:C6:8F:79:BB:5B',
          pcrs: {
            pcr0: '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
            pcr1: '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
            pcr2: '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
            pcr8: '000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
          }
        }
      }
    });
  });

  it('keeps cryptographic validation true when the nonce mismatches', async () => {
    const result = await verifyAttestationRequest({
      nonce_sent: 'deadbeef',
      envelope: buildNitroEnvelope(validAttestationDoc)
    });

    expect(result.ok).toBe(true);
    expect(result.json.workingEnv).toBe(false);
    expect(result.json.codeValidated).toBe(true);
    expect(result.json.reason).toBe('nonce_mismatch');
  });

  it('rejects unsupported platforms before attempting verification', async () => {
    const result = await verifyAttestationRequest({
      nonce_sent: validNonce,
      envelope: {
        ...buildNitroEnvelope(validAttestationDoc),
        platform: 'not_nitro'
      }
    });

    expect(result).toEqual({
      ok: false,
      json: {
        workingEnv: false,
        codeValidated: false,
        reason: 'unsupported_platform'
      }
    });
  });

  it('rejects missing payload fields', async () => {
    const result = await verifyAttestationRequest({
      nonce_sent: validNonce,
      envelope: {
        ...buildNitroEnvelope(validAttestationDoc),
        evidence: {
          type: 'aws_nitro_attestation_doc',
          payload: {}
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.json.workingEnv).toBe(false);
    expect(result.json.codeValidated).toBe(false);
    expect(result.json.reason).toBe('invalid_payload');
  });

  it('returns invalid_signature for a tampered attestation document', async () => {
    const result = await verifyAttestationRequest({
      nonce_sent: validNonce,
      envelope: buildNitroEnvelope(tamperBase64(validAttestationDoc))
    });

    expect(result.ok).toBe(false);
    expect(result.json.workingEnv).toBe(false);
    expect(result.json.codeValidated).toBe(false);
    expect(result.json.reason).toBe('invalid_signature');
    expect(result.json.details).toEqual({
      message: 'COSE signature validation failed'
    });
  });

  it('accepts workload-specific CoCo evidence and normalizes image_digest + initdata_hash', async () => {
    const initdataHash = 'ab'.repeat(32);
    const result = await verifyAttestationRequest({
      nonce_sent: validNonce,
      envelope: {
        version: 'ztinfra-attestation/v1',
        service: 'ztinfra-enclaveproducedhtml',
        release_id: 'v0.1.3',
        platform: 'aws_coco_snp',
        nonce: validNonce,
        claims: {
          workload_pubkey: null,
          identity_hint: `coco_image_initdata:sha256:${'12'.repeat(32)}:${initdataHash}`
        },
        evidence: {
          type: 'coco_trustee_evidence',
          payload: {
            runtime_data: validNonce,
            init_data_hash: initdataHash
          }
        }
      }
    });

    expect(result).toEqual({
      ok: true,
      json: {
        workingEnv: true,
        codeValidated: true,
        reason: 'ok',
        verified: {
          service: 'ztinfra-enclaveproducedhtml',
          release_id: 'v0.1.3',
          platform: 'aws_coco_snp',
          identity: {
            type: 'coco_image_initdata',
            value: {
              image_digest: `sha256:${'12'.repeat(32)}`,
              initdata_hash: initdataHash
            }
          },
          workload_pubkey: null,
          nonce_hex: validNonce,
          module_id: null,
          timestamp: null,
          root_fingerprint256: null,
          pcrs: null
        }
      }
    });
  });

  it('rejects CoCo evidence without workload differentiation', async () => {
    const result = await verifyAttestationRequest({
      nonce_sent: validNonce,
      envelope: {
        version: 'ztinfra-attestation/v1',
        service: 'ztinfra-enclaveproducedhtml',
        release_id: 'v0.1.3',
        platform: 'aws_coco_snp',
        nonce: validNonce,
        claims: {
          workload_pubkey: null,
          identity_hint: null
        },
        evidence: {
          type: 'coco_trustee_evidence',
          payload: {
            runtime_data: validNonce,
            init_data_hash: 'ab'.repeat(32)
          }
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.json.reason).toBe('unsupported_coco_evidence');
  });
});
