import cbor from 'cbor';
import crypto from 'node:crypto';

export type PcrSet = {
  pcr0: string;
  pcr1: string;
  pcr2: string;
  pcr8: string | null;
};

export type VerifiedAttestation = {
  nonceHex: string;
  pcrs: PcrSet;
  moduleId: string;
  timestamp: number | null;
  rootFingerprint256: string;
};

type DecodedDoc = {
  protectedHeaderBuffer: Buffer;
  protectedHeaders: Map<number, unknown>;
  payloadBuffer: Buffer;
  signature: Buffer;
  payload: Map<string, unknown>;
};

export class AttestationError extends Error {
  reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.reason = reason;
  }
}

export const DEFAULT_TRUSTED_ROOT_FINGERPRINTS = [
  // AWS Nitro Enclaves root cert SHA-256 fingerprint.
  '64:1A:03:21:A3:E2:44:EF:E4:56:46:31:95:D6:06:31:7E:D7:CD:CC:3C:17:56:E0:98:93:F3:C6:8F:79:BB:5B'
];

function toPemFromDer(der: Buffer): string {
  const body = der.toString('base64').match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
}

function normalizeHex(value: string): string {
  return value.replace(/^0x/i, '').toLowerCase();
}

function toBuffer(value: unknown, fieldName: string): Buffer {
  if (!Buffer.isBuffer(value)) {
    throw new AttestationError('invalid_doc', `${fieldName} is not a byte string`);
  }
  return value;
}

function toMap(value: unknown, fieldName: string): Map<unknown, unknown> {
  if (!(value instanceof Map)) {
    throw new AttestationError('invalid_doc', `${fieldName} is not a CBOR map`);
  }
  return value;
}

function findTrustedRoot(
  leaf: crypto.X509Certificate,
  others: crypto.X509Certificate[],
  trustedFingerprints: string[]
): crypto.X509Certificate {
  const pool = [leaf, ...others];
  let current = leaf;
  const used = new Set<number>([0]);

  for (let i = 0; i < pool.length; i += 1) {
    if (current.subject === current.issuer) {
      break;
    }

    const parentIndex = pool.findIndex((candidate, idx) => {
      if (used.has(idx)) {
        return false;
      }
      return candidate.subject === current.issuer && current.verify(candidate.publicKey);
    });

    if (parentIndex === -1) {
      throw new AttestationError('invalid_chain', 'Could not build certificate chain');
    }

    used.add(parentIndex);
    current = pool[parentIndex];
  }

  if (!current.verify(current.publicKey)) {
    throw new AttestationError('invalid_chain', 'Root certificate is not self-signed');
  }

  const normalizedTrusted = new Set(trustedFingerprints.map((value) => value.toUpperCase()));
  if (!normalizedTrusted.has(current.fingerprint256.toUpperCase())) {
    throw new AttestationError('invalid_chain', 'Certificate chain root is not trusted');
  }

  return current;
}

function decodeDoc(attestationDocB64: string): DecodedDoc {
  let coseBuffer: Buffer;
  try {
    coseBuffer = Buffer.from(attestationDocB64, 'base64');
  } catch {
    throw new AttestationError('invalid_doc', 'Attestation document is not valid base64');
  }

  if (coseBuffer.length === 0) {
    throw new AttestationError('invalid_doc', 'Attestation document is empty');
  }

  let cose: unknown;
  try {
    cose = cbor.decodeFirstSync(coseBuffer, { preferMap: true });
  } catch {
    throw new AttestationError('invalid_doc', 'Attestation document is not valid COSE');
  }

  if (!Array.isArray(cose) || cose.length !== 4) {
    throw new AttestationError('invalid_doc', 'COSE_Sign1 structure is invalid');
  }

  const [protectedHeaderBuffer, , payloadBuffer, signature] = cose;
  if (!Buffer.isBuffer(protectedHeaderBuffer) || !Buffer.isBuffer(payloadBuffer) || !Buffer.isBuffer(signature)) {
    throw new AttestationError('invalid_doc', 'COSE fields must be byte strings');
  }

  const protectedHeaders = toMap(
    cbor.decodeFirstSync(protectedHeaderBuffer, { preferMap: true }),
    'protected headers'
  ) as Map<number, unknown>;

  const payload = toMap(cbor.decodeFirstSync(payloadBuffer, { preferMap: true }), 'payload') as Map<string, unknown>;

  return { protectedHeaderBuffer, protectedHeaders, payloadBuffer, signature, payload };
}

export function extractAttestationData(attestationDocB64: string): {
  nonceHex: string;
  moduleId: string;
  timestamp: number | null;
  pcrs: PcrSet;
} {
  const decoded = decodeDoc(attestationDocB64);
  const payload = decoded.payload;
  const pcrsMap = toMap(payload.get('pcrs'), 'payload.pcrs') as Map<number, unknown>;

  const getPcr = (index: number): string | null => {
    const value = pcrsMap.get(index);
    if (value == null) {
      return null;
    }
    return normalizeHex(toBuffer(value, `payload.pcrs[${index}]`).toString('hex'));
  };

  const pcr0 = getPcr(0);
  const pcr1 = getPcr(1);
  const pcr2 = getPcr(2);
  const pcr8 = getPcr(8);
  if (!pcr0 || !pcr1 || !pcr2) {
    throw new AttestationError('invalid_doc', 'Missing required PCR values (0/1/2)');
  }

  const nonceBuffer = toBuffer(payload.get('nonce'), 'payload.nonce');
  const moduleId = String(payload.get('module_id') ?? 'unknown');
  const timestampRaw = payload.get('timestamp');
  const timestamp = typeof timestampRaw === 'number' ? timestampRaw : null;

  return {
    nonceHex: normalizeHex(nonceBuffer.toString('hex')),
    moduleId,
    timestamp,
    pcrs: { pcr0, pcr1, pcr2, pcr8 }
  };
}

export function verifyNitroAttestationDoc(
  attestationDocB64: string,
  trustedRootFingerprints: string[] = DEFAULT_TRUSTED_ROOT_FINGERPRINTS
): VerifiedAttestation {
  const decoded = decodeDoc(attestationDocB64);
  const alg = decoded.protectedHeaders.get(1);
  if (alg !== -35) {
    throw new AttestationError('unsupported_platform', `Unsupported COSE algorithm: ${String(alg)}`);
  }

  const certificateDer = toBuffer(decoded.payload.get('certificate'), 'payload.certificate');
  const cabundleRaw = decoded.payload.get('cabundle');
  if (!Array.isArray(cabundleRaw)) {
    throw new AttestationError('invalid_doc', 'payload.cabundle is not an array');
  }

  const leafCert = new crypto.X509Certificate(toPemFromDer(certificateDer));
  const chainCerts = cabundleRaw.map((entry, index) => {
    return new crypto.X509Certificate(toPemFromDer(toBuffer(entry, `payload.cabundle[${index}]`)));
  });

  const sigStructure = cbor.encodeCanonical([
    'Signature1',
    decoded.protectedHeaderBuffer,
    Buffer.alloc(0),
    decoded.payloadBuffer
  ]);

  const signatureValid = crypto.verify(
    'sha384',
    sigStructure,
    { key: leafCert.publicKey, dsaEncoding: 'ieee-p1363' },
    decoded.signature
  );

  if (!signatureValid) {
    throw new AttestationError('invalid_signature', 'COSE signature validation failed');
  }

  const trustedRoot = findTrustedRoot(leafCert, chainCerts, trustedRootFingerprints);
  const parsed = extractAttestationData(attestationDocB64);

  return {
    nonceHex: parsed.nonceHex,
    pcrs: parsed.pcrs,
    moduleId: parsed.moduleId,
    timestamp: parsed.timestamp,
    rootFingerprint256: trustedRoot.fingerprint256
  };
}
