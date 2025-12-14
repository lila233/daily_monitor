import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { startMonitor, setBrowserActivity } from './monitor.js';
import { getHistory, getDailyStats } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
const staticPath = path.join(__dirname, '../client/dist');
console.log('Serving static files from:', staticPath);
app.use(express.static(staticPath));

// API Endpoints
app.post('/api/report-url', (req, res) => {
    try {
        const { url, title } = req.body;
        if (url) {
            setBrowserActivity({ url, title });
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Missing URL' });
        }
    } catch (error) {
        console.error('Error reporting URL:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/history', (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const startTime = req.query.startTime ? parseInt(req.query.startTime) : null;
    const endTime = req.query.endTime ? parseInt(req.query.endTime) : null;
    const history = getHistory(limit, startTime, endTime);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', (req, res) => {
    try {
        const startTime = req.query.startTime ? parseInt(req.query.startTime) : null;
        const endTime = req.query.endTime ? parseInt(req.query.endTime) : null;
        const stats = getDailyStats(startTime, endTime);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../client/dist/index.html');
  console.log('Serving index.html from:', indexPath);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send(err.message);
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  // Start the background monitor
  startMonitor();
});
