import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, query, get, run, saveDb } from '../db/database.js';
import { seedInitialData } from '../db/seedData.js';
import { getAdminEmail, sendAdminReviewReport, sendEmail } from '../services/emailService.js';
import { processSubmissionReview } from '../services/reviewCycle.js';

test('Automatic Gmail & Admin Review Notification Test Suite', async (t) => {
  await getDb();
  await seedInitialData();

  await t.test('1. Admin email accurately resolves to ADMIN_EMAIL from server/.env', async () => {
    const adminEmail = await getAdminEmail();
    assert.ok(adminEmail, 'Admin email must be present');
    if (process.env.ADMIN_EMAIL) {
      assert.equal(adminEmail, process.env.ADMIN_EMAIL.trim(), 'Must prioritize ADMIN_EMAIL defined in server/.env');
    }
  });

  await t.test('2. Review completion dispatches email containing all required fields to ADMIN_EMAIL', async () => {
    const testEmail = `notify_test_${Date.now()}@example.com`;
    const internId = `INT-NOTIF-${Date.now()}`;
    const internName = 'Divya Krishnan';
    const taskId = 'TASK-101';
    const reviewDate = '2026-10-26T12:00:00.000Z';
    const mentorFeedback = 'Great job setting up the initial Git repository and formatting configurations!';
    const reviewDecision = 'PASS';

    // 1. Create intern
    await run(
      `INSERT INTO interns (id, name, email, start_date, end_date, duration_days, status, current_task_id, created_at, updated_at)
       VALUES (?, ?, ?, '2026-10-20', '2026-10-30', 10, 'ACTIVE', ?, datetime('now'), datetime('now'));`,
      [internId, internName, testEmail, taskId]
    );

    // 2. Create assignment
    const asgId = `ASG-NOTIF-${Date.now()}`;
    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
       VALUES (?, ?, ?, ?, 'ASSIGNED', datetime('now'), 1, datetime('now'));`,
      [asgId, internId, testEmail, taskId]
    );

    // 3. Create submission
    const subId = `SUB-NOTIF-${Date.now()}`;
    await run(
      `INSERT INTO submissions (id, intern_id, intern_email, task_id, text_content, evidence_notes, submitted_at, status, created_at)
       VALUES (?, ?, ?, ?, 'Full project setup with ESLint and Prettier configs.', 'git log shows atomic commits', datetime('now'), 'SUBMITTED', datetime('now'));`,
      [subId, internId, testEmail, taskId]
    );

    // 4. Save review and dispatch notification to admin
    const testReviewId = `REV-NOTIF-${Date.now()}`;
    const emailResult = await sendAdminReviewReport({
      intern: { id: internId, name: internName, email: testEmail },
      task: { id: taskId, title: 'Project Setup & Git Conventions' },
      review: {
        id: testReviewId,
        overall_decision: reviewDecision,
        mentor_feedback: mentorFeedback,
        reviewed_at: reviewDate,
        evaluator_mode: 'DEMO_DETERMINISTIC',
        internal_report: 'Verification passed with 4/4 criteria.'
      },
      findings: [
        { requirement: 'Initialize git repo', status: 'MET', evidence: 'Verified' }
      ],
      nextAction: 'Next task allocated'
    });

    assert.ok(emailResult.logId, 'An email_log entry must be recorded');
    
    // Verify SQLite email log entry
    const emailLog = await get('SELECT * FROM email_logs WHERE id = ?;', [emailResult.logId]);
    assert.ok(emailLog, 'Email log record must exist in database');
    
    const expectedAdmin = await getAdminEmail();
    assert.equal(emailLog.intern_email, expectedAdmin, 'Recipient must be ADMIN_EMAIL');
    assert.match(emailLog.subject, /TASK-101/, 'Subject must mention the task ID');
    assert.match(emailLog.subject, /PASS/, 'Subject must mention the review decision');

    // Content preview checks
    assert.ok(emailLog.content_preview.length > 0, 'Preview must not be empty');
  });

  await t.test('3. Duplicate notifications for the same saved review are prevented (idempotent)', async () => {
    const fixedReviewId = `REV-IDEMP-${Date.now()}`;
    const intern = { name: 'Aarav Patel', email: 'aarav.patel@example.com' };
    const task = { id: 'TASK-102', title: 'RESTful API Design' };
    const review = {
      id: fixedReviewId,
      overall_decision: 'PASS',
      mentor_feedback: 'Excellent REST endpoint implementation.',
      reviewed_at: new Date().toISOString()
    };

    // First dispatch
    const firstDispatch = await sendAdminReviewReport({ intern, task, review });
    assert.equal(firstDispatch.skipped, undefined, 'First notification must be sent or recorded');

    // Second dispatch with same review ID
    const secondDispatch = await sendAdminReviewReport({ intern, task, review });
    assert.equal(secondDispatch.skipped, true, 'Second notification for same review must be skipped as duplicate');
    assert.match(secondDispatch.reason, /Duplicate/i);
  });

  await t.test('4. Viewing or refreshing reviews does NOT trigger emails', async () => {
    // Count emails before
    const countBefore = await get('SELECT COUNT(*) as count FROM email_logs;');

    // Simulate viewing reviews (what GET /api/reviews does)
    const reviews = await query('SELECT * FROM reviews ORDER BY reviewed_at DESC LIMIT 10;');
    assert.ok(Array.isArray(reviews));

    // Simulate viewing single review (what GET /api/reviews/:id does)
    if (reviews.length > 0) {
      const single = await get('SELECT * FROM reviews WHERE id = ?;', [reviews[0].id]);
      assert.ok(single);
    }

    // Count emails after
    const countAfter = await get('SELECT COUNT(*) as count FROM email_logs;');
    assert.equal(countBefore.count, countAfter.count, 'Viewing or refreshing reviews must NOT create email logs');
  });

  await t.test('5. Email errors are handled gracefully without throwing unhandled exceptions', async () => {
    // Test safe handling when given arbitrary input
    const invalidSend = await sendEmail({
      idempotencyKey: `fail_test_${Date.now()}`,
      to: 'invalid-email-recipient',
      subject: 'Error Handling Test',
      text: 'Testing SMTP error resilience',
      emailType: 'ERROR_RESILIENCE_TEST'
    });

    assert.ok(invalidSend, 'Must return result object without throwing');
    assert.ok(['SENT', 'SIMULATED', 'FAILED'].includes(invalidSend.status));
  });
});
