import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'history.db');

const db = new Database(dbPath);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT,
    title TEXT,
    url TEXT,
    start_time INTEGER,
    end_time INTEGER,
    duration INTEGER
  )
`);

export const insertVisit = (visit) => {
  const stmt = db.prepare(`
    INSERT INTO visits (app_name, title, url, start_time, end_time, duration)
    VALUES (@app_name, @title, @url, @start_time, @end_time, @duration)
  `);
  return stmt.run(visit);
};

export const updateVisit = (id, endTime, duration) => {
  const stmt = db.prepare(`
    UPDATE visits 
    SET end_time = ?, duration = ?
    WHERE id = ?
  `);
  return stmt.run(endTime, duration, id);
};

export const getHistory = (limit = 100, startTime = null, endTime = null) => {
  let query = `SELECT * FROM visits`;
  const params = [];

  if (startTime && endTime) {
    query += ` WHERE start_time >= ? AND start_time <= ?`;
    params.push(startTime, endTime);
  }

  query += ` ORDER BY start_time DESC LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(query);
  return stmt.all(...params);
};

export const getDailyStats = (startTime = null, endTime = null) => {
  // Default to last 24 hours if no range provided
  const defaultStart = Date.now() - 24 * 60 * 60 * 1000;
  const actualStart = startTime || defaultStart;
  const actualEnd = endTime || Date.now();

  // Fetch raw data for all apps
  const stmt = db.prepare(`
    SELECT app_name, title, url, duration
    FROM visits
    WHERE start_time >= ? AND start_time <= ?
  `);

  const visits = stmt.all(actualStart, actualEnd);
  const statsMap = {};
  // Helper to track the "best" title for each key (shortest title is usually the site name)
  const titleMap = {};

  for (const visit of visits) {
    let key = visit.app_name || 'Unknown App'; // Default to App Name
    
    // Broaden browser detection
    const isBrowser = visit.app_name && /chrome|chromium|firefox|edge|brave|opera|safari/i.test(visit.app_name);

    if (isBrowser) {
        let domainFound = false;
        let tempKey = null;

        // 1. Try URL first
        if (visit.url) {
            try {
                const urlObj = new URL(visit.url);
                tempKey = urlObj.hostname;
                domainFound = true;
            } catch (e) {
                // Invalid URL
            }
        } 
        
        // 2. Prepare Title for checking
        let cleanTitle = visit.title || '';
        // Remove common browser suffixes
        const suffixes = [
            ' - Google Chrome', ' - Microsoft Edge', ' - Mozilla Firefox', 
            ' - Brave', ' - Opera', ' - Chromium'
        ];
        for (const suffix of suffixes) {
            if (cleanTitle.endsWith(suffix)) {
                cleanTitle = cleanTitle.slice(0, -suffix.length);
                break;
            }
        }
        
        // 3. Unified Classification
        const checkString = (tempKey ? tempKey : '') + ' ' + cleanTitle;
        const lowerCheck = checkString.toLowerCase();

        if (lowerCheck.includes('bilibili') || lowerCheck.includes('哔哩哔哩') || lowerCheck.includes('b23.tv')) {
            key = 'www.bilibili.com';
        } else if (lowerCheck.includes('youtube')) {
            key = 'www.youtube.com';
        } else if (lowerCheck.includes('github')) {
            key = 'github.com';
        } else if (lowerCheck.includes('zhihu') || lowerCheck.includes('知乎')) {
            key = 'www.zhihu.com';
        } else if (lowerCheck.includes('csdn')) {
            key = 'blog.csdn.net';
        } else if (lowerCheck.includes('stackoverflow')) {
            key = 'stackoverflow.com';
        } else if (lowerCheck.includes('chatgpt')) {
            key = 'chatgpt.com';
        } else {
            // Fallback: If we have a domain, use it. Otherwise use the cleaned title.
            // If the cleaned title is empty, revert to the original app name.
            if (tempKey) {
                key = tempKey;
            } else if (cleanTitle) {
                key = cleanTitle;
            }
        }

        // --- DYNAMIC TITLE UPDATE ---
        // We want to find the "Representative Title" for this key.
        // Usually the shortest title is the main site name (e.g., "GitHub" vs "User/Repo - GitHub").
        // We only update if we have a clean title.
        if (cleanTitle) {
            if (!titleMap[key] || cleanTitle.length < titleMap[key].length) {
                titleMap[key] = cleanTitle;
            }
        }
    }

    if (!statsMap[key]) {
      statsMap[key] = 0;
    }
    statsMap[key] += visit.duration;
  }

  // Convert map to array and sort
  const fixedTitles = {
    'www.bilibili.com': '哔哩哔哩 (Bilibili)',
    'www.youtube.com': 'YouTube',
    'github.com': 'GitHub',
    'www.zhihu.com': '知乎 (Zhihu)',
    'blog.csdn.net': 'CSDN',
    'stackoverflow.com': 'Stack Overflow',
    'chatgpt.com': 'ChatGPT',
    'localhost': 'Daily Monitor Dashboard' // Added this mapping
  };

  const stats = Object.entries(statsMap).map(([key, duration]) => {
    // 1. Check if we have a hardcoded title for this key
    let displayTitle = fixedTitles[key];
    
    // 2. If not, use the shortest title found dynamically
    if (!displayTitle) {
        displayTitle = titleMap[key] || key;
    }
    
    return {
        title: displayTitle,
        original_key: key,
        total_duration: duration
    };
  });

  stats.sort((a, b) => b.total_duration - a.total_duration);

  return stats.slice(0, 20);
};

export default db;
