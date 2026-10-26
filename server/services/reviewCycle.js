import { get, query, run, transaction } from '../db/database.js';
import { sendEmail, sendAdminReviewReport, getAdminEmail } from './emailService.js';
import { evaluateSubmission } from './aiReviewer.js';

/**
 * Checks if an intern's internship is currently active.
 * End date is inclusive up to 23:59:59 on the end_date.
 */
export async function checkInternshipActive(internId) {
  const intern = await get('SELECT * FROM interns WHERE id = ?;', [internId]);
  if (!intern) {
    return { active: false, intern: null, reason: 'Intern not found' };
  }

  const now = new Date();
  // Parse end date YYYY-MM-DD and set to end of that day (23:59:59.999)
  const [year, month, day] = intern.end_date.split('-').map(Number);
  const endDateTime = new Date(year, month - 1, day, 23, 59, 59, 999);

  if (now > endDateTime) {
    // Check if status should be transitioned to EXPIRED
    if (intern.status !== 'EXPIRED' && intern.status !== 'COMPLETED') {
      await run('UPDATE interns SET status = "EXPIRED", updated_at = datetime("now") WHERE id = ?;', [internId]);

      // Mark current incomplete task as PENDING_AT_INTERNSHIP_END
      if (intern.current_task_id) {
        await run(
          `UPDATE assignments 
           SET status = 'PENDING_AT_INTERNSHIP_END' 
           WHERE intern_id = ? AND task_id = ? AND status != 'PASSED';`,
          [internId, intern.current_task_id]
        );

        // Alert coordinator
        const existingAlert = await get(
          `SELECT id FROM coordinator_notifications 
           WHERE intern_id = ? AND task_id = ? AND type = 'INTERNSHIP_END_PENDING';`,
          [internId, intern.current_task_id]
        );

        if (!existingAlert) {
          await run(
            `INSERT INTO coordinator_notifications (id, type, intern_id, intern_email, task_id, message, is_resolved, created_at)
             VALUES (?, 'INTERNSHIP_END_PENDING', ?, ?, ?, ?, 0, datetime('now'));`,
            [
              `NOTIF-${Date.now()}`,
              intern.id,
              intern.email,
              intern.current_task_id,
              `Internship period expired on ${intern.end_date}. Task ${intern.current_task_id} marked as PENDING_AT_INTERNSHIP_END.`
            ]
          );

          // Email coordinator about expired incomplete work
          const adminEmail = await getAdminEmail();
          await sendEmail({
            idempotencyKey: `end_date_escalation_${intern.id}_${intern.current_task_id}`,
            to: adminEmail,
            subject: `[Coordinator Alert] Internship Ended: Incomplete Work for ${intern.name}`,
            html: `<p>Intern <strong>${intern.name}</strong> (${intern.email}) reached the conclusion of their internship on <strong>${intern.end_date}</strong> with incomplete task <strong>${intern.current_task_id}</strong>. Status updated to <em>PENDING_AT_INTERNSHIP_END</em>.</p>`,
            text: `Internship ended for ${intern.name}. Incomplete task: ${intern.current_task_id}`,
            emailType: 'INTERNSHIP_END_PENDING',
            ccAdmin: false
          });
        }
      }
    }

    return { active: false, intern, reason: `Internship ended on ${intern.end_date}. No further tasks or reviews permitted.` };
  }

  return { active: true, intern, reason: 'Internship is active' };
}

/**
 * Assigns the initial first task to a newly registered intern
 */
export async function assignInitialTask(intern) {
  // Check active
  const { active, reason } = await checkInternshipActive(intern.id);
  if (!active) {
    return { success: false, message: reason };
  }

  // Find lowest sequence_order active task
  const firstTask = await get(
    'SELECT * FROM tasks WHERE is_active = 1 ORDER BY sequence_order ASC LIMIT 1;'
  );

  if (!firstTask) {
    return { success: false, message: 'No active tasks found in library' };
  }

  // Prevent duplicate assignment
  const existing = await get(
    'SELECT id FROM assignments WHERE intern_email = ? AND task_id = ?;',
    [intern.email, firstTask.id]
  );

  if (existing) {
    return { success: true, assignmentId: existing.id, taskId: firstTask.id, message: 'Already assigned' };
  }

  const assignmentId = `ASG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  await run(
    `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
     VALUES (?, ?, ?, ?, 'ASSIGNED', datetime('now'), 1, datetime('now'));`,
    [assignmentId, intern.id, intern.email, firstTask.id]
  );

  await run(
    `UPDATE interns SET current_task_id = ?, updated_at = datetime('now') WHERE id = ?;`,
    [firstTask.id, intern.id]
  );

  // Send assignment notification email
  await sendEmail({
    idempotencyKey: `init_task_${intern.id}_${firstTask.id}`,
    to: intern.email,
    subject: `Welcome to the Internship! First Task Assigned: ${firstTask.id} - ${firstTask.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2>Welcome to your Internship, ${intern.name}!</h2>
        <p>Your first official company task has been assigned.</p>
        <div style="background: #f1f5f9; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="margin-top: 0; color: #1e293b;">${firstTask.id}: ${firstTask.title}</h3>
          <p><strong>Module:</strong> ${firstTask.module}</p>
          <p><strong>Estimated Duration:</strong> ${firstTask.estimated_duration}</p>
          <p><strong>Description:</strong> ${firstTask.description}</p>
        </div>
        <p>When completed, submit your work through the intern portal with testing evidence.</p>
        <p>Best of luck!</p>
      </div>
    `,
    text: `Welcome ${intern.name}! Your first task is ${firstTask.id}: ${firstTask.title}`,
    emailType: 'TASK_ASSIGNED',
    ccAdmin: true
  });

  return { success: true, assignmentId, taskId: firstTask.id };
}

/**
 * Executes full review cycle for a submission
 */
export async function processSubmissionReview({ submissionId, coordinatorOverride = null }) {
  const submission = await get('SELECT * FROM submissions WHERE id = ?;', [submissionId]);
  if (!submission) {
    throw new Error('Submission not found');
  }

  const intern = await get('SELECT * FROM interns WHERE id = ?;', [submission.intern_id]);
  const task = await get('SELECT * FROM tasks WHERE id = ?;', [submission.task_id]);

  if (!intern || !task) {
    throw new Error('Intern or Task associated with submission is missing');
  }

  // 1. Verify internship active state
  const { active, reason } = await checkInternshipActive(intern.id);

  // 2. Fetch past review history for context
  const previousReviews = await query(
    'SELECT * FROM reviews WHERE intern_id = ? AND task_id = ? ORDER BY created_at DESC;',
    [intern.id, task.id]
  );

  // 3. Run evaluation (or use coordinator override if provided)
  let evalResult;
  if (coordinatorOverride) {
    evalResult = {
      overallDecision: coordinatorOverride.decision, // PASS or NEEDS_CHANGES
      findings: JSON.parse(previousReviews[0]?.requirement_findings || '[]'),
      missingFunctionality: coordinatorOverride.decision === 'PASS' ? 'None (Coordinator Override)' : 'Pending coordinator remarks',
      mentorFeedback: coordinatorOverride.notes || `Your submission was reviewed and verified by the engineering coordinator.`,
      internalReport: `Coordinator Manual Override applied by admin: ${coordinatorOverride.notes}`,
      evaluatorMode: 'COORDINATOR_OVERRIDE',
      confidenceNotes: 'Manual verification by admin.'
    };
  } else {
    evalResult = await evaluateSubmission({ intern, task, submission, previousReviews });
  }

  const reviewId = `REV-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  // 4. Save review in database
  await run(
    `INSERT INTO reviews (id, submission_id, intern_id, intern_email, task_id, overall_decision, requirement_findings, missing_functionality, mentor_feedback, internal_report, evaluator_mode, confidence_notes, coordinator_override, coordinator_notes, reviewed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'));`,
    [
      reviewId,
      submission.id,
      intern.id,
      intern.email,
      task.id,
      evalResult.overallDecision,
      JSON.stringify(evalResult.findings),
      evalResult.missingFunctionality,
      evalResult.mentorFeedback,
      evalResult.internalReport,
      evalResult.evaluatorMode,
      evalResult.confidenceNotes,
      coordinatorOverride ? 1 : 0,
      coordinatorOverride ? coordinatorOverride.notes : null
    ]
  );

  // Update submission status
  await run(
    'UPDATE submissions SET status = ?, review_id = ? WHERE id = ?;',
    [evalResult.overallDecision, reviewId, submission.id]
  );

  let nextAction = '';

  // 5. Handle Decisions
  if (evalResult.overallDecision === 'PASS') {
    // Mark current task assignment as PASSED
    await run(
      `UPDATE assignments 
       SET status = 'PASSED', passed_at = datetime('now'), review_id = ? 
       WHERE intern_id = ? AND task_id = ?;`,
      [reviewId, intern.id, task.id]
    );

    // If internship has ended, do not allocate next task
    if (!active) {
      nextAction = `Internship ended on ${intern.end_date}. Completed tasks preserved; no further tasks allocated.`;
      await run('UPDATE interns SET status = "COMPLETED", updated_at = datetime("now") WHERE id = ?;', [intern.id]);
    } else {
      // Find next task in company sequence
      const nextTask = await get(
        `SELECT * FROM tasks 
         WHERE is_active = 1 AND sequence_order > ? 
         ORDER BY sequence_order ASC LIMIT 1;`,
        [task.sequence_order]
      );

      if (nextTask) {
        // Prevent duplicate assignment of next task
        const existingNextAsg = await get(
          'SELECT id FROM assignments WHERE intern_email = ? AND task_id = ?;',
          [intern.email, nextTask.id]
        );

        if (!existingNextAsg) {
          const nextAsgId = `ASG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          await run(
            `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
             VALUES (?, ?, ?, ?, 'ASSIGNED', datetime('now'), 1, datetime('now'));`,
            [nextAsgId, intern.id, intern.email, nextTask.id]
          );

          await run(
            'UPDATE interns SET current_task_id = ?, updated_at = datetime("now") WHERE id = ?;',
            [nextTask.id, intern.id]
          );

          nextAction = `Next task ${nextTask.id} (${nextTask.title}) allocated.`;

          // Send passed + next task notification email
          await sendEmail({
            idempotencyKey: `pass_next_${reviewId}`,
            to: intern.email,
            subject: `Task Passed! Next Assignment Ready: ${nextTask.id} - ${nextTask.title}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #166534;">Congratulations ${intern.name}! 🎉</h2>
                <p>You have successfully passed <strong>${task.id}: ${task.title}</strong>.</p>
                <div style="background: #f8fafc; border-left: 4px solid #16a34a; padding: 12px; margin: 15px 0;">
                  <p style="margin: 0; white-space: pre-line;">${evalResult.mentorFeedback}</p>
                </div>
                <h3 style="color: #0f172a;">Your Next Task: ${nextTask.id} — ${nextTask.title}</h3>
                <p><strong>Module:</strong> ${nextTask.module}</p>
                <p><strong>Description:</strong> ${nextTask.description}</p>
                <p>You can view the full requirements and submit your solution in the intern dashboard.</p>
              </div>
            `,
            text: `Congratulations! You passed ${task.id}. Your next task is ${nextTask.id}: ${nextTask.title}`,
            emailType: 'TASK_PASSED_AND_NEXT_ASSIGNED',
            ccAdmin: true
          });
        }
      } else {
        // All tasks completed!
        await run('UPDATE interns SET status = "COMPLETED", updated_at = datetime("now") WHERE id = ?;', [intern.id]);
        nextAction = 'All company curriculum tasks completed successfully!';

        await sendEmail({
          idempotencyKey: `curriculum_complete_${reviewId}`,
          to: intern.email,
          subject: `Outstanding Achievement! All Internship Tasks Completed!`,
          html: `<p>Dear ${intern.name}, congratulations on completing all approved company tasks in the curriculum!</p>`,
          text: `Congratulations ${intern.name}, you have completed all internship tasks!`,
          emailType: 'CURRICULUM_COMPLETED',
          ccAdmin: true
        });
      }
    }
  } else if (evalResult.overallDecision === 'NEEDS_CHANGES') {
    // Keep same task assigned, increment attempts
    await run(
      `UPDATE assignments 
       SET status = 'NEEDS_CHANGES', attempts = attempts + 1 
       WHERE intern_id = ? AND task_id = ?;`,
      [intern.id, task.id]
    );

    nextAction = `Retained on ${task.id} with revision feedback dispatched.`;

    // Send needs changes feedback email
    await sendEmail({
      idempotencyKey: `needs_changes_${reviewId}`,
      to: intern.email,
      subject: `Feedback on your submission: ${task.id} - ${task.title}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #854d0e;">Submission Feedback for ${task.id}</h2>
          <div style="background: #fefce8; border-left: 4px solid #eab308; padding: 14px; margin: 15px 0;">
            <p style="margin: 0; white-space: pre-line;">${evalResult.mentorFeedback}</p>
          </div>
          <p>Review the recommendations above, update your code or testing logs, and resubmit whenever you are ready.</p>
        </div>
      `,
      text: evalResult.mentorFeedback,
      emailType: 'NEEDS_CHANGES_FEEDBACK',
      ccAdmin: true
    });
  } else {
    // HUMAN_REVIEW_REQUIRED
    nextAction = 'Escalated to engineering coordinator for manual review.';

    // Create coordinator alert
    await run(
      `INSERT INTO coordinator_notifications (id, type, intern_id, intern_email, task_id, message, is_resolved, created_at)
       VALUES (?, 'HUMAN_REVIEW_REQUIRED', ?, ?, ?, ?, 0, datetime('now'));`,
      [
        `NOTIF-${Date.now()}`,
        intern.id,
        intern.email,
        task.id,
        `Submission for ${task.id} by ${intern.name} (${intern.email}) requires manual verification. Evidence insufficient or external link present.`
      ]
    );

    const adminEmail = await getAdminEmail();
    await sendEmail({
      idempotencyKey: `human_review_alert_${reviewId}`,
      to: adminEmail,
      subject: `[Coordinator Action Required] Manual Review Needed: ${intern.name} on ${task.id}`,
      html: `<p>Submission for <strong>${task.id}</strong> by <strong>${intern.name}</strong> (${intern.email}) requires manual verification.</p><p>Summary: ${evalResult.internalReport}</p>`,
      text: `Manual review needed for ${intern.name} on ${task.id}`,
      emailType: 'HUMAN_REVIEW_ESCALATION',
      ccAdmin: false
    });
  }

  // 6. Automatically dispatch Review Details to ADMIN_EMAIL in server/.env
  let adminEmailResult = null;
  try {
    adminEmailResult = await sendAdminReviewReport({
      intern,
      task,
      review: {
        id: reviewId,
        overall_decision: evalResult.overallDecision,
        mentor_feedback: evalResult.mentorFeedback,
        reviewed_at: new Date().toISOString(),
        evaluator_mode: evalResult.evaluatorMode,
        internal_report: evalResult.internalReport
      },
      findings: evalResult.findings,
      nextAction
    });
  } catch (emailErr) {
    console.error('[ReviewCycle] Failed to send admin review report email:', emailErr.message);
  }

  return {
    reviewId,
    decision: evalResult.overallDecision,
    findings: evalResult.findings,
    mentorFeedback: evalResult.mentorFeedback,
    internalReport: evalResult.internalReport,
    evaluatorMode: evalResult.evaluatorMode,
    nextAction,
    emailNotification: adminEmailResult
  };
}
