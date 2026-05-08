// MV3 service worker — opens the side panel when the extension toolbar
// icon is clicked. The actual ad-rendering happens in sidepanel.js
// (DOM context); this worker just routes the click.

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error("[lumi-ext] sidepanel setPanelBehavior failed", err));
