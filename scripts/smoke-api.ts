import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';

const TSX_BIN = path.join(process.cwd(), 'node_modules', '.bin', 'tsx');

type Json = Record<string, unknown>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startProcess(args: string[], env: NodeJS.ProcessEnv = {}): ChildProcess {
  const child = spawn(TSX_BIN, args, {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true
  });

  child.stdout?.on('data', (chunk) => process.stdout.write(`[proc] ${chunk}`));
  child.stderr?.on('data', (chunk) => process.stderr.write(`[proc] ${chunk}`));
  return child;
}

async function stopProcess(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (!pid || child.killed) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        // Ignore if already exited.
      }
      resolve();
    }, 3000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      resolve();
    }
  });
}

async function postJson(url: string, body: Json): Promise<{ status: number; json: Json }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const json = (await response.json()) as Json;
  return { status: response.status, json };
}

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function verifyFlow(
  baseUrl: string,
  checkerUrl: string,
  factsUrl: string,
  expectCodeValidated: boolean
): Promise<void> {
  const nonce = 'deadbeef';
  const att = await postJson(`${baseUrl}/.well-known/attestation`, { NONCE: nonce });
  assert(att.status === 200, 'attestation endpoint failed');

  const attDoc = (((att.json.evidence as Json) || {}).nitro_attestation_doc_b64 as string) || '';
  const verificationNonce = nonce.toLowerCase();

  const verdict = await postJson(`${checkerUrl}/verify`, {
    platform: att.json.platform,
    nonce_sent: verificationNonce,
    attestation_doc_b64: attDoc
  });

  if (expectCodeValidated) {
    assert(verdict.status === 200, `checker expected 200, got ${verdict.status}`);
    assert(verdict.json.codeValidated === true, 'expected codeValidated=true');
    assert(verdict.json.workingEnv === true, 'expected workingEnv=true');

    const pcrs = ((verdict.json.verified as Json).pcrs as Json) || {};
    const facts = await postJson(`${factsUrl}/api/v1/lookup-by-pcr`, pcrs);
    assert(facts.status === 200, 'facts lookup failed');
    assert(facts.json.matched === true, 'expected facts match');
  } else {
    assert(verdict.status !== 200 || verdict.json.codeValidated === false, 'expected checker failure in bad mode');
  }
}

async function run(): Promise<void> {
  const factsPort = '17777';
  const checkerPort = '13000';
  const goodPort = '19999';
  const badPort = '19998';
  const demoRootPath = path.join(process.cwd(), 'fixtures', 'demo-pki', 'root-cert.pem');

  const facts = startProcess(['facts-node/server.ts'], { PORT: factsPort });
  const checker = startProcess(['clientsidechecker.ts'], { PORT: checkerPort, TRUST_ROOT_CERT_PATHS: demoRootPath });
  const exampleGood = startProcess(['demo-service-repo/exampleserver.ts'], { MODE: 'good', PORT: goodPort });
  const exampleBad = startProcess(['demo-service-repo/exampleserver.ts'], { MODE: 'bad', PORT: badPort });

  try {
    await sleep(2500);
    await verifyFlow(
      `http://localhost:${goodPort}`,
      `http://localhost:${checkerPort}`,
      `http://localhost:${factsPort}`,
      true
    );
    await verifyFlow(
      `http://localhost:${badPort}`,
      `http://localhost:${checkerPort}`,
      `http://localhost:${factsPort}`,
      false
    );

    console.log('Smoke API checks passed');
  } finally {
    await stopProcess(facts);
    await stopProcess(checker);
    await stopProcess(exampleGood);
    await stopProcess(exampleBad);
  }
}

run().catch((error) => {
  console.error('Smoke API checks failed:', error);
  process.exit(1);
});
