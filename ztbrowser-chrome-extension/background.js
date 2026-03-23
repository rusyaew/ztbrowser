const iconPath = {
  locked: { 16: 'locked-16x16.png' },
  unlocked: { 16: 'unlocked-16x16.png' }
};

async function handleFetchJson(msg) {
  console.log('[ZTBrowser background] fetch_start', {
    method: msg.method || 'GET',
    url: msg.url
  });
  let response;
  try {
    response = await fetch(msg.url, {
      method: msg.method || 'GET',
      headers: msg.headers || {},
      body: msg.body
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'fetch_failed';
    console.error('[ZTBrowser background] fetch_error', {
      method: msg.method || 'GET',
      url: msg.url,
      message
    });
    throw new Error(`fetch_failed:${msg.method || 'GET'}:${msg.url}:${message}`);
  }

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  const result = {
    ok: response.ok,
    status: response.status,
    json,
    text
  };
  console.log('[ZTBrowser background] fetch_done', {
    method: msg.method || 'GET',
    url: msg.url,
    status: response.status,
    ok: response.ok
  });
  return result;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'fetch_json') {
    handleFetchJson(msg)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'fetch_failed'
        })
      );
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
