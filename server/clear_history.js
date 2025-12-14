import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'history.db');

const db = new Database(dbPath);

try {
  db.exec('DELETE FROM visits');
  console.log('All history records cleared successfully.');
} catch (error) {
  console.error('Error clearing history:', error);
} finally {
  db.close();
}
