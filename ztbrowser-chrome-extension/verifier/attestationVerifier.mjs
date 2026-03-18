import { normalizeHex, pemToDer } from './bytes.mjs';
import { parseCertificate } from './certificates.mjs';
import { AttestationError } from './errors.mjs';
import { verifyNitroAttestationDoc } from './attestation.mjs';
import { ACTIVE_TRUSTED_ROOT_IDS, TRUSTED_ROOT_CERTIFICATES } from '../trustedRoots.mjs';

let trustedRootsPromise = null;

export { AttestationError } from './errors.mjs';

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
