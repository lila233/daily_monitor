import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'history.db');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

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

// Helper to determine the key for a visit
export const getVisitKey = (visit) => {
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
      } else if (lowerCheck.includes('daily monitor') || lowerCheck.includes('localhost')) {
          key = 'localhost';
      } else if (lowerCheck.includes('linux do') || lowerCheck.includes('linux.do')) {
          key = 'linux.do';
      } else if (lowerCheck.includes('claude')) {
          key = 'claude.ai';
      } else {
          // Fallback: If we have a domain, use it. Otherwise use the cleaned title.
          // If the cleaned title is empty, revert to the original app name.
          if (tempKey) {
              key = tempKey;
          } else if (cleanTitle) {
              key = cleanTitle;
          }
      }
  }
  return key;
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
  const visits = stmt.all(...params);
  
  // Add original_key to each visit
  return visits.map(visit => ({
    ...visit,
    original_key: getVisitKey(visit)
  }));
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
  // Collect all titles for each key to analyze patterns
  const titlesMap = {};

  for (const visit of visits) {
    const key = getVisitKey(visit);

    let cleanTitle = visit.title || '';
    if (visit.app_name && /chrome|chromium|firefox|edge|brave|opera|safari/i.test(visit.app_name)) {
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
    }

    // Collect all titles for this key
    if (cleanTitle) {
        if (!titlesMap[key]) {
            titlesMap[key] = [];
        }
        titlesMap[key].push(cleanTitle);
    }

    if (!statsMap[key]) {
      statsMap[key] = 0;
    }
    statsMap[key] += visit.duration;
  }

  // Helper function to extract site name from titles by finding common suffix/prefix
  const extractSiteName = (titles) => {
    if (!titles || titles.length === 0) return null;

    // Common separators used in page titles
    const separators = [' - ', ' | ', ' – ', ' — ', ' :: ', ' » ', ' · '];

    // Count suffix occurrences (text after last separator)
    const suffixCount = {};
    // Count prefix occurrences (text before first separator)
    const prefixCount = {};

    for (const title of titles) {
      // Try each separator
      for (const sep of separators) {
        const lastIdx = title.lastIndexOf(sep);
        if (lastIdx !== -1) {
          const suffix = title.slice(lastIdx + sep.length).trim();
          if (suffix && suffix.length > 1 && suffix.length < 50) {
            suffixCount[suffix] = (suffixCount[suffix] || 0) + 1;
          }
        }

        const firstIdx = title.indexOf(sep);
        if (firstIdx !== -1) {
          const prefix = title.slice(0, firstIdx).trim();
          if (prefix && prefix.length > 1 && prefix.length < 50) {
            prefixCount[prefix] = (prefixCount[prefix] || 0) + 1;
          }
        }
      }
    }

    // Find the most common suffix (usually the site name)
    let bestSuffix = null;
    let bestSuffixCount = 0;
    for (const [suffix, count] of Object.entries(suffixCount)) {
      // Must appear in at least 30% of titles or at least 2 times
      if (count > bestSuffixCount && (count >= 2 || count / titles.length >= 0.3)) {
        bestSuffix = suffix;
        bestSuffixCount = count;
      }
    }

    // Find the most common prefix
    let bestPrefix = null;
    let bestPrefixCount = 0;
    for (const [prefix, count] of Object.entries(prefixCount)) {
      if (count > bestPrefixCount && (count >= 2 || count / titles.length >= 0.3)) {
        bestPrefix = prefix;
        bestPrefixCount = count;
      }
    }

    // Prefer suffix (more common pattern: "Article Title - Site Name")
    // But if prefix appears more often, use that
    if (bestSuffixCount >= bestPrefixCount && bestSuffix) {
      return bestSuffix;
    } else if (bestPrefix) {
      return bestPrefix;
    }

    // Fallback: return the shortest title (likely the homepage)
    let shortest = titles[0];
    for (const t of titles) {
      if (t.length < shortest.length) {
        shortest = t;
      }
    }
    return shortest;
  };

  // Fixed titles for well-known sites (override auto-detection)
  const fixedTitles = {
    'www.bilibili.com': '哔哩哔哩',
    'www.youtube.com': 'YouTube',
    'github.com': 'GitHub',
    'www.zhihu.com': '知乎',
    'blog.csdn.net': 'CSDN',
    'stackoverflow.com': 'Stack Overflow',
    'chatgpt.com': 'ChatGPT',
    'claude.ai': 'Claude',
    'www.google.com': 'Google',
    'localhost': 'Daily Monitor'
  };

  const stats = Object.entries(statsMap).map(([key, duration]) => {
    let displayTitle;

    // 1. Check if we have a hardcoded title for this key
    if (fixedTitles[key]) {
      displayTitle = fixedTitles[key];
    }
    // 2. For domains (contains dot), try to auto-detect site name
    else if (key.includes('.')) {
      // Try to extract site name from title patterns
      if (titlesMap[key] && titlesMap[key].length > 0) {
        displayTitle = extractSiteName(titlesMap[key]);
      }
      // Fallback: extract site name from domain
      if (!displayTitle) {
        let domain = key.replace(/^www\./, '');
        const siteName = domain.split('.')[0];
        displayTitle = siteName.charAt(0).toUpperCase() + siteName.slice(1);
      }
    }
    // 3. For apps (no dot), use the key directly (it's the app name)
    else {
      displayTitle = key;
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
