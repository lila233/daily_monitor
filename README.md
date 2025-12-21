# Daily Monitor (Usage Tracker)

An automated, local-first system to track your daily computer usage, visualizing active applications and website visits. Designed for Windows with minimal performance impact.

## 🏗 Project Architecture

The system consists of three main components:

### 1. Server (Node.js)
- **Location**: `/server`
- **Role**: The core controller.
- **Key Features**:
  - **Window Tracking**: Uses `active-win` to poll the currently active window every **1 second**.
  - **Idle Detection**: Spawns a lightweight C# subprocess (`IdleCheck.exe`) to detect system-wide inactivity. If inactive for **120 seconds**, tracking is paused.
  - **Persistence**: Stores data in a local SQLite database (`server/history.db`).
    - **Optimization**: Uses **WAL mode** (Write-Ahead Logging) for non-blocking I/O.
    - **Debouncing**: Writes to disk every **10 seconds** to minimize disk wear and lag.
  - **API**: Provides REST endpoints (`/api/stats`, `/api/history`) for the frontend and receives URL updates from the Chrome Extension.

### 2. Client (React + Vite)
- **Location**: `/client`
- **Role**: Visual dashboard for data analysis.
- **Key Features**:
  - **Tech Stack**: React, Recharts, Axios.
  - **Smart Polling**: Polls data every **3 seconds** ONLY when the tab is visible. Automatically hibernates when backgrounded (zero resource usage while gaming).
  - **Visuals**: Provides Pie charts and Bar charts for daily usage distribution.

### 3. Chrome Extension
- **Location**: `/chrome-extension`
- **Role**: Enhances tracking granularity.
- **Function**: Since getting browser URLs from the OS level is restricted/unreliable, this extension pushes the current Tab URL and Title to the local server (`http://localhost:3001`) whenever you switch tabs or navigate.

---

## 🚀 Setup & Deployment

### Prerequisites
- **Node.js**: v16+ installed.
- **Windows OS**: Required for `active-win` and `IdleCheck.exe` (native Windows API usage).

### Installation

1.  **Install Root Dependencies (Server)**:
    ```bash
    npm install
    ```

2.  **Install Client Dependencies**:
    ```bash
    cd client
    npm install
    ```

3.  **Build the Client**:
    ```bash
    cd client
    npm run build
    ```
    *(The server is configured to serve the `client/dist` folder statically at `http://localhost:3001`)*

4.  **Setup Chrome Extension**:
    - Open Chrome and go to `chrome://extensions/`.
    - Enable **Developer mode** (top right).
    - Click **Load unpacked**.
    - Select the `chrome-extension` folder in this project.

### Running the Project

#### Option A: Background Mode (Recommended for Daily Use)
Double-click the **`run_monitor_bg.vbs`** script in the root directory.
- This will start the server silently without opening a terminal window.
- The dashboard will be available at `http://localhost:3001`.

#### Option B: Foreground Mode (For Debugging)
Run the following command in the root directory:
```bash
npm start
```

### Stopping the Monitor
Double-click **`stop_monitor.bat`** to gracefully kill the Node.js process.

---

## 🛠 Performance & Configuration Details

To ensure the monitor does not affect high-performance tasks (e.g., gaming), several optimizations are hardcoded:

- **Idle Logic**: `server/monitor.js`
  - `IDLE_THRESHOLD_SECONDS = 120`: Stops tracking after 2 minutes of no input.
  - `IdleCheck.exe`: A persistent C# background process communicates via StdIO, avoiding the overhead of spawning new processes repeatedly.
  - **Media Playing Detection**: Uses `MediaCheck.ps1` (PowerShell + WinRT API) to detect if any media is playing. When media is playing (e.g., watching videos, listening to music), idle detection is bypassed to prevent false positives.
  - **Gamepad Detection**: Uses `GamepadCheck.exe` (XInput API) to detect Xbox/XInput-compatible controller activity. When gamepad buttons are pressed or sticks are moved, idle detection is bypassed.

  - **Polling Frequencies**:
  - **Active Window**: Every **1000ms** (1s).
  - **Database Write**: Every **~1000ms** (1s) debounced.
  - **Frontend Fetch**: Every **1000ms** (1s), auto-pauses when hidden.
- **Database**:
  - `server/db.js`: `PRAGMA journal_mode = WAL` is enabled to prevent read/write locks.

---

## 📂 Key Files Reference

- `server/monitor.js`: Main logic for active window polling and session management.
- `server/tools/IdleCheck.cs`: Source code for the idle detection tool (keyboard/mouse input).
- `server/tools/MediaCheck.ps1`: PowerShell script for media playback detection.
- `server/tools/GamepadCheck.cs`: Source code for gamepad input detection.
- `server/db.js`: Database schema and query logic (including domain classification rules).
- `client/src/App.jsx`: Main frontend component handling data visualization and smart polling logic.