// Scroll Balance - Background Service Worker

// Track time spent on each site
const siteTracking = {};
let currentTabId = null;
let lastUpdateTime = Date.now();

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Scroll Balance extension installed');

  // Set default settings
  chrome.storage.local.get(['settings'], (result) => {
    if (!result.settings) {
      const defaultSettings = {
        frictionEnabled: true,
        frictionInterval: 20, // minutes
        wellnessReminders: true,
        goals: ['learn', 'chill']
      };
      chrome.storage.local.set({ settings: defaultSettings });
    }
  });
});

// Track active tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateSiteTime();
  currentTabId = activeInfo.tabId;
  lastUpdateTime = Date.now();
});

// Track when tab changes URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tabId === currentTabId) {
    updateSiteTime();
    lastUpdateTime = Date.now();
  }
});

// Update time tracking
function updateSiteTime() {
  if (!currentTabId) return;

  chrome.tabs.get(currentTabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) return;

    const url = new URL(tab.url);
    const domain = url.hostname;

    const timeSpent = Math.floor((Date.now() - lastUpdateTime) / 1000);

    if (!siteTracking[domain]) {
      siteTracking[domain] = 0;
    }

    siteTracking[domain] += timeSpent;

    // Save to storage
    chrome.storage.local.set({ siteTracking });
  });
}

// Update every minute
setInterval(() => {
  updateSiteTime();
  lastUpdateTime = Date.now();
}, 60000);

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'trackContent') {
    // Track content interaction
    chrome.storage.local.get(['contentHistory'], (result) => {
      const history = result.contentHistory || [];
      history.push({
        ...request.data,
        timestamp: Date.now(),
        site: new URL(sender.tab.url).hostname
      });

      // Keep last 1000 items
      if (history.length > 1000) {
        history.shift();
      }

      chrome.storage.local.set({ contentHistory: history });
    });

    sendResponse({ success: true });
  } else if (request.action === 'getSiteTime') {
    const url = new URL(sender.tab.url);
    const domain = url.hostname;
    sendResponse({ time: siteTracking[domain] || 0 });
  } else if (request.action === 'recordMood') {
    // Record mood check-in
    chrome.storage.local.get(['moodHistory'], (result) => {
      const moods = result.moodHistory || [];
      moods.push({
        mood: request.mood,
        timestamp: Date.now()
      });

      chrome.storage.local.set({ moodHistory: moods });
    });

    sendResponse({ success: true });
  }

  return true; // Keep channel open for async response
});

// Badge updates
function updateBadge() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      const url = new URL(tabs[0].url);
      const domain = url.hostname;
      const time = siteTracking[domain] || 0;
      const minutes = Math.floor(time / 60);

      if (minutes > 0) {
        chrome.action.setBadgeText({ text: minutes.toString() });
        chrome.action.setBadgeBackgroundColor({ color: minutes > 30 ? '#ef4444' : '#6366f1' });
      }
    }
  });
}

setInterval(updateBadge, 10000); // Update badge every 10 seconds
