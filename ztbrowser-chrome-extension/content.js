const FACTS_NODE_URLS = ['https://facts-db.onrender.com'];

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

function extensionFetchJson(url, options = {}) {
  return sendRuntimeMessage({
    type: 'fetch_json',
    url,
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body
  }).then((response) => {
    if (!response || !response.ok) {
      throw new Error((response && response.error) || 'fetch_failed');
    }

    return response.result;
  });
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

function normalizeFetchedEnvelope(attestation) {
  if (attestation && attestation.version === 'ztinfra-attestation/v1') {
    return attestation;
  }

  if (attestation?.platform === 'aws_nitro_eif' && typeof attestation?.evidence?.nitro_attestation_doc_b64 === 'string') {
    return {
      version: 'ztinfra-attestation/v1',
      service: typeof attestation?.workload?.repo_url === 'string' ? attestation.workload.repo_url.split('/').at(-1) : 'unknown-service',
      release_id: typeof attestation?.workload?.release_tag === 'string' ? attestation.workload.release_tag : 'unknown-release',
      platform: 'aws_nitro_eif',
      nonce: typeof attestation.nonce === 'string' ? attestation.nonce : '',
      claims: {
        workload_pubkey: null,
        identity_hint: null
      },
      evidence: {
        type: 'aws_nitro_attestation_doc',
        payload: {
          nitro_attestation_doc_b64: attestation.evidence.nitro_attestation_doc_b64
        }
      },
      facts_url: typeof attestation.facts_url === 'string' ? attestation.facts_url : null
    };
  }

  return attestation;
}

async function verifyAttestation(nonceSent, envelope) {
  const response = await sendRuntimeMessage({
    type: 'verify-attestation',
    payload: {
      nonce_sent: nonceSent,
      envelope
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

async function lookupFactsForIdentity(identity) {
  for (const base of FACTS_NODE_URLS) {
    try {
      const response = await extensionFetchJson(`${base}/api/v1/lookup-by-realization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: identity.platform,
          identity: identity.identity
        })
      });
      if (!response.ok) {
        continue;
      }
      const data = response.json;
      if (data && data.matched && data.workload) {
        return { matched: true, node: base, workload: data.workload, release: data.release ?? null, realization: data.realization ?? null };
      }
    } catch {
      // Continue to next trusted node.
    }
  }

  return { matched: false, node: null, workload: null, release: null, realization: null };
}

async function validate() {
  const randomNonce = generateNonceHex();
  const debugSteps = [];
  pushDebugStep(debugSteps, 'validate_start', {
    origin: window.location.origin,
    factsNodeUrls: FACTS_NODE_URLS
  });

  try {
    pushDebugStep(debugSteps, 'fetch_attestation_start', {
      url: new URL('/.well-known/attestation', window.location.origin).toString(),
      nonceLength: randomNonce.length
    });
    const attestation = normalizeFetchedEnvelope(await fetchAttestation(randomNonce));
    pushDebugStep(debugSteps, 'fetch_attestation_ok', {
      platform: attestation && attestation.platform,
      version: attestation?.version || null,
      evidenceType: attestation?.evidence?.type || null
    });
    const nonceForVerification = randomNonce;

    if (
      attestation?.version !== 'ztinfra-attestation/v1' ||
      typeof attestation?.platform !== 'string' ||
      !attestation?.evidence ||
      typeof attestation.evidence.type !== 'string' ||
      typeof attestation.evidence.payload !== 'object'
    ) {
      pushDebugStep(debugSteps, 'fetch_attestation_invalid_payload', {
        platform: attestation?.platform ?? null,
        version: attestation?.version ?? null,
        evidenceType: attestation?.evidence?.type ?? null
      });
      throw new Error('invalid_attestation_payload');
    }

    pushDebugStep(debugSteps, 'verify_start', {
      platform: attestation.platform
    });
    const verdict = await verifyAttestation(nonceForVerification, attestation);
    pushDebugStep(debugSteps, 'verify_ok', {
      workingEnv: Boolean(verdict.workingEnv),
      codeValidated: Boolean(verdict.codeValidated),
      reason: verdict.reason || null
    });
    const pcrs = verdict?.verified?.pcrs || null;
    const verifiedIdentity = verdict?.verified?.identity || null;
    const verifiedPlatform = verdict?.verified?.platform || attestation.platform || null;
    let facts = { matched: false, node: null, workload: null, release: null, realization: null };
    if (verifiedIdentity && verifiedPlatform) {
      pushDebugStep(debugSteps, 'facts_lookup_start', {
        urls: FACTS_NODE_URLS
      });
      facts = await lookupFactsForIdentity({
        platform: verifiedPlatform,
        identity: verifiedIdentity
      });
      pushDebugStep(debugSteps, 'facts_lookup_done', {
        matched: facts.matched,
        node: facts.node
      });
    } else {
      pushDebugStep(debugSteps, 'facts_lookup_skipped', {
        reason: 'missing_verified_identity'
      });
    }

    const locked = Boolean(verdict.workingEnv && verdict.codeValidated);
    setState({
      workingEnv: Boolean(verdict.workingEnv),
      codeValidated: Boolean(verdict.codeValidated),
      reason: verdict.reason || null,
      verifiedPlatform,
      verifiedIdentity,
      verifiedReleaseId: verdict?.verified?.release_id || null,
      verifiedService: verdict?.verified?.service || null,
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
      verifiedPlatform: null,
      verifiedIdentity: null,
      verifiedReleaseId: null,
      verifiedService: null,
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
