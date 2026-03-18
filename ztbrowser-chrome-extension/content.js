const FACTS_NODE_URLS = ['http://localhost:7777'];

function setState(patch) {
  chrome.storage.local.set(patch);
}

function updateIcon(locked) {
  chrome.runtime.sendMessage({ locked: Boolean(locked) });
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function generateNonceHex(bytes = 32) {
  const nonce = new Uint8Array(bytes);
  crypto.getRandomValues(nonce);
  return Array.from(nonce)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchAttestation(nonce) {
  const endpoint = new URL('/.well-known/attestation', window.location.origin).toString();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ NONCE: nonce })
  });

  if (!response.ok) {
    throw new Error(`attestation_http_${response.status}`);
  }

  return response.json();
}

async function verifyAttestation(platform, nonceSent, attestationDocB64) {
  const response = await sendRuntimeMessage({
    type: 'verify-attestation',
    payload: {
      platform,
      nonce_sent: nonceSent,
      attestation_doc_b64: attestationDocB64
    }
  });

  if (!response || typeof response !== 'object') {
    throw new Error('verify_unavailable');
  }

  if (!response.ok) {
    throw new Error(response.json?.reason || 'verification_failed');
  }

  return response.json;
}

async function lookupFactsForPcrs(pcrs) {
  for (const base of FACTS_NODE_URLS) {
    try {
      const response = await fetch(`${base}/api/v1/lookup-by-pcr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pcrs)
      });
      if (!response.ok) {
        continue;
      }
      const data = await response.json();
      if (data && data.matched && data.workload) {
        return { matched: true, node: base, workload: data.workload };
      }
    } catch {
      // Continue to next trusted node.
    }
  }

  return { matched: false, node: null, workload: null };
}

async function validate() {
  const randomNonce = generateNonceHex();

  try {
    const attestation = await fetchAttestation(randomNonce);
    const platform = attestation.platform;
    const attestationDoc = attestation?.evidence?.nitro_attestation_doc_b64;
    const nonceForVerification = randomNonce;

    if (platform !== 'aws_nitro_eif' || typeof attestationDoc !== 'string') {
      throw new Error('invalid_attestation_payload');
    }

    const verdict = await verifyAttestation(platform, nonceForVerification, attestationDoc);
    const pcrs = verdict?.verified?.pcrs || null;
    const facts = pcrs ? await lookupFactsForPcrs(pcrs) : { matched: false, node: null, workload: null };

    const locked = Boolean(verdict.workingEnv && verdict.codeValidated);
    setState({
      workingEnv: Boolean(verdict.workingEnv),
      codeValidated: Boolean(verdict.codeValidated),
      reason: verdict.reason || null,
      verifiedPcrs: pcrs,
      factsMatched: facts.matched,
      factsNode: facts.node,
      workload: facts.workload
    });
    updateIcon(locked);
  } catch (error) {
    setState({
      workingEnv: false,
      codeValidated: false,
      reason: error instanceof Error ? error.message : 'validation_failed',
      verifiedPcrs: null,
      factsMatched: false,
      factsNode: null,
      workload: null
    });
    updateIcon(false);
  }
}

validate();
setInterval(validate, 60000);
