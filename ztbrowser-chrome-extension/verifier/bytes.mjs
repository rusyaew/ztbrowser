import { AttestationError } from './errors.mjs';

export function toByteString(value, fieldName) {
  if (!(value instanceof Uint8Array)) {
    throw new AttestationError('invalid_doc', `${fieldName} is not a byte string`);
  }

  return value;
}

export function toMap(value, fieldName) {
  if (!(value instanceof Map)) {
    throw new AttestationError('invalid_doc', `${fieldName} is not a CBOR map`);
  }

  return value;
}

export function normalizeHex(value) {
  return value.replace(/^0x/i, '').toLowerCase();
}

export function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Fingerprint(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

export function bytesEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export function concatBytes(...parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function base64ToBytes(value) {
  const clean = value.trim();
  if (clean.length === 0) {
    return new Uint8Array(0);
  }

  try {
    if (typeof atob === 'function') {
      const binary = atob(clean);
      const output = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        output[index] = binary.charCodeAt(index);
      }
      return output;
    }

    if (typeof Buffer !== 'undefined') {
      return Uint8Array.from(Buffer.from(clean, 'base64'));
    }
  } catch {
    throw new AttestationError('invalid_doc', 'Attestation document is not valid base64');
  }

  throw new AttestationError('invalid_doc', 'Base64 decoding is unavailable in this runtime');
}

export function pemToDer(pem) {
  const base64 = pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '');
  return base64ToBytes(base64);
}
