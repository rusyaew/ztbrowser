import { ACTIVE_TRUSTED_ROOT_IDS, TRUSTED_ROOT_CERTIFICATES } from './trustedRoots.mjs';

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();
const COSE_ALG_ES384 = -35;

const ECDSA_SIGNATURE_OIDS = {
  '1.2.840.10045.4.3.2': { hash: 'SHA-256' },
  '1.2.840.10045.4.3.3': { hash: 'SHA-384' },
  '1.2.840.10045.4.3.4': { hash: 'SHA-512' }
};

const NAMED_CURVE_OIDS = {
  '1.2.840.10045.3.1.7': { name: 'P-256', coordinateLength: 32 },
  '1.3.132.0.34': { name: 'P-384', coordinateLength: 48 },
  '1.3.132.0.35': { name: 'P-521', coordinateLength: 66 }
};

let trustedRootsPromise = null;

export class AttestationError extends Error {
  constructor(reason, message) {
    super(message);
    this.reason = reason;
  }
}

export async function verifyAttestationRequest(body) {
  if (body?.platform !== 'aws_nitro_eif') {
    return {
      ok: false,
      json: {
        workingEnv: false,
        codeValidated: false,
        reason: 'unsupported_platform'
      }
    };
  }

  if (typeof body?.nonce_sent !== 'string' || typeof body?.attestation_doc_b64 !== 'string') {
    return {
      ok: false,
      json: {
        workingEnv: false,
        codeValidated: false,
        reason: 'invalid_payload'
      }
    };
  }

  try {
    const trustedRoots = await getTrustedRoots();
    const verified = await verifyNitroAttestationDoc(body.attestation_doc_b64, trustedRoots);
    const nonceSent = normalizeHex(body.nonce_sent.trim());
    const nonceMatches = nonceSent.length > 0 && nonceSent === verified.nonceHex;

    return {
      ok: true,
      json: {
        workingEnv: nonceMatches,
        codeValidated: true,
        reason: nonceMatches ? 'ok' : 'nonce_mismatch',
        verified: {
          nonce_hex: verified.nonceHex,
          module_id: verified.moduleId,
          timestamp: verified.timestamp,
          root_fingerprint256: verified.rootFingerprint256,
          pcrs: verified.pcrs
        }
      }
    };
  } catch (error) {
    const reason = error instanceof AttestationError ? error.reason : 'invalid_doc';
    const message = error instanceof Error ? error.message : 'Unknown error';

    return {
      ok: false,
      json: {
        workingEnv: false,
        codeValidated: false,
        reason,
        details: { message }
      }
    };
  }
}

async function getTrustedRoots() {
  if (!trustedRootsPromise) {
    trustedRootsPromise = Promise.all(
      ACTIVE_TRUSTED_ROOT_IDS.map(async (rootId) => {
        const trustedRoot = TRUSTED_ROOT_CERTIFICATES[rootId];
        if (!trustedRoot) {
          throw new Error(`Unknown trusted root id: ${rootId}`);
        }

        return parseCertificate(pemToDer(trustedRoot.pem));
      })
    );
  }

  return trustedRootsPromise;
}

async function verifyNitroAttestationDoc(attestationDocB64, trustedRoots) {
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

async function findTrustedRoot(leafCert, chainCerts, trustedRoots) {
  const pool = [...chainCerts, ...trustedRoots];
  let current = leafCert;
  const used = new Set();

  for (let i = 0; i < pool.length + 1; i += 1) {
    if (bytesEqual(current.subjectDer, current.issuerDer)) {
      break;
    }

    let parent = null;
    let parentIndex = -1;
    for (let index = 0; index < pool.length; index += 1) {
      if (used.has(index)) {
        continue;
      }

      const candidate = pool[index];
      if (!bytesEqual(candidate.subjectDer, current.issuerDer)) {
        continue;
      }

      if (await verifyCertificateSignature(current, candidate)) {
        parent = candidate;
        parentIndex = index;
        break;
      }
    }

    if (!parent || parentIndex === -1) {
      throw new AttestationError('invalid_chain', 'Could not build certificate chain');
    }

    used.add(parentIndex);
    current = parent;
  }

  const selfSigned = await verifyCertificateSignature(current, current);
  if (!selfSigned) {
    throw new AttestationError('invalid_chain', 'Root certificate is not self-signed');
  }

  const trustedFingerprints = new Set(trustedRoots.map((cert) => cert.fingerprint256.toUpperCase()));
  if (!trustedFingerprints.has(current.fingerprint256.toUpperCase())) {
    throw new AttestationError('invalid_chain', 'Certificate chain root is not trusted');
  }

  return current;
}

async function verifyCertificateSignature(childCert, parentCert) {
  const algorithm = childCert.signatureAlgorithm;
  const publicKey = await importEcPublicKey(parentCert.spkiBytes, parentCert.namedCurve.name);
  const signature = derEcdsaSignatureToP1363(childCert.signatureDer, parentCert.namedCurve.coordinateLength);

  return crypto.subtle.verify(
    { name: 'ECDSA', hash: algorithm.hash },
    publicKey,
    signature,
    childCert.tbsBytes
  );
}

async function parseCertificate(derBytes) {
  const certificateSequence = readDerElement(derBytes, 0);
  if (certificateSequence.tag !== 0x30) {
    throw new AttestationError('invalid_chain', 'Certificate is not a DER sequence');
  }

  const certificateChildren = readDerChildren(derBytes, certificateSequence.valueStart, certificateSequence.valueEnd);
  if (certificateChildren.length < 3) {
    throw new AttestationError('invalid_chain', 'Certificate structure is incomplete');
  }

  const [tbsCertificate, signatureAlgorithm, signatureValue] = certificateChildren;
  if (signatureValue.tag !== 0x03 || signatureValue.valueEnd <= signatureValue.valueStart) {
    throw new AttestationError('invalid_chain', 'Certificate signature is malformed');
  }

  const tbsChildren = readDerChildren(derBytes, tbsCertificate.valueStart, tbsCertificate.valueEnd);
  const hasExplicitVersion = tbsChildren[0]?.tag === 0xa0;
  const issuerIndex = hasExplicitVersion ? 3 : 2;
  const subjectIndex = hasExplicitVersion ? 5 : 4;
  const spkiIndex = hasExplicitVersion ? 6 : 5;

  const issuer = tbsChildren[issuerIndex];
  const subject = tbsChildren[subjectIndex];
  const spki = tbsChildren[spkiIndex];
  if (!issuer || !subject || !spki) {
    throw new AttestationError('invalid_chain', 'Certificate is missing issuer, subject, or public key');
  }

  const signatureAlgorithmOid = parseAlgorithmIdentifier(derBytes, signatureAlgorithm);
  const signatureAlgorithmInfo = ECDSA_SIGNATURE_OIDS[signatureAlgorithmOid];
  if (!signatureAlgorithmInfo) {
    throw new AttestationError('invalid_chain', `Unsupported certificate signature algorithm: ${signatureAlgorithmOid}`);
  }

  const namedCurve = parseNamedCurve(derBytes.subarray(spki.start, spki.end));
  const fingerprint256 = await sha256Fingerprint(derBytes);

  return {
    derBytes,
    tbsBytes: derBytes.subarray(tbsCertificate.start, tbsCertificate.end),
    issuerDer: derBytes.subarray(issuer.start, issuer.end),
    subjectDer: derBytes.subarray(subject.start, subject.end),
    spkiBytes: derBytes.subarray(spki.start, spki.end),
    signatureDer: extractBitStringBytes(derBytes, signatureValue),
    signatureAlgorithm: signatureAlgorithmInfo,
    namedCurve,
    fingerprint256
  };
}

function parseNamedCurve(spkiBytes) {
  const spkiSequence = readDerElement(spkiBytes, 0);
  if (spkiSequence.tag !== 0x30) {
    throw new AttestationError('invalid_chain', 'SPKI is not a DER sequence');
  }

  const spkiChildren = readDerChildren(spkiBytes, spkiSequence.valueStart, spkiSequence.valueEnd);
  const algorithm = spkiChildren[0];
  if (!algorithm) {
    throw new AttestationError('invalid_chain', 'SPKI algorithm is missing');
  }

  const algorithmChildren = readDerChildren(spkiBytes, algorithm.valueStart, algorithm.valueEnd);
  if (algorithmChildren.length < 2) {
    throw new AttestationError('invalid_chain', 'SPKI algorithm parameters are missing');
  }

  const publicKeyAlgorithmOid = parseOid(spkiBytes.subarray(algorithmChildren[0].valueStart, algorithmChildren[0].valueEnd));
  if (publicKeyAlgorithmOid !== '1.2.840.10045.2.1') {
    throw new AttestationError('invalid_chain', `Unsupported certificate key algorithm: ${publicKeyAlgorithmOid}`);
  }

  const curveOid = parseOid(spkiBytes.subarray(algorithmChildren[1].valueStart, algorithmChildren[1].valueEnd));
  const namedCurve = NAMED_CURVE_OIDS[curveOid];
  if (!namedCurve) {
    throw new AttestationError('invalid_chain', `Unsupported EC named curve: ${curveOid}`);
  }

  return namedCurve;
}

function parseAlgorithmIdentifier(bytes, element) {
  const children = readDerChildren(bytes, element.valueStart, element.valueEnd);
  if (!children[0] || children[0].tag !== 0x06) {
    throw new AttestationError('invalid_chain', 'Algorithm identifier is missing an OID');
  }

  return parseOid(bytes.subarray(children[0].valueStart, children[0].valueEnd));
}

function extractBitStringBytes(bytes, element) {
  const value = bytes.subarray(element.valueStart, element.valueEnd);
  if (value.length < 1 || value[0] !== 0) {
    throw new AttestationError('invalid_chain', 'BIT STRING has unexpected unused bits');
  }

  return value.subarray(1);
}

function derEcdsaSignatureToP1363(signatureDer, coordinateLength) {
  const sequence = readDerElement(signatureDer, 0);
  if (sequence.tag !== 0x30) {
    throw new AttestationError('invalid_chain', 'ECDSA signature is not a DER sequence');
  }

  const components = readDerChildren(signatureDer, sequence.valueStart, sequence.valueEnd);
  if (components.length !== 2 || components[0].tag !== 0x02 || components[1].tag !== 0x02) {
    throw new AttestationError('invalid_chain', 'ECDSA signature must contain r and s integers');
  }

  const r = trimLeadingZeros(signatureDer.subarray(components[0].valueStart, components[0].valueEnd));
  const s = trimLeadingZeros(signatureDer.subarray(components[1].valueStart, components[1].valueEnd));
  if (r.length > coordinateLength || s.length > coordinateLength) {
    throw new AttestationError('invalid_chain', 'ECDSA signature component is too large');
  }

  const output = new Uint8Array(coordinateLength * 2);
  output.set(r, coordinateLength - r.length);
  output.set(s, output.length - s.length);
  return output;
}

function trimLeadingZeros(bytes) {
  let offset = 0;
  while (offset < bytes.length - 1 && bytes[offset] === 0) {
    offset += 1;
  }
  return bytes.subarray(offset);
}

async function importEcPublicKey(spkiBytes, namedCurve) {
  return crypto.subtle.importKey('spki', spkiBytes, { name: 'ECDSA', namedCurve }, false, ['verify']);
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

function decodeCbor(bytes) {
  try {
    return readCborValue(bytes, 0);
  } catch (error) {
    if (error instanceof AttestationError) {
      throw error;
    }

    throw new AttestationError('invalid_doc', error instanceof Error ? error.message : 'Invalid CBOR');
  }
}

function readCborValue(bytes, offset) {
  if (offset >= bytes.length) {
    throw new AttestationError('invalid_doc', 'Unexpected end of CBOR input');
  }

  const initial = bytes[offset];
  const majorType = initial >> 5;
  const additionalInfo = initial & 0x1f;
  const lengthInfo = readCborLength(bytes, offset + 1, additionalInfo);
  const nextOffset = lengthInfo.nextOffset;

  switch (majorType) {
    case 0:
      return { value: lengthInfo.value, offset: nextOffset };
    case 1:
      return { value: negateCborInteger(lengthInfo.value), offset: nextOffset };
    case 2: {
      const length = toSafeCborLength(lengthInfo.value);
      const endOffset = nextOffset + length;
      if (endOffset > bytes.length) {
        throw new AttestationError('invalid_doc', 'CBOR byte string exceeds input length');
      }
      return { value: bytes.subarray(nextOffset, endOffset), offset: endOffset };
    }
    case 3: {
      const length = toSafeCborLength(lengthInfo.value);
      const endOffset = nextOffset + length;
      if (endOffset > bytes.length) {
        throw new AttestationError('invalid_doc', 'CBOR text string exceeds input length');
      }
      return { value: textDecoder.decode(bytes.subarray(nextOffset, endOffset)), offset: endOffset };
    }
    case 4: {
      const length = toSafeCborLength(lengthInfo.value);
      const items = [];
      let cursor = nextOffset;
      for (let index = 0; index < length; index += 1) {
        const decoded = readCborValue(bytes, cursor);
        items.push(decoded.value);
        cursor = decoded.offset;
      }
      return { value: items, offset: cursor };
    }
    case 5: {
      const length = toSafeCborLength(lengthInfo.value);
      const map = new Map();
      let cursor = nextOffset;
      for (let index = 0; index < length; index += 1) {
        const key = readCborValue(bytes, cursor);
        const value = readCborValue(bytes, key.offset);
        map.set(key.value, value.value);
        cursor = value.offset;
      }
      return { value: map, offset: cursor };
    }
    case 6: {
      const tagged = readCborValue(bytes, nextOffset);
      return { value: tagged.value, offset: tagged.offset };
    }
    case 7:
      return readCborSimpleValue(bytes, additionalInfo, nextOffset);
    default:
      throw new AttestationError('invalid_doc', `Unsupported CBOR major type: ${majorType}`);
  }
}

function readCborLength(bytes, offset, additionalInfo) {
  if (additionalInfo < 24) {
    return { value: additionalInfo, nextOffset: offset };
  }

  if (additionalInfo === 24) {
    return { value: bytes[offset], nextOffset: offset + 1 };
  }

  if (additionalInfo === 25) {
    return {
      value: readUint(bytes, offset, 2),
      nextOffset: offset + 2
    };
  }

  if (additionalInfo === 26) {
    return {
      value: readUint(bytes, offset, 4),
      nextOffset: offset + 4
    };
  }

  if (additionalInfo === 27) {
    return {
      value: readUint64(bytes, offset),
      nextOffset: offset + 8
    };
  }

  throw new AttestationError('invalid_doc', 'Indefinite-length CBOR values are not supported');
}

function readCborSimpleValue(bytes, additionalInfo, offset) {
  if (additionalInfo === 20) {
    return { value: false, offset };
  }
  if (additionalInfo === 21) {
    return { value: true, offset };
  }
  if (additionalInfo === 22) {
    return { value: null, offset };
  }
  if (additionalInfo === 23) {
    return { value: undefined, offset };
  }
  if (additionalInfo === 26) {
    const buffer = bytes.buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + offset + 4);
    return { value: new DataView(buffer).getFloat32(0, false), offset: offset + 4 };
  }
  if (additionalInfo === 27) {
    const buffer = bytes.buffer.slice(bytes.byteOffset + offset, bytes.byteOffset + offset + 8);
    return { value: new DataView(buffer).getFloat64(0, false), offset: offset + 8 };
  }

  throw new AttestationError('invalid_doc', `Unsupported CBOR simple value: ${additionalInfo}`);
}

function negateCborInteger(value) {
  if (typeof value === 'bigint') {
    return -1n - value;
  }
  return -1 - value;
}

function toSafeCborLength(value) {
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new AttestationError('invalid_doc', 'CBOR length exceeds safe integer range');
    }
    return Number(value);
  }

  return value;
}

function readUint(bytes, offset, length) {
  if (offset + length > bytes.length) {
    throw new AttestationError('invalid_doc', 'Unexpected end of CBOR input');
  }

  let value = 0;
  for (let index = 0; index < length; index += 1) {
    value = (value * 256) + bytes[offset + index];
  }
  return value;
}

function readUint64(bytes, offset) {
  if (offset + 8 > bytes.length) {
    throw new AttestationError('invalid_doc', 'Unexpected end of CBOR input');
  }

  let value = 0n;
  for (let index = 0; index < 8; index += 1) {
    value = (value << 8n) | BigInt(bytes[offset + index]);
  }
  if (value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  return value;
}

function encodeCborValue(value) {
  if (Array.isArray(value)) {
    return concatBytes(encodeCborHead(4, value.length), ...value.map((item) => encodeCborValue(item)));
  }

  if (value instanceof Uint8Array) {
    return concatBytes(encodeCborHead(2, value.length), value);
  }

  if (typeof value === 'string') {
    const encoded = textEncoder.encode(value);
    return concatBytes(encodeCborHead(3, encoded.length), encoded);
  }

  throw new AttestationError('invalid_doc', `Unsupported CBOR encoding type: ${typeof value}`);
}

function encodeCborHead(majorType, value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new AttestationError('invalid_doc', 'CBOR length must be a non-negative integer');
  }

  if (value < 24) {
    return Uint8Array.of((majorType << 5) | value);
  }

  if (value < 0x100) {
    return Uint8Array.of((majorType << 5) | 24, value);
  }

  if (value < 0x10000) {
    return Uint8Array.of((majorType << 5) | 25, (value >> 8) & 0xff, value & 0xff);
  }

  if (value < 0x100000000) {
    return Uint8Array.of(
      (majorType << 5) | 26,
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff
    );
  }

  throw new AttestationError('invalid_doc', 'CBOR lengths above 32 bits are not supported');
}

function readDerElement(bytes, offset) {
  if (offset >= bytes.length) {
    throw new AttestationError('invalid_chain', 'Unexpected end of DER input');
  }

  const tag = bytes[offset];
  const lengthInfo = readDerLength(bytes, offset + 1);
  const valueStart = offset + 1 + lengthInfo.bytesRead;
  const valueEnd = valueStart + lengthInfo.length;
  if (valueEnd > bytes.length) {
    throw new AttestationError('invalid_chain', 'DER element exceeds input length');
  }

  return {
    tag,
    start: offset,
    valueStart,
    valueEnd,
    end: valueEnd
  };
}

function readDerLength(bytes, offset) {
  if (offset >= bytes.length) {
    throw new AttestationError('invalid_chain', 'Unexpected end of DER length');
  }

  const first = bytes[offset];
  if ((first & 0x80) === 0) {
    return { length: first, bytesRead: 1 };
  }

  const numBytes = first & 0x7f;
  if (numBytes === 0 || numBytes > 4) {
    throw new AttestationError('invalid_chain', 'Unsupported DER length encoding');
  }

  let length = 0;
  for (let index = 0; index < numBytes; index += 1) {
    const nextOffset = offset + 1 + index;
    if (nextOffset >= bytes.length) {
      throw new AttestationError('invalid_chain', 'Unexpected end of DER length');
    }
    length = (length * 256) + bytes[nextOffset];
  }

  return { length, bytesRead: 1 + numBytes };
}

function readDerChildren(bytes, start, end) {
  const children = [];
  let offset = start;
  while (offset < end) {
    const child = readDerElement(bytes, offset);
    children.push(child);
    offset = child.end;
  }

  if (offset !== end) {
    throw new AttestationError('invalid_chain', 'DER child parsing did not end on a boundary');
  }

  return children;
}

function parseOid(bytes) {
  if (bytes.length === 0) {
    throw new AttestationError('invalid_chain', 'OID is empty');
  }

  const parts = [];
  const first = bytes[0];
  parts.push(Math.floor(first / 40));
  parts.push(first % 40);

  let value = 0;
  for (let index = 1; index < bytes.length; index += 1) {
    value = (value << 7) | (bytes[index] & 0x7f);
    if ((bytes[index] & 0x80) === 0) {
      parts.push(value);
      value = 0;
    }
  }

  if ((bytes[bytes.length - 1] & 0x80) !== 0) {
    throw new AttestationError('invalid_chain', 'OID encoding is truncated');
  }

  return parts.join('.');
}

function toByteString(value, fieldName) {
  if (!(value instanceof Uint8Array)) {
    throw new AttestationError('invalid_doc', `${fieldName} is not a byte string`);
  }

  return value;
}

function toMap(value, fieldName) {
  if (!(value instanceof Map)) {
    throw new AttestationError('invalid_doc', `${fieldName} is not a CBOR map`);
  }

  return value;
}

function normalizeHex(value) {
  return value.replace(/^0x/i, '').toLowerCase();
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Fingerprint(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(':');
}

function bytesEqual(left, right) {
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

function concatBytes(...parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function base64ToBytes(value) {
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

function pemToDer(pem) {
  const base64 = pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '');
  return base64ToBytes(base64);
}
