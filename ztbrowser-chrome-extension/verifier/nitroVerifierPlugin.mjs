import { verifyNitroAttestationDoc } from './attestation.mjs';
import { AttestationError } from './errors.mjs';
import { IDENTITY_TYPE_EIF_PCR_SET } from './contracts.mjs';

export async function verifyNitroEnvelope(envelope, trustedRoots) {
  if (envelope.evidence.type !== 'aws_nitro_attestation_doc') {
    throw new AttestationError('invalid_payload', 'Nitro envelope must use aws_nitro_attestation_doc evidence');
  }
  const attestationDocB64 = typeof envelope.evidence.payload.nitro_attestation_doc_b64 === 'string'
    ? envelope.evidence.payload.nitro_attestation_doc_b64
    : typeof envelope.evidence.nitro_attestation_doc_b64 === 'string'
      ? envelope.evidence.nitro_attestation_doc_b64
      : null;
  if (typeof attestationDocB64 !== 'string') {
    throw new AttestationError('invalid_payload', 'Nitro evidence payload must contain nitro_attestation_doc_b64');
  }

  const verified = await verifyNitroAttestationDoc(attestationDocB64, trustedRoots);
  return {
    nonceHex: verified.nonceHex,
    pcrs: verified.pcrs,
    moduleId: verified.moduleId,
    timestamp: verified.timestamp,
    rootFingerprint256: verified.rootFingerprint256,
    identity: {
      type: IDENTITY_TYPE_EIF_PCR_SET,
      value: { ...verified.pcrs },
    },
  };
}
