import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cbor from 'cbor';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

const rootCertPath = process.env.ROOT_CERT_PATH || path.join(__dirname, 'demo-pki', 'root-cert.pem');
const leafCertPath = process.env.LEAF_CERT_PATH || path.join(__dirname, 'demo-pki', 'leaf-cert.pem');
const leafKeyPath = process.env.LEAF_KEY_PATH || path.join(__dirname, 'demo-pki', 'leaf-key.pem');

const moduleId = process.env.MODULE_ID || 'i-demo-instance-enc-container';
const workloadId = process.env.WORKLOAD_ID || 'demo-workload-fixture';
const repoUrl = process.env.REPO_URL || 'https://github.com/example/demo-service-repo';
const ociImageDigest =
  process.env.OCI_IMAGE_DIGEST || 'sha256:1111111111111111111111111111111111111111111111111111111111111111';

const pcr0 = (process.env.PCR0 || '0'.repeat(96)).toLowerCase();
const pcr1 = (process.env.PCR1 || '0'.repeat(96)).toLowerCase();
const pcr2 = (process.env.PCR2 || '0'.repeat(96)).toLowerCase();
const pcr8 = (process.env.PCR8 || '0'.repeat(96)).toLowerCase();

function pemToDer(pem) {
  return Buffer.from(pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, ''), 'base64');
}

const rootCertDer = pemToDer(fs.readFileSync(rootCertPath, 'utf8'));
const leafCertDer = pemToDer(fs.readFileSync(leafCertPath, 'utf8'));
const leafKeyPem = fs.readFileSync(leafKeyPath, 'utf8');

function parseNonceToBuffer(nonce) {
  if (/^[0-9a-f]+$/i.test(nonce) && nonce.length % 2 === 0) {
    return Buffer.from(nonce, 'hex');
  }
  return crypto.createHash('sha256').update(nonce).digest();
}

function signAttestationDoc(nonce) {
  const payload = cbor.encodeCanonical(
    new Map([
      ['module_id', moduleId],
      ['digest', 'SHA384'],
      ['timestamp', Date.now()],
      [
        'pcrs',
        new Map([
          [0, Buffer.from(pcr0, 'hex')],
          [1, Buffer.from(pcr1, 'hex')],
          [2, Buffer.from(pcr2, 'hex')],
          [8, Buffer.from(pcr8, 'hex')]
        ])
      ],
      ['certificate', leafCertDer],
      ['cabundle', [rootCertDer]],
      ['public_key', null],
      ['user_data', null],
      ['nonce', parseNonceToBuffer(nonce)]
    ])
  );

  const protectedHeader = cbor.encodeCanonical(new Map([[1, -35]]));
  const sigStructure = cbor.encodeCanonical(['Signature1', protectedHeader, Buffer.alloc(0), payload]);
  const signature = crypto.sign('sha384', sigStructure, {
    key: leafKeyPem,
    dsaEncoding: 'ieee-p1363'
  });

  return cbor.encodeCanonical([protectedHeader, new Map(), payload, signature]).toString('base64');
}

app.get('/', (_req, res) => {
  res.send('Hello from demo service');
});

app.post('/.well-known/attestation', (req, res) => {
  const nonce = typeof req.body?.NONCE === 'string' ? req.body.NONCE : '';
  const attestationDoc = signAttestationDoc(nonce);

  res.json({
    platform: 'aws_nitro_eif',
    nonce,
    workload: {
      workload_id: workloadId,
      repo_url: repoUrl,
      oci_image_digest: ociImageDigest,
      eif_pcrs: { pcr0, pcr1, pcr2, pcr8 }
    },
    evidence: {
      nitro_attestation_doc_b64: attestationDoc
    }
  });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`demo-service-repo listening on ${port}`);
});
