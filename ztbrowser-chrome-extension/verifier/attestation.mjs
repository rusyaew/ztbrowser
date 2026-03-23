import { base64ToBytes, bytesToHex, normalizeHex, toByteString, toMap } from './bytes.mjs';
import { decodeCbor, encodeCborValue } from './cbor.mjs';
import { parseCertificate, findTrustedRoot, importEcPublicKey } from './certificates.mjs';
import { AttestationError } from './errors.mjs';

const COSE_ALG_ES384 = -35;

export async function verifyNitroAttestationDoc(attestationDocB64, trustedRoots) {
  const decoded = decodeAttestationDoc(attestationDocB64);
  const alg = decoded.protectedHeaders.get(1);
  if (alg !== COSE_ALG_ES384) {
    throw new AttestationError('unsupported_platform', `Unsupported COSE algorithm: ${String(alg)}`);
  }

  const certificateDer = toByteString(decoded.payload.get('certificate'), 'payload.certificate');
  const cabundleRaw = decoded.payload.get('cabundle');
  if (!Array.isArray(cabundleRaw)) {
    throw new AttestationError('invalid_doc', 'payload.cabundle is not an array');
  }

  const leafCert = await parseCertificate(certificateDer);
  const chainCerts = await Promise.all(
    cabundleRaw.map(async (entry, index) => parseCertificate(toByteString(entry, `payload.cabundle[${index}]`)))
  );

  const sigStructure = encodeCborValue([
    'Signature1',
    decoded.protectedHeaderBytes,
    new Uint8Array(0),
    decoded.payloadBytes
  ]);

  const coseKey = await importEcPublicKey(leafCert.spkiBytes, leafCert.namedCurve.name);
  const coseSignatureValid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-384' },
    coseKey,
    decoded.signatureBytes,
    sigStructure
  );

  if (!coseSignatureValid) {
    throw new AttestationError('invalid_signature', 'COSE signature validation failed');
  }

  const trustedRoot = await findTrustedRoot(leafCert, chainCerts, trustedRoots);
  const parsed = extractAttestationData(decoded.payload);

  return {
    nonceHex: parsed.nonceHex,
    pcrs: parsed.pcrs,
    moduleId: parsed.moduleId,
    timestamp: parsed.timestamp,
    rootFingerprint256: trustedRoot.fingerprint256
  };
}

function decodeAttestationDoc(attestationDocB64) {
  const coseBytes = base64ToBytes(attestationDocB64);
  if (coseBytes.length === 0) {
    throw new AttestationError('invalid_doc', 'Attestation document is empty');
  }

  const { value: cose } = decodeCbor(coseBytes);
  if (!Array.isArray(cose) || cose.length !== 4) {
    throw new AttestationError('invalid_doc', 'COSE_Sign1 structure is invalid');
  }

  const [protectedHeaderBytes, , payloadBytes, signatureBytes] = cose;
  if (!(protectedHeaderBytes instanceof Uint8Array)) {
    throw new AttestationError('invalid_doc', 'Protected header must be a byte string');
  }
  if (!(payloadBytes instanceof Uint8Array)) {
    throw new AttestationError('invalid_doc', 'Payload must be a byte string');
  }
  if (!(signatureBytes instanceof Uint8Array)) {
    throw new AttestationError('invalid_doc', 'Signature must be a byte string');
  }

  const { value: protectedHeaders } = decodeCbor(protectedHeaderBytes);
  const { value: payload } = decodeCbor(payloadBytes);

  return {
    protectedHeaderBytes,
    protectedHeaders: toMap(protectedHeaders, 'protected headers'),
    payloadBytes,
    signatureBytes,
    payload: toMap(payload, 'payload')
  };
}

function extractAttestationData(payload) {
  const pcrsMap = toMap(payload.get('pcrs'), 'payload.pcrs');

  const getPcr = (index) => {
    const value = pcrsMap.get(index);
    if (value == null) {
      return null;
    }

    return normalizeHex(bytesToHex(toByteString(value, `payload.pcrs[${index}]`)));
  };

  const pcr0 = getPcr(0);
  const pcr1 = getPcr(1);
  const pcr2 = getPcr(2);
  const pcr8 = getPcr(8);
  if (!pcr0 || !pcr1 || !pcr2) {
    throw new AttestationError('invalid_doc', 'Missing required PCR values (0/1/2)');
  }

  const nonceBytes = toByteString(payload.get('nonce'), 'payload.nonce');
  const moduleIdValue = payload.get('module_id');
  const timestampRaw = payload.get('timestamp');

  return {
    nonceHex: normalizeHex(bytesToHex(nonceBytes)),
    moduleId: typeof moduleIdValue === 'string' ? moduleIdValue : String(moduleIdValue ?? 'unknown'),
    timestamp: normalizeTimestamp(timestampRaw),
    pcrs: { pcr0, pcr1, pcr2, pcr8 }
  };
}

function normalizeTimestamp(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'bigint' && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }

  return null;
}
