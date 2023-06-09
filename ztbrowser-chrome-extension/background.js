const iconPath = {
  'locked': {
    '16': 'locked-16x16.png',
  },
  'unlocked': {
    '16': 'unlocked-16x16.png',
  }
};

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  chrome.tabs.query({active:true, windowType:"normal", currentWindow: true},function(d){
      var tabId = d[0].id;
      chrome.browserAction.setIcon({path: iconPath[msg.locked ? 'locked' : 'unlocked'], tabId: tabId});
  })
})