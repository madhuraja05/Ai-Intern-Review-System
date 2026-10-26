import express from 'express';
import { query, get, run } from '../db/database.js';
import { checkInternshipActive, processSubmissionReview } from '../services/reviewCycle.js';

const router = express.Router();

/**
 * GET /api/submissions
 * List submissions with optional filter by internEmail or taskId
 */
router.get('/', async (req, res) => {
  try {
    const { internEmail, taskId, status } = req.query;
    let sql = `
      SELECT s.*, i.name as intern_name, t.title as task_title, r.overall_decision, r.evaluator_mode
      FROM submissions s
      JOIN interns i ON s.intern_id = i.id
      JOIN tasks t ON s.task_id = t.id
      LEFT JOIN reviews r ON s.review_id = r.id
      WHERE 1=1
    `;
    const params = [];

    if (internEmail) {
      sql += ' AND s.intern_email = ?';
      params.push(internEmail.trim().toLowerCase());
    }

    if (taskId) {
      sql += ' AND s.task_id = ?';
      params.push(taskId.trim().toUpperCase());
    }

    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY s.submitted_at DESC;';
    const submissions = await query(sql, params);
    res.json({ success: true, count: submissions.length, submissions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/submissions/:id
 * Retrieve submission with associated review
 */
router.get('/:id', async (req, res) => {
  try {
    const submission = await get(
      `SELECT s.*, i.name as intern_name, t.title as task_title, t.requirements as task_requirements
       FROM submissions s
       JOIN interns i ON s.intern_id = i.id
       JOIN tasks t ON s.task_id = t.id
       WHERE s.id = ?;`,
      [req.params.id]
    );

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    let review = null;
    if (submission.review_id) {
      review = await get('SELECT * FROM reviews WHERE id = ?;', [submission.review_id]);
      if (review) {
        review.requirement_findings = JSON.parse(review.requirement_findings || '[]');
      }
    }

    res.json({
      success: true,
      submission: {
        ...submission,
        task_requirements: JSON.parse(submission.task_requirements || '[]')
      },
      review
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/submissions
 * Submit task work.
 * Validates intern email AND task ID together.
 * Triggers automated AI review cycle immediately.
 */
router.post('/', async (req, res) => {
  try {
    const { internEmail, taskId, text_content, repo_url, evidence_notes, autoEvaluate = true } = req.body;

    if (!internEmail || !taskId) {
      return res.status(400).json({ success: false, error: 'internEmail and taskId are required' });
    }

    const cleanEmail = internEmail.trim().toLowerCase();
    const cleanTaskId = taskId.trim().toUpperCase();

    // 1. Validate Intern
    const intern = await get('SELECT * FROM interns WHERE email = ?;', [cleanEmail]);
    if (!intern) {
      return res.status(404).json({ success: false, error: `Intern with email ${cleanEmail} is not registered in the system` });
    }

    // 2. Validate Task
    const task = await get('SELECT * FROM tasks WHERE id = ?;', [cleanTaskId]);
    if (!task) {
      return res.status(404).json({ success: false, error: `Task ${cleanTaskId} does not exist in task library` });
    }

    // 3. Validate specific assignment (Email + TaskId compound check)
    const assignment = await get(
      'SELECT * FROM assignments WHERE intern_email = ? AND task_id = ?;',
      [cleanEmail, cleanTaskId]
    );

    if (!assignment) {
      return res.status(400).json({
        success: false,
        error: `Intern ${cleanEmail} is not currently assigned to task ${cleanTaskId}. Assignment must be created first.`
      });
    }

    if (assignment.status === 'PASSED') {
      return res.status(400).json({
        success: false,
        error: `Task ${cleanTaskId} has already been marked as PASSED for this intern.`
      });
    }

    // 4. Validate internship active status
    const { active, reason } = await checkInternshipActive(intern.id);
    if (!active) {
      return res.status(400).json({ success: false, error: `Cannot submit work: ${reason}` });
    }

    if (!text_content && !repo_url && !evidence_notes) {
      return res.status(400).json({
        success: false,
        error: 'Please provide submission content, code text, evidence notes, or a repository link.'
      });
    }

    const submissionId = `SUB-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // 5. Store submission
    await run(
      `INSERT INTO submissions (id, intern_id, intern_email, task_id, text_content, repo_url, evidence_notes, submitted_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 'SUBMITTED', datetime('now'));`,
      [
        submissionId,
        intern.id,
        intern.email,
        task.id,
        text_content || '',
        repo_url || '',
        evidence_notes || ''
      ]
    );

    // 6. Execute AI Review Cycle
    let reviewResult = null;
    if (autoEvaluate) {
      reviewResult = await processSubmissionReview({ submissionId });
    }

    res.status(201).json({
      success: true,
      submissionId,
      internEmail: intern.email,
      taskId: task.id,
      review: reviewResult
    });
  } catch (err) {
    console.error('[Submissions] Error processing submission:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
