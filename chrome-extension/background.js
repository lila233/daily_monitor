// Ensure we send data to the correct local server port
const SERVER_URL = 'http://localhost:3001/api/report-url';

async function reportUrl(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (tab && tab.url && tab.active) {
            // Only report if it's a valid http/https URL (skip chrome:// etc. if you want, but logging everything is safer for now)
             if (tab.url.startsWith('http') || tab.url.startsWith('https')) {
                // Send URL to local server
                fetch(SERVER_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        url: tab.url,
                        title: tab.title,
                        timestamp: Date.now()
                    })
                }).catch(err => {
                    // Ignore connection errors (e.g. server not running)
                    // console.log('Failed to report URL:', err);
                });
             }
        }
    } catch (e) {
        // Tab might be closed or inaccessible
    }
}

// Listen for tab activation (switching tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
    reportUrl(activeInfo.tabId);
});

// Listen for URL updates (navigation within a tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
        if (tab.active) {
            reportUrl(tabId);
        }
    }
});

// Listen for window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, windowId });
        if (tab) {
            reportUrl(tab.id);
        }
    } catch (e) {
        // ignore
    }
});
