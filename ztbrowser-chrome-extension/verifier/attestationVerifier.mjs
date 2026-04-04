import { normalizeHex, pemToDer } from './bytes.mjs';
import { parseCertificate } from './certificates.mjs';
import { AttestationError } from './errors.mjs';
import { ACTIVE_TRUSTED_ROOT_IDS, TRUSTED_ROOT_CERTIFICATES } from '../trustedRoots.mjs';
import {
  normalizeEnvelope,
  PLATFORM_AWS_COCO_SNP,
  PLATFORM_AWS_NITRO_EIF,
} from './contracts.mjs';
import { verifyNitroEnvelope } from './nitroVerifierPlugin.mjs';
import { verifyCocoEnvelope } from './cocoVerifierPlugin.mjs';

let trustedRootsPromise = null;

export { AttestationError } from './errors.mjs';

export async function verifyAttestationRequest(body) {
  if (typeof body?.nonce_sent !== 'string' || !body?.envelope || typeof body.envelope !== 'object') {
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
    const envelope = normalizeEnvelope(body.envelope);
    const trustedRoots = await getTrustedRoots();
    let verified;
    if (envelope.platform === PLATFORM_AWS_NITRO_EIF) {
      verified = await verifyNitroEnvelope(envelope, trustedRoots);
    } else if (envelope.platform === PLATFORM_AWS_COCO_SNP) {
      verified = await verifyCocoEnvelope(envelope);
    } else {
      return {
        ok: false,
        json: {
          workingEnv: false,
          codeValidated: false,
          reason: 'unsupported_platform'
        }
      };
    }

    const nonceSent = normalizeHex(body.nonce_sent.trim());
    const nonceMatches = nonceSent.length > 0 && nonceSent === verified.nonceHex;

    return {
      ok: true,
      json: {
        workingEnv: nonceMatches,
        codeValidated: true,
        reason: nonceMatches ? 'ok' : 'nonce_mismatch',
        verified: {
          service: envelope.service,
          release_id: envelope.release_id,
          platform: envelope.platform,
          identity: verified.identity,
          workload_pubkey: verified.workloadPubkey ?? envelope.claims.workload_pubkey ?? null,
          nonce_hex: verified.nonceHex,
          module_id: verified.moduleId ?? null,
          timestamp: verified.timestamp ?? null,
          root_fingerprint256: verified.rootFingerprint256 ?? null,
          pcrs: verified.pcrs ?? null
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
