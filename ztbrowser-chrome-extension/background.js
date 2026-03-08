const iconPath = {
  locked: { 16: 'locked-16x16.png' },
  unlocked: { 16: 'unlocked-16x16.png' }
};

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender?.tab?.id;
  if (typeof tabId !== 'number') {
    return;
  }

  chrome.action.setIcon({
    path: msg && msg.locked ? iconPath.locked : iconPath.unlocked,
    tabId
  });
});
