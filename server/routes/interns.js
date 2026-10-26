import express from 'express';
import { query, get, run, transaction } from '../db/database.js';
import { assignInitialTask, checkInternshipActive } from '../services/reviewCycle.js';

const router = express.Router();

// Email format validator
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/**
 * GET /api/interns
 * Search and filter interns
 */
router.get('/', async (req, res) => {
  try {
    const { search, status, taskId } = req.query;
    let sql = 'SELECT * FROM interns WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR id LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (taskId) {
      sql += ' AND current_task_id = ?';
      params.push(taskId);
    }

    sql += ' ORDER BY created_at DESC;';
    const interns = await query(sql, params);

    // Refresh active status for each
    for (const intern of interns) {
      await checkInternshipActive(intern.id);
    }

    res.json({ success: true, count: interns.length, interns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/interns/:id
 * Get single intern with their assignments, submissions, and reviews
 */
router.get('/:id', async (req, res) => {
  try {
    const intern = await get('SELECT * FROM interns WHERE id = ? OR email = ?;', [req.params.id, req.params.id]);
    if (!intern) {
      return res.status(404).json({ success: false, error: 'Intern not found' });
    }

    // Refresh active check
    const activeCheck = await checkInternshipActive(intern.id);

    const assignments = await query(
      `SELECT a.*, t.title as task_title, t.module 
       FROM assignments a
       JOIN tasks t ON a.task_id = t.id
       WHERE a.intern_id = ?
       ORDER BY a.created_at ASC;`,
      [intern.id]
    );

    const submissions = await query(
      `SELECT s.*, t.title as task_title 
       FROM submissions s
       JOIN tasks t ON s.task_id = t.id
       WHERE s.intern_id = ?
       ORDER BY s.created_at DESC;`,
      [intern.id]
    );

    const reviews = await query(
      `SELECT r.*, t.title as task_title 
       FROM reviews r
       JOIN tasks t ON r.task_id = t.id
       WHERE r.intern_id = ?
       ORDER BY r.created_at DESC;`,
      [intern.id]
    );

    const schedules = await query(
      `SELECT s.*, t.title as task_title 
       FROM review_schedules s
       JOIN tasks t ON s.task_id = t.id
       WHERE s.intern_id = ?
       ORDER BY s.review_date ASC;`,
      [intern.id]
    );

    res.json({
      success: true,
      intern,
      activeStatus: activeCheck,
      assignments,
      submissions,
      reviews,
      schedules
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/interns
 * Create a new intern & automatically assign initial task
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, start_date, duration_days = 10 } = req.body;

    if (!name || !email || !start_date) {
      return res.status(400).json({ success: false, error: 'Name, email, and start_date are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email address format' });
    }

    // Check duplicate
    const existing = await get('SELECT id FROM interns WHERE email = ?;', [cleanEmail]);
    if (existing) {
      return res.status(400).json({ success: false, error: `An intern with email ${cleanEmail} already exists (${existing.id})` });
    }

    // Calculate end date based on duration
    const startDateObj = new Date(start_date);
    if (isNaN(startDateObj.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid start_date format (YYYY-MM-DD expected)' });
    }

    const duration = parseInt(duration_days, 10) || 10;
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(startDateObj.getDate() + duration);
    const end_date = endDateObj.toISOString().split('T')[0];

    const internId = `INT-${Date.now().toString().slice(-4)}`;

    await run(
      `INSERT INTO interns (id, name, email, start_date, end_date, duration_days, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now'), datetime('now'));`,
      [internId, name.trim(), cleanEmail, start_date, end_date, duration]
    );

    const newIntern = await get('SELECT * FROM interns WHERE id = ?;', [internId]);

    // Automatically allocate first active task
    const assignResult = await assignInitialTask(newIntern);

    res.status(201).json({
      success: true,
      intern: newIntern,
      initialAssignment: assignResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/interns/:id
 * Edit intern details
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, email, start_date, end_date, duration_days, status } = req.body;
    const intern = await get('SELECT * FROM interns WHERE id = ?;', [req.params.id]);
    if (!intern) {
      return res.status(404).json({ success: false, error: 'Intern not found' });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : intern.email;
    if (email && !isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    await run(
      `UPDATE interns 
       SET name = ?, email = ?, start_date = ?, end_date = ?, duration_days = ?, status = ?, updated_at = datetime('now')
       WHERE id = ?;`,
      [
        name ? name.trim() : intern.name,
        cleanEmail,
        start_date || intern.start_date,
        end_date || intern.end_date,
        duration_days ? parseInt(duration_days, 10) : intern.duration_days,
        status || intern.status,
        req.params.id
      ]
    );

    const updated = await get('SELECT * FROM interns WHERE id = ?;', [req.params.id]);
    res.json({ success: true, intern: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/interns/import-csv
 * Import interns from CSV text with comprehensive validation & error reporting
 */
router.post('/import-csv', async (req, res) => {
  try {
    const { csvData } = req.body;
    if (!csvData || typeof csvData !== 'string') {
      return res.status(400).json({ success: false, error: 'csvData text string is required' });
    }

    const lines = csvData.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return res.status(400).json({ success: false, error: 'CSV must contain at least a header row and one data row' });
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const nameIdx = headers.findIndex(h => h.includes('name'));
    const emailIdx = headers.findIndex(h => h.includes('email'));
    const startIdx = headers.findIndex(h => h.includes('start'));
    const durationIdx = headers.findIndex(h => h.includes('duration') || h.includes('day'));

    if (nameIdx === -1 || emailIdx === -1) {
      return res.status(400).json({
        success: false,
        error: 'CSV must contain "name" and "email" columns. Optional: "start_date", "duration_days".'
      });
    }

    const results = {
      imported: [],
      skipped: [],
      errors: []
    };

    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
      const name = cols[nameIdx];
      const email = cols[emailIdx] ? cols[emailIdx].toLowerCase() : '';
      const startDate = (startIdx !== -1 && cols[startIdx]) ? cols[startIdx] : todayStr;
      const duration = (durationIdx !== -1 && cols[durationIdx]) ? parseInt(cols[durationIdx], 10) : 10;

      if (!name || !email) {
        results.errors.push({ line: i + 1, error: 'Missing name or email', row: line });
        continue;
      }

      if (!isValidEmail(email)) {
        results.errors.push({ line: i + 1, error: `Invalid email address: "${email}"`, row: line });
        continue;
      }

      // Check duplicate in DB
      const existing = await get('SELECT id FROM interns WHERE email = ?;', [email]);
      if (existing) {
        results.skipped.push({ line: i + 1, email, reason: `Duplicate record already exists (${existing.id})` });
        continue;
      }

      // Calculate end date
      const sDateObj = new Date(startDate);
      const eDateObj = new Date(sDateObj);
      eDateObj.setDate(sDateObj.getDate() + duration);
      const endDate = eDateObj.toISOString().split('T')[0];

      const internId = `INT-${Date.now().toString().slice(-4)}${Math.random().toString(36).substring(2, 4).toUpperCase()}`;

      await run(
        `INSERT INTO interns (id, name, email, start_date, end_date, duration_days, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now'), datetime('now'));`,
        [internId, name, email, startDate, endDate, duration]
      );

      const createdIntern = await get('SELECT * FROM interns WHERE id = ?;', [internId]);
      await assignInitialTask(createdIntern);

      results.imported.push({ id: internId, name, email, start_date: startDate, end_date: endDate });
    }

    res.json({
      success: true,
      summary: {
        totalRows: lines.length - 1,
        importedCount: results.imported.length,
        skippedCount: results.skipped.length,
        errorCount: results.errors.length
      },
      results
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
