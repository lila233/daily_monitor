import activeWin from 'active-win';
import { insertVisit, updateVisit } from './db.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn, execFile } from 'child_process';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const IDLE_CHECK_EXE = join(__dirname, 'tools', 'IdleCheck.exe');
const GAMEPAD_CHECK_EXE = join(__dirname, 'tools', 'GamepadCheck.exe');
const MEDIA_CHECK_PS1 = join(__dirname, 'tools', 'MediaCheck.ps1');
const IDLE_THRESHOLD_SECONDS = 120; // 2 minutes
const MEDIA_CHECK_INTERVAL_MS = 5000; // Check media status every 5 seconds (less frequent to reduce overhead)
const GAMEPAD_CHECK_INTERVAL_MS = 1000; // Check gamepad every 1 second
const DB_UPDATE_INTERVAL_MS = 900; // Update DB every ~1 second (real-time)

// --- Persistent Idle Check Process ---
let idleProcess = null;
let idleResolver = null;

// --- Media Playing State ---
let isMediaPlaying = false;
let lastMediaCheck = 0;

// --- Gamepad State ---
let gamepadProcess = null;
let gamepadResolver = null;
let isGamepadActive = false;
let lastGamepadCheck = 0;

function startGamepadProcess() {
    gamepadProcess = spawn(GAMEPAD_CHECK_EXE);

    const rl = readline.createInterface({
        input: gamepadProcess.stdout,
        terminal: false
    });

    rl.on('line', (line) => {
        if (gamepadResolver) {
            // Parse "connected,active" format
            const parts = line.trim().split(',');
            const connected = parts[0] === 'true';
            const active = parts[1] === 'true';
            gamepadResolver({ connected, active });
            gamepadResolver = null;
        }
    });

    gamepadProcess.stderr.on('data', (data) => {
        console.error(`GamepadCheck Error: ${data}`);
    });

    gamepadProcess.on('close', (code) => {
        console.log(`GamepadCheck process exited with code ${code}. Restarting...`);
        setTimeout(startGamepadProcess, 1000);
    });
}

// Start gamepad process
startGamepadProcess();

function getGamepadState() {
    return new Promise((resolve) => {
        if (!gamepadProcess || gamepadProcess.killed) {
            resolve({ connected: false, active: false });
            return;
        }
        gamepadResolver = resolve;
        try {
            gamepadProcess.stdin.write("check\n");
        } catch (e) {
            resolve({ connected: false, active: false });
        }
    });
}

// Periodically update gamepad state
async function updateGamepadState() {
    const now = Date.now();
    if (now - lastGamepadCheck > GAMEPAD_CHECK_INTERVAL_MS) {
        const state = await getGamepadState();
        isGamepadActive = state.active;
        lastGamepadCheck = now;
    }
    return isGamepadActive;
}

function checkMediaPlaying() {
    return new Promise((resolve) => {
        execFile('powershell', [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', MEDIA_CHECK_PS1
        ], { timeout: 3000 }, (error, stdout) => {
            if (error) {
                resolve(false);
                return;
            }
            resolve(stdout.trim().toLowerCase() === 'true');
        });
    });
}

// Periodically update media playing state (less frequent to reduce overhead)
async function updateMediaState() {
    const now = Date.now();
    if (now - lastMediaCheck > MEDIA_CHECK_INTERVAL_MS) {
        isMediaPlaying = await checkMediaPlaying();
        lastMediaCheck = now;
    }
    return isMediaPlaying;
}

function startIdleProcess() {
    idleProcess = spawn(IDLE_CHECK_EXE);
    
    const rl = readline.createInterface({
        input: idleProcess.stdout,
        terminal: false
    });

    rl.on('line', (line) => {
        if (idleResolver) {
            const seconds = parseInt(line.trim(), 10);
            idleResolver(isNaN(seconds) ? 0 : seconds);
            idleResolver = null;
        }
    });

    idleProcess.stderr.on('data', (data) => {
        console.error(`IdleCheck Error: ${data}`);
    });

    idleProcess.on('close', (code) => {
        console.log(`IdleCheck process exited with code ${code}. Restarting...`);
        setTimeout(startIdleProcess, 1000);
    });
}

// Start the process immediately
startIdleProcess();

function getIdleTimeSeconds() {
    return new Promise((resolve) => {
        if (!idleProcess || idleProcess.killed) {
            resolve(0);
            return;
        }
        // Queue the resolver
        idleResolver = resolve;
        // Trigger a check
        try {
            idleProcess.stdin.write("check\n");
        } catch (e) {
            resolve(0);
        }
    });
}
// -------------------------------------

let currentSession = null;
let lastDbUpdate = 0;

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
    // 1. Check Idle Time First (Async now)
    const idleSeconds = await getIdleTimeSeconds();

    // 2. Check if media is playing (skip idle detection if media is playing)
    const mediaPlaying = await updateMediaState();

    // 3. Check if gamepad has activity (skip idle detection if gamepad is active)
    const gamepadActive = await updateGamepadState();

    // Only consider idle if: idle time exceeded AND no media is playing AND no gamepad activity
    if (idleSeconds > IDLE_THRESHOLD_SECONDS && !mediaPlaying && !gamepadActive) {
        if (currentSession) {
             // User has been idle for a while.
             // Correct the end time to when they actually stopped (now - idle)
             const actualEndTime = Date.now() - (idleSeconds * 1000);

             // Only update if actualEndTime is after start_time (sanity check)
             if (actualEndTime > currentSession.start_time) {
                 currentSession.end_time = actualEndTime;
                 currentSession.duration = currentSession.end_time - currentSession.start_time;
                 // Force save on session end
                 updateVisit(currentSession.id, currentSession.end_time, currentSession.duration);
             }

             console.log(`[Monitor] Idle for ${idleSeconds}s. Stopping session.`);
             currentSession = null;
        }
        // If no session, stay idle.
        return;
    }

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
        // Just update the duration in memory
        currentSession.end_time = now;
        currentSession.duration = currentSession.end_time - currentSession.start_time;
        
        // Debounce DB updates: only update DB every 10 seconds or so
        if (now - lastDbUpdate > DB_UPDATE_INTERVAL_MS) {
             updateVisit(currentSession.id, currentSession.end_time, currentSession.duration);
             lastDbUpdate = now;
        }

      } else {
        // Switched to a different context
        // Finalize previous session in DB
        updateVisit(currentSession.id, currentSession.end_time, currentSession.duration);
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
        lastDbUpdate = now;
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
