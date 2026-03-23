const FACTS_NODE_URLS = ['https://facts-db.onrender.com'];
const VERIFY_URL = 'http://localhost:3000/verify';

function setState(patch) {
  chrome.storage.local.set(patch);
}

function updateIcon(locked) {
  chrome.runtime.sendMessage({ locked: Boolean(locked) });
}

function generateNonceHex(bytes = 32) {
  const nonce = new Uint8Array(bytes);
  crypto.getRandomValues(nonce);
  return Array.from(nonce)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function pushDebugStep(debugSteps, step, details = {}) {
  const entry = {
    at: new Date().toISOString(),
    step,
    ...details
  };
  debugSteps.push(entry);
  console.log('[ZTBrowser]', step, details);
}

function extensionFetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'fetch_json',
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`runtime_message_failed:${chrome.runtime.lastError.message}`));
          return;
        }

        if (!response || !response.ok) {
          reject(new Error((response && response.error) || 'fetch_failed'));
          return;
        }

        resolve(response.result);
      }
    );
  });
}

async function fetchAttestation(nonce) {
  const endpoint = new URL('/.well-known/attestation', window.location.origin).toString();
  const response = await extensionFetchJson(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ NONCE: nonce })
  });

  if (!response.ok) {
    throw new Error(`attestation_http_${response.status}`);
  }

  return response.json;
}

async function verifyAttestation(platform, nonceSent, attestationDocB64) {
  const response = await extensionFetchJson(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      platform,
      nonce_sent: nonceSent,
      attestation_doc_b64: attestationDocB64
    })
  });

  const json = response.json;
  if (!response.ok) {
    throw new Error((json && json.reason) || `verify_http_${response.status}`);
  }

  return json;
}

async function lookupFactsForPcrs(pcrs) {
  for (const base of FACTS_NODE_URLS) {
    try {
      const response = await extensionFetchJson(`${base}/api/v1/lookup-by-pcr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pcrs)
      });
      if (!response.ok) {
        continue;
      }
      const data = response.json;
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
  const debugSteps = [];
  pushDebugStep(debugSteps, 'validate_start', {
    origin: window.location.origin,
    verifyUrl: VERIFY_URL,
    factsNodeUrls: FACTS_NODE_URLS
  });

  try {
    pushDebugStep(debugSteps, 'fetch_attestation_start', {
      url: new URL('/.well-known/attestation', window.location.origin).toString(),
      nonceLength: randomNonce.length
    });
    const attestation = await fetchAttestation(randomNonce);
    pushDebugStep(debugSteps, 'fetch_attestation_ok', {
      platform: attestation && attestation.platform,
      hasAttestationDoc: Boolean(attestation?.evidence?.nitro_attestation_doc_b64)
    });
    const platform = attestation.platform;
    const attestationDoc = attestation?.evidence?.nitro_attestation_doc_b64;
    const nonceForVerification = randomNonce;

    if (platform !== 'aws_nitro_eif' || typeof attestationDoc !== 'string') {
      pushDebugStep(debugSteps, 'fetch_attestation_invalid_payload', {
        platform,
        attestationDocType: typeof attestationDoc
      });
      throw new Error('invalid_attestation_payload');
    }

    pushDebugStep(debugSteps, 'verify_start', {
      url: VERIFY_URL,
      platform
    });
    const verdict = await verifyAttestation(platform, nonceForVerification, attestationDoc);
    pushDebugStep(debugSteps, 'verify_ok', {
      workingEnv: Boolean(verdict.workingEnv),
      codeValidated: Boolean(verdict.codeValidated),
      reason: verdict.reason || null
    });
    const pcrs = verdict?.verified?.pcrs || null;
    let facts = { matched: false, node: null, workload: null };
    if (pcrs) {
      pushDebugStep(debugSteps, 'facts_lookup_start', {
        urls: FACTS_NODE_URLS
      });
      facts = await lookupFactsForPcrs(pcrs);
      pushDebugStep(debugSteps, 'facts_lookup_done', {
        matched: facts.matched,
        node: facts.node
      });
    } else {
      pushDebugStep(debugSteps, 'facts_lookup_skipped', {
        reason: 'missing_verified_pcrs'
      });
    }

    const locked = Boolean(verdict.workingEnv && verdict.codeValidated);
    setState({
      workingEnv: Boolean(verdict.workingEnv),
      codeValidated: Boolean(verdict.codeValidated),
      reason: verdict.reason || null,
      verifiedPcrs: pcrs,
      factsMatched: facts.matched,
      factsNode: facts.node,
      workload: facts.workload,
      debugSteps
    });
    console.log('[ZTBrowser] validation_success', {
      workingEnv: Boolean(verdict.workingEnv),
      codeValidated: Boolean(verdict.codeValidated),
      factsMatched: facts.matched,
      workload: facts.workload
    });
    updateIcon(locked);
  } catch (error) {
    pushDebugStep(debugSteps, 'validate_error', {
      message: error instanceof Error ? error.message : 'validation_failed',
      stack: error instanceof Error ? error.stack : null
    });
    setState({
      workingEnv: false,
      codeValidated: false,
      reason: error instanceof Error ? error.message : 'validation_failed',
      verifiedPcrs: null,
      factsMatched: false,
      factsNode: null,
      workload: null,
      debugSteps
    });
    console.error('[ZTBrowser] validation_error', error);
    updateIcon(false);
  }
}

validate();
setInterval(validate, 60000);
