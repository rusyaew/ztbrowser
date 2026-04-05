import { AttestationError } from './errors.mjs';
import { normalizeHex } from './bytes.mjs';

export const COMMON_ENVELOPE_VERSION = 'ztinfra-attestation/v1';
export const PLATFORM_AWS_NITRO_EIF = 'aws_nitro_eif';
export const PLATFORM_AWS_COCO_SNP = 'aws_coco_snp';
export const IDENTITY_TYPE_EIF_PCR_SET = 'eif_pcr_set';
export const IDENTITY_TYPE_COCO_IMAGE_INITDATA = 'coco_image_initdata';

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function ensurePlainObject(value, fieldName) {
  if (!isPlainObject(value)) {
    throw new AttestationError('invalid_payload', `${fieldName} must be an object`);
  }
  return value;
}

export function normalizeEnvelope(envelope) {
  const object = ensurePlainObject(envelope, 'envelope');
  if (typeof object.version !== 'string') {
    if (object.platform === PLATFORM_AWS_NITRO_EIF && typeof object?.evidence?.nitro_attestation_doc_b64 === 'string') {
      return {
        version: COMMON_ENVELOPE_VERSION,
        service: typeof object?.workload?.repo_url === 'string' ? object.workload.repo_url.split('/').at(-1) : 'unknown-service',
        release_id: typeof object?.workload?.release_tag === 'string' ? object.workload.release_tag : 'unknown-release',
        platform: PLATFORM_AWS_NITRO_EIF,
        nonce: typeof object.nonce === 'string' ? normalizeHex(object.nonce) : '',
        claims: {
          workload_pubkey: null,
          identity_hint: null,
        },
        evidence: {
          type: 'aws_nitro_attestation_doc',
          payload: {
            nitro_attestation_doc_b64: object.evidence.nitro_attestation_doc_b64,
          },
        },
        facts_url: typeof object.facts_url === 'string' ? object.facts_url : null,
      };
    }
    throw new AttestationError('invalid_payload', 'envelope.version is required');
  }
  if (object.version !== COMMON_ENVELOPE_VERSION) {
    throw new AttestationError('unsupported_platform', `Unsupported attestation envelope version: ${String(object.version)}`);
  }
  if (typeof object.service !== 'string' || typeof object.release_id !== 'string' || typeof object.platform !== 'string') {
    throw new AttestationError('invalid_payload', 'envelope service/release_id/platform must be strings');
  }
  if (typeof object.nonce !== 'string') {
    throw new AttestationError('invalid_payload', 'envelope.nonce must be a string');
  }

  const claims = isPlainObject(object.claims) ? object.claims : {};
  const evidence = ensurePlainObject(object.evidence, 'envelope.evidence');
  if (typeof evidence.type !== 'string' || !isPlainObject(evidence.payload)) {
    throw new AttestationError('invalid_payload', 'envelope.evidence must contain type and payload');
  }

  return {
    version: object.version,
    service: object.service,
    release_id: object.release_id,
    platform: object.platform,
    nonce: normalizeHex(object.nonce),
    claims: {
      workload_pubkey: typeof claims.workload_pubkey === 'string' ? claims.workload_pubkey : null,
      identity_hint: typeof claims.identity_hint === 'string' ? claims.identity_hint : null,
    },
    evidence: {
      type: evidence.type,
      payload: evidence.payload,
    },
    facts_url: typeof object.facts_url === 'string' ? object.facts_url : null,
  };
}

export function parseIdentityHint(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AttestationError('unsupported_coco_evidence', 'Missing identity_hint for CoCo evidence');
  }
  const prefix = `${IDENTITY_TYPE_COCO_IMAGE_INITDATA}:`;
  if (!value.startsWith(prefix)) {
    throw new AttestationError('unsupported_coco_evidence', 'identity_hint must use coco_image_initdata:<image_digest>:<initdata_hash>');
  }
  const body = value.slice(prefix.length);
  const separatorIndex = body.lastIndexOf(':');
  if (separatorIndex === -1) {
    throw new AttestationError('unsupported_coco_evidence', 'identity_hint must use coco_image_initdata:<image_digest>:<initdata_hash>');
  }
  const imageDigest = body.slice(0, separatorIndex);
  const initdataHash = normalizeHex(body.slice(separatorIndex + 1));
  if (!/^sha256:[0-9a-f]{64}$/.test(imageDigest) || !/^[0-9a-f]{64}$/.test(initdataHash)) {
    throw new AttestationError('unsupported_coco_evidence', 'identity_hint is not in the expected CoCo format');
  }
  return { image_digest: imageDigest, initdata_hash: initdataHash };
}
