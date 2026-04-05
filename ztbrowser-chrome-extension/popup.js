function shortHex(value) {
  if (typeof value !== 'string') {
    return 'n/a';
  }
  if (value.length <= 24) {
    return value;
  }
  return `${value.slice(0, 12)}...${value.slice(-12)}`;
}

chrome.storage.local.get(
  ['workingEnv', 'codeValidated', 'reason', 'verifiedPlatform', 'factsMatched', 'workload', 'verifiedPcrs', 'debugSteps'],
  (data) => {
    const workingEnv = Boolean(data.workingEnv);
    const codeValidated = Boolean(data.codeValidated);
    const locked = workingEnv && codeValidated;

    const statusEl = document.getElementById('status');
    const reasonEl = document.getElementById('reason');
    const platformEl = document.getElementById('platform');
    const factsEl = document.getElementById('facts');
    const repoEl = document.getElementById('repo');
    const digestEl = document.getElementById('digest');
    const pcrsEl = document.getElementById('pcrs');
    const debugEl = document.getElementById('debug');

    if (statusEl) {
      statusEl.textContent = `Status: ${locked ? 'locked' : 'unlocked'} (env=${workingEnv}, code=${codeValidated})`;
      statusEl.className = `row ${locked ? 'ok' : 'bad'}`;
    }

    if (reasonEl) {
      reasonEl.textContent = `Reason: ${data.reason || 'n/a'}`;
    }

    if (platformEl) {
      platformEl.textContent = `Platform: ${data.verifiedPlatform || 'n/a'}`;
    }

    if (factsEl) {
      factsEl.textContent = `Facts match: ${data.factsMatched ? 'yes' : 'no'}`;
    }

    if (data.workload && typeof data.workload === 'object') {
      if (repoEl) {
        repoEl.textContent = `repo: ${data.workload.repo_url || 'n/a'}`;
      }
      if (digestEl) {
        digestEl.textContent = `image: ${data.workload.oci_image_digest || 'n/a'}`;
      }
    }

    if (pcrsEl && data.verifiedPcrs && typeof data.verifiedPcrs === 'object') {
      pcrsEl.textContent =
        `PCR0=${shortHex(data.verifiedPcrs.pcr0)} ` +
        `PCR1=${shortHex(data.verifiedPcrs.pcr1)} ` +
        `PCR2=${shortHex(data.verifiedPcrs.pcr2)} ` +
        `PCR8=${shortHex(data.verifiedPcrs.pcr8)}`;
    }

    if (debugEl) {
      const steps = Array.isArray(data.debugSteps) ? data.debugSteps : [];
      debugEl.textContent = steps.length
        ? `Debug:\n${steps.map((step) => JSON.stringify(step)).join('\n')}`
        : 'Debug: n/a';
    }
  }
);
