import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDb } from './db/database.js';
import { seedInitialData } from './db/seedData.js';

import internsRouter from './routes/interns.js';
import tasksRouter from './routes/tasks.js';
import submissionsRouter from './routes/submissions.js';
import reviewsRouter from './routes/reviews.js';
import schedulesRouter from './routes/schedules.js';
import emailRouter from './routes/email.js';
import statsRouter from './routes/stats.js';
import { checkReviewReminders } from './services/calendarService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/api/interns', internsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/email', emailRouter);
app.use('/api/stats', statsRouter);

// Serve client dist bundle if built
import fs from 'fs';
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

// Initialize Database & Start Server
async function startServer() {
  try {
    console.log('[Server] Initializing SQLite database...');
    await getDb();
    await seedInitialData();

    // Start background reminder worker (every 60 seconds)
    setInterval(async () => {
      try {
        await checkReviewReminders();
      } catch (err) {
        console.error('[Scheduler Worker] Reminder check error:', err.message);
      }
    }, 60000);

    app.listen(PORT, () => {
      console.log(`[Server] Backend listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Failed to initialize backend:', err);
    process.exit(1);
  }
}

startServer();
