import express from 'express';
import { query, get, run } from '../db/database.js';
import { processSubmissionReview } from '../services/reviewCycle.js';
import { sendAdminReviewReport } from '../services/emailService.js';

const router = express.Router();

/**
 * GET /api/reviews
 * Return reviews list with filter by intern, task, decision, evaluator mode.
 * Safe & read-only: Viewing or refreshing does NOT send emails.
 */
router.get('/', async (req, res) => {
  try {
    const { internEmail, taskId, decision, evaluatorMode } = req.query;
    let sql = `
      SELECT r.*, i.name as intern_name, t.title as task_title, t.module 
      FROM reviews r
      JOIN interns i ON r.intern_id = i.id
      JOIN tasks t ON r.task_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (internEmail) {
      sql += ' AND r.intern_email = ?';
      params.push(internEmail.trim().toLowerCase());
    }

    if (taskId) {
      sql += ' AND r.task_id = ?';
      params.push(taskId.trim().toUpperCase());
    }

    if (decision) {
      sql += ' AND r.overall_decision = ?';
      params.push(decision);
    }

    if (evaluatorMode) {
      sql += ' AND r.evaluator_mode = ?';
      params.push(evaluatorMode);
    }

    sql += ' ORDER BY r.reviewed_at DESC;';
    const reviews = await query(sql, params);

    res.json({
      success: true,
      count: reviews.length,
      reviews: reviews.map(r => ({
        ...r,
        requirement_findings: JSON.parse(r.requirement_findings || '[]')
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/reviews/:id
 * Retrieve single review with full details.
 * Safe & read-only: Viewing or refreshing does NOT send emails.
 */
router.get('/:id', async (req, res) => {
  try {
    const review = await get(
      `SELECT r.*, i.name as intern_name, t.title as task_title, t.module, t.requirements as original_task_requirements
       FROM reviews r
       JOIN interns i ON r.intern_id = i.id
       JOIN tasks t ON r.task_id = t.id
       WHERE r.id = ?;`,
      [req.params.id]
    );

    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    res.json({
      success: true,
      review: {
        ...review,
        requirement_findings: JSON.parse(review.requirement_findings || '[]'),
        original_task_requirements: JSON.parse(review.original_task_requirements || '[]')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Handler for saving a review and automatically dispatching review details to ADMIN_EMAIL in server/.env
 */
async function handleSaveReview(req, res) {
  try {
    const {
      submissionId,
      internId,
      internEmail,
      taskId,
      overallDecision,
      decision,
      mentorFeedback,
      requirementFindings,
      missingFunctionality,
      internalReport,
      evaluatorMode,
      confidenceNotes,
      reviewDate
    } = req.body;

    // 1. If only submissionId is passed (or evaluate flag), delegate to processSubmissionReview
    if (submissionId && !overallDecision && !decision && !mentorFeedback) {
      const result = await processSubmissionReview({ submissionId });
      return res.status(201).json({ success: true, result });
    }

    // 2. Resolve Intern
    let intern = null;
    if (internId) {
      intern = await get('SELECT * FROM interns WHERE id = ?;', [internId]);
    } else if (internEmail) {
      intern = await get('SELECT * FROM interns WHERE email = ?;', [internEmail.trim().toLowerCase()]);
    } else if (submissionId) {
      const sub = await get('SELECT intern_id FROM submissions WHERE id = ?;', [submissionId]);
      if (sub) {
        intern = await get('SELECT * FROM interns WHERE id = ?;', [sub.intern_id]);
      }
    }

    if (!intern) {
      return res.status(400).json({
        success: false,
        error: 'Intern not found. Please provide valid internEmail, internId, or submissionId.'
      });
    }

    // 3. Resolve Task
    let targetTaskId = taskId;
    if (!targetTaskId && submissionId) {
      const sub = await get('SELECT task_id FROM submissions WHERE id = ?;', [submissionId]);
      targetTaskId = sub?.task_id;
    }
    if (!targetTaskId) {
      targetTaskId = intern.current_task_id;
    }

    const task = targetTaskId ? await get('SELECT * FROM tasks WHERE id = ?;', [targetTaskId]) : null;
    if (!task) {
      return res.status(400).json({ success: false, error: 'Task not found. Please provide valid taskId.' });
    }

    const finalDecision = overallDecision || decision || 'PASS';
    const finalMentorFeedback = mentorFeedback || `Good progress on ${task.id}. Your review has been recorded.`;
    const finalReviewDate = reviewDate || new Date().toISOString();
    const reviewId = `REV-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const actualSubId = submissionId || `SUB-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Ensure submission record exists
    const existingSub = await get('SELECT id FROM submissions WHERE id = ?;', [actualSubId]);
    if (!existingSub) {
      await run(
        `INSERT INTO submissions (id, intern_id, intern_email, task_id, text_content, submitted_at, status, review_id, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, datetime('now'));`,
        [actualSubId, intern.id, intern.email, task.id, 'Submission completed for review', finalDecision, reviewId]
      );
    } else {
      await run('UPDATE submissions SET status = ?, review_id = ? WHERE id = ?;', [finalDecision, reviewId, actualSubId]);
    }

    // 4. Save review in database
    await run(
      `INSERT INTO reviews (id, submission_id, intern_id, intern_email, task_id, overall_decision, requirement_findings, missing_functionality, mentor_feedback, internal_report, evaluator_mode, confidence_notes, coordinator_override, coordinator_notes, reviewed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, null, ?, datetime('now'));`,
      [
        reviewId,
        actualSubId,
        intern.id,
        intern.email,
        task.id,
        finalDecision,
        JSON.stringify(requirementFindings || []),
        missingFunctionality || 'None',
        finalMentorFeedback,
        internalReport || `Review recorded for ${intern.name} on ${task.id}`,
        evaluatorMode || 'MANUAL_SAVED',
        confidenceNotes || 'Direct review completion',
        finalReviewDate
      ]
    );

    // Update assignment status
    if (finalDecision === 'PASS') {
      await run(
        `UPDATE assignments 
         SET status = 'PASSED', passed_at = datetime('now'), review_id = ? 
         WHERE intern_id = ? AND task_id = ?;`,
        [reviewId, intern.id, task.id]
      );
    } else if (finalDecision === 'NEEDS_CHANGES') {
      await run(
        `UPDATE assignments 
         SET status = 'NEEDS_CHANGES', attempts = attempts + 1 
         WHERE intern_id = ? AND task_id = ?;`,
        [intern.id, task.id]
      );
    }

    // 5. Automatically send review details to ADMIN_EMAIL in server/.env
    let emailResult = null;
    try {
      emailResult = await sendAdminReviewReport({
        intern,
        task,
        review: {
          id: reviewId,
          overall_decision: finalDecision,
          mentor_feedback: finalMentorFeedback,
          reviewed_at: finalReviewDate,
          evaluator_mode: evaluatorMode || 'MANUAL_SAVED',
          internal_report: internalReport || ''
        },
        findings: requirementFindings || [],
        nextAction: finalDecision === 'PASS' ? 'Task marked PASSED' : 'Revisions requested'
      });
    } catch (emailErr) {
      console.error('[Reviews] Error sending review details email:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Review successfully saved and notification dispatched',
      reviewId,
      review: {
        id: reviewId,
        intern_name: intern.name,
        intern_email: intern.email,
        task_id: task.id,
        overall_decision: finalDecision,
        mentor_feedback: finalMentorFeedback,
        reviewed_at: finalReviewDate
      },
      emailResult
    });
  } catch (err) {
    console.error('[Reviews] Error saving review:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/reviews
 * Save a new review and automatically send details to ADMIN_EMAIL in server/.env
 */
router.post('/', handleSaveReview);

/**
 * POST /api/reviews/complete
 * Alias endpoint for review completion
 */
router.post('/complete', handleSaveReview);

/**
 * POST /api/reviews/:id/override
 * Coordinator manually overrides review decision (e.g. from HUMAN_REVIEW_REQUIRED to PASS or NEEDS_CHANGES)
 */
router.post('/:id/override', async (req, res) => {
  try {
    const { decision, notes } = req.body;
    if (!decision || !['PASS', 'NEEDS_CHANGES'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'decision must be either PASS or NEEDS_CHANGES' });
    }

    const review = await get('SELECT * FROM reviews WHERE id = ?;', [req.params.id]);
    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    // Re-run review cycle with coordinator override (this saves the new review & dispatches email to ADMIN_EMAIL)
    const overrideResult = await processSubmissionReview({
      submissionId: review.submission_id,
      coordinatorOverride: { decision, notes: notes || 'Approved by engineering coordinator.' }
    });

    // Mark any coordinator notification as resolved
    await run(
      `UPDATE coordinator_notifications 
       SET is_resolved = 1 
       WHERE intern_id = ? AND task_id = ? AND type = 'HUMAN_REVIEW_REQUIRED';`,
      [review.intern_id, review.task_id]
    );

    res.json({
      success: true,
      message: `Review successfully overridden to ${decision}`,
      result: overrideResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reviews/evaluate-submission/:submissionId
 * Manually trigger AI evaluation for an existing submission (saves review & dispatches email)
 */
router.post('/evaluate-submission/:submissionId', async (req, res) => {
  try {
    const result = await processSubmissionReview({ submissionId: req.params.submissionId });
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reviews/:id/notify
 * Manually dispatch/resend notification email for an existing review to ADMIN_EMAIL
 */
router.post('/:id/notify', async (req, res) => {
  try {
    const review = await get(
      `SELECT r.*, i.name as intern_name, i.email as intern_email, t.title as task_title 
       FROM reviews r
       JOIN interns i ON r.intern_id = i.id
       JOIN tasks t ON r.task_id = t.id
       WHERE r.id = ?;`,
      [req.params.id]
    );

    if (!review) {
      return res.status(404).json({ success: false, error: 'Review not found' });
    }

    const intern = { name: review.intern_name, email: review.intern_email, id: review.intern_id };
    const task = { id: review.task_id, title: review.task_title };

    const emailResult = await sendAdminReviewReport({
      intern,
      task,
      review,
      findings: JSON.parse(review.requirement_findings || '[]'),
      nextAction: review.overall_decision === 'PASS' ? 'Task completed successfully' : 'Revision pending'
    });

    res.json({
      success: true,
      message: 'Review notification dispatched to admin',
      emailResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
