import express from 'express';
import { query, get, run } from '../db/database.js';
import { scheduleReview, generateIcsFile } from '../services/calendarService.js';

const router = express.Router();

/**
 * GET /api/schedules
 * Return all scheduled review sessions
 */
router.get('/', async (req, res) => {
  try {
    const { internEmail, status } = req.query;
    let sql = `
      SELECT s.*, i.name as intern_name, i.end_date as intern_end_date, t.title as task_title, t.module
      FROM review_schedules s
      JOIN interns i ON s.intern_id = i.id
      JOIN tasks t ON s.task_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (internEmail) {
      sql += ' AND s.intern_email = ?';
      params.push(internEmail.trim().toLowerCase());
    }

    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY s.review_date ASC, s.review_time ASC;';
    const schedules = await query(sql, params);

    res.json({ success: true, count: schedules.length, schedules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/schedules
 * Schedule a new review session
 */
router.post('/', async (req, res) => {
  try {
    const {
      internId,
      internEmail,
      taskId,
      reviewDate,
      reviewTime,
      timezone,
      meetUrl,
      prepInstructions
    } = req.body;

    if ((!internId && !internEmail) || !taskId || !reviewDate || !reviewTime) {
      return res.status(400).json({
        success: false,
        error: 'internEmail/internId, taskId, reviewDate, and reviewTime are required'
      });
    }

    const scheduled = await scheduleReview({
      internId,
      internEmail,
      taskId,
      reviewDate,
      reviewTime,
      timezone,
      meetUrl,
      prepInstructions
    });

    res.status(201).json({ success: true, schedule: scheduled });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/schedules/:id/ics
 * Download standard iCalendar .ics file
 */
router.get('/:id/ics', async (req, res) => {
  try {
    const schedule = await get('SELECT * FROM review_schedules WHERE id = ?;', [req.params.id]);
    if (!schedule) {
      return res.status(404).send('Schedule not found');
    }

    const intern = await get('SELECT * FROM interns WHERE id = ?;', [schedule.intern_id]);
    const task = await get('SELECT * FROM tasks WHERE id = ?;', [schedule.task_id]);

    const icsContent = generateIcsFile({ schedule, task, intern });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="review-${schedule.task_id}-${schedule.review_date}.ics"`);
    res.send(icsContent);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

export default router;
