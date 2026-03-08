import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  AttestationError,
  verifyNitroAttestationDoc
} from './src/shared/nitroAttestation.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: true }));
const port = Number(process.env.PORT ?? '3000');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadTrustedRootFingerprints(): { fingerprints: string[]; paths: string[] } {
  const defaultAwsRootPath = path.join(__dirname, 'fixtures', 'aws-nitro-root.pem');
  const configuredPaths = (process.env.TRUST_ROOT_CERT_PATHS ?? defaultAwsRootPath)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (configuredPaths.length === 0) {
    throw new Error('No trusted root certificate paths configured');
  }

  const fingerprints = configuredPaths.map((certPath) => {
    const pem = fs.readFileSync(certPath, 'utf8');
    const cert = new crypto.X509Certificate(pem);
    return cert.fingerprint256;
  });

  return { fingerprints, paths: configuredPaths };
}

const trustedRoots = loadTrustedRootFingerprints();

type VerifyRequest = {
  platform?: string;
  nonce_sent?: string;
  attestation_doc_b64?: string;
};

app.post('/verify', (req, res) => {
  const body = req.body as VerifyRequest;

  if (body.platform !== 'aws_nitro_eif') {
    res.status(400).json({
      workingEnv: false,
      codeValidated: false,
      reason: 'unsupported_platform'
    });
    return;
  }

  if (typeof body.nonce_sent !== 'string' || typeof body.attestation_doc_b64 !== 'string') {
    res.status(400).json({
      workingEnv: false,
      codeValidated: false,
      reason: 'invalid_payload'
    });
    return;
  }

  try {
    const verified = verifyNitroAttestationDoc(body.attestation_doc_b64, trustedRoots.fingerprints);
    const nonceSent = body.nonce_sent.trim().toLowerCase();
    const nonceMatches = nonceSent.length > 0 && nonceSent === verified.nonceHex;

    res.json({
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
    });
  } catch (error) {
    const reason = error instanceof AttestationError ? error.reason : 'invalid_doc';
    const message = error instanceof Error ? error.message : 'Unknown error';

    res.status(400).json({
      workingEnv: false,
      codeValidated: false,
      reason,
      details: { message }
    });
  }
});

app.listen(port, () => {
  console.log(`Checker listening on http://localhost:${port}`);
  console.log(`Trusted root cert paths: ${trustedRoots.paths.join(', ')}`);
  console.log(`Trusted root fingerprints: ${trustedRoots.fingerprints.join(', ')}`);
});
