import { normalizeHex } from './bytes.mjs';
import { AttestationError } from './errors.mjs';
import { IDENTITY_TYPE_COCO_IMAGE_INITDATA, parseIdentityHint } from './contracts.mjs';

function findStringByPath(value, path) {
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== 'object') {
      return null;
    }
    current = current[segment];
  }
  return typeof current === 'string' ? current : null;
}

function firstString(value, paths) {
  for (const path of paths) {
    const found = findStringByPath(value, path);
    if (typeof found === 'string' && found.length > 0) {
      return found;
    }
  }
  return null;
}

function parseHexString(value, fieldName) {
  const normalized = normalizeHex(value ?? '');
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length === 0) {
    throw new AttestationError('unsupported_coco_evidence', `${fieldName} is not a valid hex string`);
  }
  return normalized;
}

export async function verifyCocoEnvelope(envelope) {
  if (envelope.evidence.type !== 'coco_trustee_evidence') {
    throw new AttestationError('invalid_payload', 'CoCo envelope must use coco_trustee_evidence');
  }

  const payload = envelope.evidence.payload;
  const identityHint = parseIdentityHint(envelope.claims.identity_hint);
  const nonceHex = parseHexString(
    firstString(payload, [
      ['runtime_data'],
      ['report_data'],
      ['nonce'],
      ['claims', 'runtime_data'],
      ['claims', 'report_data'],
      ['evidence', 'runtime_data'],
      ['evidence', 'report_data'],
    ]),
    'coco runtime_data',
  );
  const measuredInitdataHash = parseHexString(
    firstString(payload, [
      ['init_data_hash'],
      ['initdata_hash'],
      ['host_data'],
      ['mr_config_id'],
      ['claims', 'init_data_hash'],
      ['claims', 'initdata_hash'],
      ['claims', 'host_data'],
      ['claims', 'mr_config_id'],
      ['evidence', 'init_data_hash'],
      ['evidence', 'initdata_hash'],
      ['evidence', 'host_data'],
      ['evidence', 'mr_config_id'],
    ]),
    'coco initdata hash',
  );

  if (measuredInitdataHash !== identityHint.initdata_hash) {
    throw new AttestationError('coco_identity_mismatch', 'CoCo measured initdata hash does not match identity hint');
  }

  return {
    nonceHex,
    identity: {
      type: IDENTITY_TYPE_COCO_IMAGE_INITDATA,
      value: identityHint,
    },
    workloadPubkey: envelope.claims.workload_pubkey,
  };
}
