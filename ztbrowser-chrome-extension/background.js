import { verifyAttestationRequest } from './verifier/attestationVerifier.mjs';

const iconPath = {
  locked: { 16: 'locked-16x16.png' },
  unlocked: { 16: 'unlocked-16x16.png' }
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'verify-attestation') {
    verifyAttestationRequest(msg.payload)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          json: {
            workingEnv: false,
            codeValidated: false,
            reason: 'invalid_doc',
            details: { message: error instanceof Error ? error.message : 'Unknown error' }
          }
        });
      });
    return true;
  }

  const tabId = sender?.tab?.id;
  if (typeof tabId !== 'number') {
    return;
  }

  chrome.action.setIcon({
    path: msg && msg.locked ? iconPath.locked : iconPath.unlocked,
    tabId
  });
});
