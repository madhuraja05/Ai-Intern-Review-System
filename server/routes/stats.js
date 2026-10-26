import express from 'express';
import { query, get, run } from '../db/database.js';
import { isRealEmailConfigured } from '../services/emailService.js';

const router = express.Router();

/**
 * GET /api/stats/dashboard
 * Return live SQLite metrics for the executive dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const totalInterns = await get('SELECT COUNT(*) as count FROM interns;');
    const activeInterns = await get('SELECT COUNT(*) as count FROM interns WHERE status = "ACTIVE";');
    const tasksAssigned = await get('SELECT COUNT(*) as count FROM assignments WHERE status = "ASSIGNED";');
    const tasksPassed = await get('SELECT COUNT(*) as count FROM assignments WHERE status = "PASSED";');
    const tasksNeedingChanges = await get('SELECT COUNT(*) as count FROM assignments WHERE status = "NEEDS_CHANGES";');
    const pendingAtEnd = await get('SELECT COUNT(*) as count FROM assignments WHERE status = "PENDING_AT_INTERNSHIP_END";');
    const reviewsPending = await get('SELECT COUNT(*) as count FROM submissions WHERE status = "SUBMITTED";');
    const humanReviewRequired = await get('SELECT COUNT(*) as count FROM reviews WHERE overall_decision = "HUMAN_REVIEW_REQUIRED" AND coordinator_override = 0;');
    const unresolvedAlerts = await get('SELECT COUNT(*) as count FROM coordinator_notifications WHERE is_resolved = 0;');

    // Recent activity feed
    const recentSubmissions = await query(
      `SELECT s.id, s.intern_email, s.task_id, s.status, s.submitted_at, i.name as intern_name 
       FROM submissions s
       JOIN interns i ON s.intern_id = i.id
       ORDER BY s.submitted_at DESC LIMIT 5;`
    );

    const recentReviews = await query(
      `SELECT r.id, r.intern_email, r.task_id, r.overall_decision, r.evaluator_mode, r.reviewed_at, i.name as intern_name
       FROM reviews r
       JOIN interns i ON r.intern_id = i.id
       ORDER BY r.reviewed_at DESC LIMIT 5;`
    );

    const aiProvider = process.env.GEMINI_API_KEY
      ? 'GEMINI_1.5_FLASH'
      : (process.env.OPENAI_API_KEY ? 'OPENAI_GPT_4O_MINI' : 'DEMO_DETERMINISTIC');

    res.json({
      success: true,
      metrics: {
        totalInterns: totalInterns?.count || 0,
        activeInterns: activeInterns?.count || 0,
        tasksAssigned: tasksAssigned?.count || 0,
        tasksPassed: tasksPassed?.count || 0,
        tasksNeedingChanges: tasksNeedingChanges?.count || 0,
        internshipEndEscalations: (pendingAtEnd?.count || 0) + (unresolvedAlerts?.count || 0),
        reviewsPending: (reviewsPending?.count || 0) + (humanReviewRequired?.count || 0),
        pendingAtEnd: pendingAtEnd?.count || 0,
        unresolvedAlerts: unresolvedAlerts?.count || 0
      },
      system: {
        aiProvider,
        isAiDemo: aiProvider === 'DEMO_DETERMINISTIC',
        realEmailConfigured: isRealEmailConfigured()
      },
      recentSubmissions,
      recentReviews
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/stats/coordinator-notifications
 * List coordinator escalations queue
 */
router.get('/coordinator-notifications', async (req, res) => {
  try {
    const notifications = await query(
      'SELECT * FROM coordinator_notifications ORDER BY is_resolved ASC, created_at DESC;'
    );
    res.json({ success: true, count: notifications.length, notifications });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/stats/coordinator-notifications/:id/resolve
 * Mark a notification resolved
 */
router.post('/coordinator-notifications/:id/resolve', async (req, res) => {
  try {
    await run('UPDATE coordinator_notifications SET is_resolved = 1 WHERE id = ?;', [req.params.id]);
    res.json({ success: true, message: 'Notification resolved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/settings
 * Fetch system configuration settings
 */
router.get('/settings', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM system_settings;');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    res.json({
      success: true,
      settings,
      envState: {
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
        anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
        gmailConfigured: isRealEmailConfigured(),
        adminEmail: process.env.ADMIN_EMAIL || settings.ADMIN_EMAIL || 'coordinator@company.com'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/settings
 * Update system configuration settings
 */
router.post('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'settings object required' });
    }

    for (const [key, value] of Object.entries(settings)) {
      const existing = await get('SELECT key FROM system_settings WHERE key = ?;', [key]);
      if (existing) {
        await run('UPDATE system_settings SET value = ?, updated_at = datetime("now") WHERE key = ?;', [String(value), key]);
      } else {
        await run('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime("now"));', [key, String(value)]);
      }
    }

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
