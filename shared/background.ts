// Background script for Chrome extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openNewTab') {
    chrome.tabs.create({ url: chrome.runtime.getURL('newtab/newtab.html') })
  }
})
