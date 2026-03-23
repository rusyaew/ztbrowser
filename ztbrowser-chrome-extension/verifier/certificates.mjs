import { bytesEqual, sha256Fingerprint } from './bytes.mjs';
import { AttestationError } from './errors.mjs';

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

export async function parseCertificate(derBytes) {
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

export async function findTrustedRoot(leafCert, chainCerts, trustedRoots) {
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

export async function importEcPublicKey(spkiBytes, namedCurve) {
  return crypto.subtle.importKey('spki', spkiBytes, { name: 'ECDSA', namedCurve }, false, ['verify']);
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
