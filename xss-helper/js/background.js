// Background service worker for caching XSS payloads
const XSS_PAYLOAD_URL = 'https://raw.githubusercontent.com/payloadbox/xss-payload-list/master/Intruder/xss-payload-list.txt';
const CACHE_KEY = 'xss_payloads_cache';
const CACHE_TIMESTAMP_KEY = 'xss_payloads_timestamp';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Fetch and cache payloads on extension install/update
chrome.runtime.onInstalled.addListener(() => {
  fetchAndCachePayloads();
});

// Fetch payloads from GitHub and cache them
async function fetchAndCachePayloads() {
  try {
    const response = await fetch(XSS_PAYLOAD_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    
    await chrome.storage.local.set({
      [CACHE_KEY]: lines,
      [CACHE_TIMESTAMP_KEY]: Date.now()
    });
    
    return lines;
  } catch (error) {
    console.error('Failed to fetch XSS payloads:', error);
    throw error;
  }
}

// Check if cache is valid
async function isCacheValid() {
  const result = await chrome.storage.local.get([CACHE_TIMESTAMP_KEY]);
  if (!result[CACHE_TIMESTAMP_KEY]) {
    return false;
  }
  return (Date.now() - result[CACHE_TIMESTAMP_KEY]) < CACHE_DURATION;
}

// Get cached payloads or fetch if needed
async function getPayloads() {
  const cacheValid = await isCacheValid();
  
  if (cacheValid) {
    const result = await chrome.storage.local.get([CACHE_KEY]);
    if (result[CACHE_KEY] && result[CACHE_KEY].length > 0) {
      return result[CACHE_KEY];
    }
  }
  
  // Cache is invalid or empty, fetch new data
  return await fetchAndCachePayloads();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPayloads') {
    getPayloads()
      .then(payloads => sendResponse({ success: true, payloads }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
});
