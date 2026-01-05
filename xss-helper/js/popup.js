// Cache for payloads (in-memory)
let cachedPayloads = null;

// Get extension version from manifest
function getExtensionVersion() {
    return chrome.runtime.getManifest().version;
}

// Load payloads from file
async function loadPayloadsFromFile() {
    const res = await fetch(chrome.runtime.getURL('data/data.txt'));
    const text = await res.text();
    return text.split(/\r?\n/).filter(line => line.trim() !== '');
}

// Get payloads with version-based caching
async function getPayloads() {
    // Return immediately if already in memory
    if (cachedPayloads) {
        return cachedPayloads;
    }

    const currentVersion = getExtensionVersion();
    const storage = await chrome.storage.local.get(['payloads', 'payloadsVersion']);

    // Check if cached in storage and version matches
    if (storage.payloads && storage.payloadsVersion === currentVersion) {
        cachedPayloads = storage.payloads;
        return cachedPayloads;
    }

    // Load from file and update storage if not cached or version mismatch
    const payloads = await loadPayloadsFromFile();
    cachedPayloads = payloads;
    await chrome.storage.local.set({
        payloads: payloads,
        payloadsVersion: currentVersion
    });

    return cachedPayloads;
}

// Format text based on user preferences
function formatText(text) {
    const removeLineBreaks = document.getElementById('removeLineBreaks').checked;
    if (removeLineBreaks) {
        return text.replace(/\r?\n/g, '');
    }
    return text;
}

// Update the label of the "Copy Random" button
function updateCopyRandomLabel() {
    const num = document.getElementById('numLines').value;
    document.getElementById('copyRandom').textContent = `Copy ${num} lines`;
}

// Temporarily change button label and disable it (used when copying to clipboard)
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
    const removeLineBreaks = document.getElementById('removeLineBreaks').checked;
    const numLines = document.getElementById('numLines').value;
    await chrome.storage.local.set({ removeLineBreaks, numLines });
}

// Load preferences from storage
async function loadPreferences() {
    const result = await chrome.storage.local.get(['removeLineBreaks', 'numLines']);
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

/*
 EVENTS LISTENERS
 */

document.getElementById('numLines').addEventListener('input', async () => {
    await savePreferences();
    updateCopyRandomLabel();
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
