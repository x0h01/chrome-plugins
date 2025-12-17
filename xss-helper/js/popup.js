// Cache for payloads
let cachedPayloads = null;
let cachedLocalPayloads = null;

// Get local payloads from data.txt
async function getLocalPayloads() {
  if (cachedLocalPayloads) {
    return cachedLocalPayloads;
  }
  
  try {
    const res = await fetch(chrome.runtime.getURL('data/data.txt'));
    const text = await res.text();
    cachedLocalPayloads = text.split(/\r?\n/).filter(line => line.trim() !== '');
    return cachedLocalPayloads;
  } catch (error) {
    console.error('Failed to load local payloads:', error);
    throw error;
  }
}

// Show/hide loading state
function setLoadingState(isLoading) {
  const loadingContainer = document.getElementById('loadingContainer');
  const contentContainer = document.getElementById('contentContainer');
  
  if (isLoading) {
    loadingContainer.classList.add('active');
    contentContainer.classList.add('loading');
  } else {
    loadingContainer.classList.remove('active');
    contentContainer.classList.remove('loading');
  }
}

// Show error message
function showError(message) {
  const errorMessage = document.getElementById('errorMessage');
  errorMessage.textContent = message;
  errorMessage.classList.add('active');
  setTimeout(() => {
    errorMessage.classList.remove('active');
  }, 5000);
}

// Get payloads from background service worker
async function getRemotePayloads() {
  if (cachedPayloads) {
    return cachedPayloads;
  }
  
  setLoadingState(true);
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getPayloads' });
    
    if (response.success) {
      cachedPayloads = response.payloads;
      setLoadingState(false);
      return cachedPayloads;
    } else {
      throw new Error(response.error || 'Failed to load payloads');
    }
  } catch (error) {
    setLoadingState(false);
    showError('Failed to load XSS payloads. Please try again.');
    throw error;
  }
}

// Get payloads based on user preference
async function getPayloads() {
  const useRemote = document.getElementById('useRemote').checked;
  
  if (useRemote) {
    return await getRemotePayloads();
  } else {
    return await getLocalPayloads();
  }
}

// Format text based on user preferences
function formatText(text) {
  const removeLineBreaks = document.getElementById('removeLineBreaks').checked;
  if (removeLineBreaks) {
    return text.replace(/\r?\n/g, '');
  }
  return text;
}

function updateCopyRandomLabel() {
  const num = document.getElementById('numLines').value;
  document.getElementById('copyRandom').textContent = `Copy ${num} lines`;
}

function temporarilyChangeButtonLabel(button, newLabel, resetLabelFunc) {
  button.textContent = newLabel;
  button.disabled = true;
  setTimeout(() => {
    resetLabelFunc();
    button.disabled = false;
  }, 2000);
}

// Save preferences to storage
async function savePreferences() {
  const useRemote = document.getElementById('useRemote').checked;
  const removeLineBreaks = document.getElementById('removeLineBreaks').checked;
  const numLines = document.getElementById('numLines').value;
  await chrome.storage.local.set({ useRemote, removeLineBreaks, numLines });
}

// Load preferences from storage
async function loadPreferences() {
  const result = await chrome.storage.local.get(['useRemote', 'removeLineBreaks', 'numLines']);
  if (result.useRemote !== undefined) {
    document.getElementById('useRemote').checked = result.useRemote;
  }
  if (result.removeLineBreaks !== undefined) {
    document.getElementById('removeLineBreaks').checked = result.removeLineBreaks;
  }
  if (result.numLines !== undefined) {
    document.getElementById('numLines').value = result.numLines;
  }
}

// Initialize: Load preferences and payloads on popup open
(async function init() {
  try {
    await loadPreferences();
    await getPayloads();
    // Set initial button label
    updateCopyRandomLabel();
  } catch (error) {
    console.error('Initialization error:', error);
  }
})();

// Listen for changes to the number input
document.getElementById('numLines').addEventListener('input', async () => {
  await savePreferences();
  updateCopyRandomLabel();
});

// Listen for checkbox changes
document.getElementById('useRemote').addEventListener('change', async () => {
  await savePreferences();
  // Clear cache when switching sources
  if (document.getElementById('useRemote').checked) {
    cachedLocalPayloads = null;
  } else {
    cachedPayloads = null;
  }
});

document.getElementById('removeLineBreaks').addEventListener('change', async () => {
  await savePreferences();
});

document.getElementById('copyRandom').addEventListener('click', async () => {
  try {
    const lines = await getPayloads();
    let num = parseInt(document.getElementById('numLines').value, 10);
    num = Math.min(num, lines.length);
    // Create a copy to shuffle without modifying the cached data
    const shuffled = [...lines].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, num).join('\n');
    const formattedText = formatText(selected);
    
    await navigator.clipboard.writeText(formattedText);
    temporarilyChangeButtonLabel(
      document.getElementById('copyRandom'),
      "Copied!",
      updateCopyRandomLabel
    );
  } catch {
    temporarilyChangeButtonLabel(
      document.getElementById('copyRandom'),
      "Copy failed!",
      updateCopyRandomLabel
    );
  }
});

document.getElementById('copyAll').addEventListener('click', async () => {
  try {
    const lines = await getPayloads();
    const allText = lines.join('\n');
    const formattedText = formatText(allText);
    
    await navigator.clipboard.writeText(formattedText);
    temporarilyChangeButtonLabel(
      document.getElementById('copyAll'),
      "Copied all!",
      () => document.getElementById('copyAll').textContent = "Copy All Lines"
    );
  } catch {
    temporarilyChangeButtonLabel(
      document.getElementById('copyAll'),
      "Copy failed!",
      () => document.getElementById('copyAll').textContent = "Copy All Lines"
    );
  }
});
