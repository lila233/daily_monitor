import activeWin from 'active-win';
import { insertVisit, updateVisit } from './db.js';

let currentSession = null;

// Store latest data from Chrome Extension
let lastExtensionData = {
    url: null,
    title: null,
    timestamp: 0
};

export function setBrowserActivity(data) {
    lastExtensionData = {
        url: data.url,
        title: data.title,
        timestamp: Date.now()
    };
}

function getSessionKey(win) {
    const app = win.owner.name;
    const title = win.title;
    const isBrowser = /chrome|chromium|firefox|edge|brave|opera|safari/i.test(app);

    if (isBrowser) {
        // 1. Try URL (Preferred: from active-win or extension fallback)
        if (win.url) {
            try {
                // Use full URL and Title to distinguish specific pages/tabs
                new URL(win.url);
                return `${win.url}:::${title}`;
            } catch (e) {
                // ignore invalid url
            }
        }

        // 2. Fallback: Distinct Title
        return `${app}:::${title}`;
    }

    // Non-browser
    return `${app}:::${title}`;
}

async function checkWindow() {
  try {
    const win = await activeWin();
    
    if (!win) return;

    // --- INTEGRATION WITH EXTENSION ---
    const isBrowser = /chrome|chromium|firefox|edge|brave|opera|safari/i.test(win.owner.name);
    // If it's a browser, and active-win didn't give us a URL, try to use the one from the extension
    if (isBrowser && !win.url) {
        // We only use extension data if it's somewhat fresh (e.g., within last 5 seconds of activity? 
        // Actually, since we only push on change, checking 'freshness' is hard.
        // Instead, we trust it if the browser is focused. 
        // Limitation: If user has multiple browser windows, extension handles focus change, so 'lastExtensionData' should be correct.
        if (lastExtensionData.url) {
            win.url = lastExtensionData.url;
            // Optionally update title too if active-win's title is generic
            if (lastExtensionData.title) {
                win.title = lastExtensionData.title; 
            }
        }
    }
    // ----------------------------------

    const now = Date.now();
    const newKey = getSessionKey(win);
    
    // If we are tracking a session
    if (currentSession) {
      // Check if it's the same session (key match)
      if (currentSession.key === newKey) {
        // Just update the duration in memory and DB
        currentSession.end_time = now;
        currentSession.duration = currentSession.end_time - currentSession.start_time;
        
        // Update DB periodically (every check) to save progress
        updateVisit(currentSession.id, currentSession.end_time, currentSession.duration);
      } else {
        // Switched to a different context
        currentSession = null; // Clear session
      }
    }

    // If no current session (either fresh start or just closed one), start a new one
    if (!currentSession) {
        const newVisit = {
            app_name: win.owner.name,
            title: win.title,
            url: win.url || '', // URL might be undefined on Windows without extra perms
            start_time: now,
            end_time: now,
            duration: 0
        };
        
        const info = insertVisit(newVisit);
        // Store the key in memory so we can compare next time
        currentSession = { ...newVisit, id: info.lastInsertRowid, key: newKey };
        console.log(`[Monitor] Started: ${win.owner.name} - ${win.title} (Key: ${newKey})`);
    }

  } catch (error) {
    // active-win might fail if permissions are missing or system is locked
    // console.error('Error getting active window:', error);
  }
}

export function startMonitor() {
  console.log('Starting monitoring...');
  setInterval(checkWindow, 1000); // Check every 1 second
}
