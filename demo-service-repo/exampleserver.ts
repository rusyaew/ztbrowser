import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cbor from 'cbor';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(cors({ origin: true }));

const mode = process.env.MODE === 'bad' ? 'bad' : 'good';
const port = Number(process.env.PORT ?? '9999');

const rootCertPath = process.env.DEMO_ROOT_CERT_PATH ?? path.join(__dirname, 'demo-pki', 'root-cert.pem');
const leafCertPath = process.env.DEMO_LEAF_CERT_PATH ?? path.join(__dirname, 'demo-pki', 'leaf-cert.pem');
const leafKeyPath = process.env.DEMO_LEAF_KEY_PATH ?? path.join(__dirname, 'demo-pki', 'leaf-key.pem');

const repoUrl = process.env.REPO_URL ?? 'https://github.com/example/demo-service-repo';
const ociImageDigest =
  process.env.OCI_IMAGE_DIGEST ?? 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const workloadId = process.env.WORKLOAD_ID ?? 'demo-workload-fixture';
const moduleId = process.env.MODULE_ID ?? 'i-demo-instance-enc-demo';

function normalizePcrHex(value: string, fallbackByte: string): string {
  const clean = value.replace(/^0x/i, '').toLowerCase();
  if (/^[0-9a-f]{96}$/.test(clean)) {
    return clean;
  }
  return fallbackByte.repeat(96);
}

const pcrs = {
  pcr0: normalizePcrHex(process.env.PCR0 ?? '', '0'),
  pcr1: normalizePcrHex(process.env.PCR1 ?? '', '0'),
  pcr2: normalizePcrHex(process.env.PCR2 ?? '', '0'),
  pcr8: normalizePcrHex(process.env.PCR8 ?? '', '0')
};

function pemToDer(pem: string): Buffer {
  const stripped = pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '');
  return Buffer.from(stripped, 'base64');
}

const rootCertPem = fs.readFileSync(rootCertPath, 'utf8');
const leafCertPem = fs.readFileSync(leafCertPath, 'utf8');
const leafKeyPem = fs.readFileSync(leafKeyPath, 'utf8');
const rootCertDer = pemToDer(rootCertPem);
const leafCertDer = pemToDer(leafCertPem);

function parseNonceToBuffer(nonce: string): Buffer {
  const clean = nonce.trim().toLowerCase();
  if (/^[0-9a-f]+$/.test(clean) && clean.length % 2 === 0) {
    return Buffer.from(clean, 'hex');
  }
  return crypto.createHash('sha256').update(clean).digest();
}

function buildAttestationDoc(nonce: string): string {
  const nonceBuffer = parseNonceToBuffer(nonce);
  const payload = cbor.encodeCanonical(
    new Map<string, unknown>([
      ['module_id', moduleId],
      ['digest', 'SHA384'],
      ['timestamp', Date.now()],
      [
        'pcrs',
        new Map<number, Buffer>([
          [0, Buffer.from(pcrs.pcr0, 'hex')],
          [1, Buffer.from(pcrs.pcr1, 'hex')],
          [2, Buffer.from(pcrs.pcr2, 'hex')],
          [8, Buffer.from(pcrs.pcr8, 'hex')]
        ])
      ],
      ['certificate', leafCertDer],
      ['cabundle', [rootCertDer]],
      ['public_key', null],
      ['user_data', null],
      ['nonce', nonceBuffer]
    ])
  );

  const protectedHeader = cbor.encodeCanonical(new Map<number, number>([[1, -35]]));
  const sigStructure = cbor.encodeCanonical(['Signature1', protectedHeader, Buffer.alloc(0), payload]);

  const signature = crypto.sign('sha384', sigStructure, {
    key: leafKeyPem,
    dsaEncoding: 'ieee-p1363'
  });

  const coseDoc = cbor.encodeCanonical([protectedHeader, new Map(), payload, signature]);

  if (mode === 'bad') {
    const tampered = Buffer.from(coseDoc);
    tampered[tampered.length - 1] = tampered[tampered.length - 1] ^ 0xff;
    return tampered.toString('base64');
  }

  return coseDoc.toString('base64');
}

app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html>
  <head><title>ZTBrowser Nitro Demo</title></head>
  <body>
    <h1>Hello from demo service</h1>
    <p>This page serves <code>/.well-known/attestation</code> for the extension demo.</p>
  </body>
</html>`);
});

app.post('/.well-known/attestation', (req, res) => {
  const requestNonce = typeof req.body?.NONCE === 'string' ? req.body.NONCE : '';
  const docB64 = buildAttestationDoc(requestNonce);

  res.json({
    platform: 'aws_nitro_eif',
    nonce: requestNonce,
    workload: {
      workload_id: workloadId,
      repo_url: repoUrl,
      oci_image_digest: ociImageDigest,
      eif_pcrs: pcrs
    },
    evidence: {
      nitro_attestation_doc_b64: docB64
    }
  });
});

app.listen(port, () => {
  console.log(`Example server listening on http://localhost:${port} (MODE=${mode})`);
});
