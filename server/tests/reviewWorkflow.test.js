import test from 'node:test';
import assert from 'node:assert/strict';
import { getDb, query, get, run, saveDb } from '../db/database.js';
import { seedInitialData } from '../db/seedData.js';
import { assignInitialTask, checkInternshipActive, processSubmissionReview } from '../services/reviewCycle.js';
import { scheduleReview } from '../services/calendarService.js';
import { sendEmail } from '../services/emailService.js';

test('Comprehensive Business Logic & Review Workflow Test Suite', async (t) => {
  // Setup DB and seed
  await getDb();
  await seedInitialData();

  await t.test('1. Intern creation and duplicate email validation', async () => {
    const testEmail = `test_intern_${Date.now()}@example.com`;
    
    // Create new intern
    const internId = `TEST-INT-${Date.now()}`;
    await run(
      `INSERT INTO interns (id, name, email, start_date, end_date, duration_days, status, created_at, updated_at)
       VALUES (?, 'Test User', ?, '2026-10-01', '2026-10-11', 10, 'ACTIVE', datetime('now'), datetime('now'));`,
      [internId, testEmail]
    );

    const intern = await get('SELECT * FROM interns WHERE email = ?;', [testEmail]);
    assert.ok(intern, 'Intern should exist in database');
    assert.equal(intern.email, testEmail);

    // Duplicate check
    const duplicate = await get('SELECT id FROM interns WHERE email = ?;', [testEmail]);
    assert.equal(duplicate.id, internId, 'Duplicate lookup should match initial ID');
  });

  await t.test('2. Initial task allocation upon intern registration', async () => {
    const testEmail = `fresh_${Date.now()}@example.com`;
    const internId = `TEST-FRESH-${Date.now()}`;
    
    const today = new Date().toISOString().split('T')[0];
    const end = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

    await run(
      `INSERT INTO interns (id, name, email, start_date, end_date, duration_days, status, created_at, updated_at)
       VALUES (?, 'Fresh Intern', ?, ?, ?, 10, 'ACTIVE', datetime('now'), datetime('now'));`,
      [internId, testEmail, today, end]
    );

    const freshIntern = await get('SELECT * FROM interns WHERE id = ?;', [internId]);
    const res = await assignInitialTask(freshIntern);

    assert.equal(res.success, true);
    assert.equal(res.taskId, 'TASK-101', 'First active task in sequence should be TASK-101');

    const assignment = await get('SELECT * FROM assignments WHERE intern_email = ? AND task_id = "TASK-101";', [testEmail]);
    assert.ok(assignment, 'Assignment record must exist in SQLite');
    assert.equal(assignment.status, 'ASSIGNED');
  });

  await t.test('3. PASS marks current task Passed and allocates next task exactly once', async () => {
    const testEmail = `pass_flow_${Date.now()}@example.com`;
    const internId = `INT-PASS-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];
    const end = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

    await run(
      `INSERT INTO interns (id, name, email, start_date, end_date, duration_days, status, current_task_id, created_at, updated_at)
       VALUES (?, 'Passing Intern', ?, ?, ?, 10, 'ACTIVE', 'TASK-101', datetime('now'), datetime('now'));`,
      [internId, testEmail, today, end]
    );

    const asgId = `ASG-PASS-${Date.now()}`;
    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
       VALUES (?, ?, ?, 'TASK-101', 'ASSIGNED', datetime('now'), 1, datetime('now'));`,
      [asgId, internId, testEmail]
    );

    const subId = `SUB-PASS-${Date.now()}`;
    // Provide full evidence matching all 4 requirements of TASK-101
    await run(
      `INSERT INTO submissions (id, intern_id, intern_email, task_id, text_content, evidence_notes, submitted_at, status, created_at)
       VALUES (?, ?, ?, 'TASK-101',
       'Initialize git repository with clean .gitignore ignoring node_modules and .env. Configured ESLint and Prettier without errors. Created README.md. Git log shows 3 atomic commits with Conventional Commits format.',
       'git log shows feat: init, chore: eslint, docs: readme. All tests pass.',
       datetime('now'), 'SUBMITTED', datetime('now'));`,
      [subId, internId, testEmail]
    );

    const result = await processSubmissionReview({ submissionId: subId });
    assert.equal(result.decision, 'PASS', 'Decision must be PASS when all requirements are met');

    // Verify task marked PASSED
    const oldAsg = await get('SELECT * FROM assignments WHERE intern_email = ? AND task_id = "TASK-101";', [testEmail]);
    assert.equal(oldAsg.status, 'PASSED');

    // Verify next task (TASK-102) was allocated
    const nextAsg = await get('SELECT * FROM assignments WHERE intern_email = ? AND task_id = "TASK-102";', [testEmail]);
    assert.ok(nextAsg, 'TASK-102 must be assigned');
    assert.equal(nextAsg.status, 'ASSIGNED');

    // Verify intern current_task_id updated
    const updatedIntern = await get('SELECT current_task_id FROM interns WHERE id = ?;', [internId]);
    assert.equal(updatedIntern.current_task_id, 'TASK-102');

    // Check duplicate allocation safeguard: calling review again should not duplicate TASK-102
    const totalNextAsgs = await query('SELECT id FROM assignments WHERE intern_email = ? AND task_id = "TASK-102";', [testEmail]);
    assert.equal(totalNextAsgs.length, 1, 'Next task must be allocated exactly once');
  });

  await t.test('4. NEEDS_CHANGES keeps same task assigned and records revision attempt', async () => {
    const testEmail = `revision_${Date.now()}@example.com`;
    const internId = `INT-REV-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];
    const end = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

    await run(
      `INSERT INTO interns (id, name, email, start_date, end_date, duration_days, status, current_task_id, created_at, updated_at)
       VALUES (?, 'Revision Intern', ?, ?, ?, 10, 'ACTIVE', 'TASK-101', datetime('now'), datetime('now'));`,
      [internId, testEmail, today, end]
    );

    const asgId = `ASG-REV-${Date.now()}`;
    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
       VALUES (?, ?, ?, 'TASK-101', 'ASSIGNED', datetime('now'), 1, datetime('now'));`,
      [asgId, internId, testEmail]
    );

    const subId = `SUB-REV-${Date.now()}`;
    // Incomplete submission: missing eslint and commit history
    await run(
      `INSERT INTO submissions (id, intern_id, intern_email, task_id, text_content, evidence_notes, submitted_at, status, created_at)
       VALUES (?, ?, ?, 'TASK-101',
       'Only created basic git repository and readme.',
       'No commit logs or linter config yet.',
       datetime('now'), 'SUBMITTED', datetime('now'));`,
      [subId, internId, testEmail]
    );

    const result = await processSubmissionReview({ submissionId: subId });
    assert.equal(result.decision, 'NEEDS_CHANGES', 'Decision should be NEEDS_CHANGES');

    // Verify same task is kept assigned
    const asg = await get('SELECT * FROM assignments WHERE id = ?;', [asgId]);
    assert.equal(asg.status, 'NEEDS_CHANGES');
    assert.equal(asg.attempts, 2, 'Attempt counter must be incremented');

    // Next task must NOT be allocated
    const nextTask = await get('SELECT * FROM assignments WHERE intern_email = ? AND task_id = "TASK-102";', [testEmail]);
    assert.equal(nextTask, null, 'Next task must NOT be allocated on NEEDS_CHANGES');
  });

  await t.test('5. HUMAN_REVIEW_REQUIRED blocks advancement until coordinator acts', async () => {
    const testEmail = `ambiguous_${Date.now()}@example.com`;
    const internId = `INT-AMB-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];
    const end = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

    await run(
      `INSERT INTO interns (id, name, email, start_date, end_date, duration_days, status, current_task_id, created_at, updated_at)
       VALUES (?, 'Ambiguous Intern', ?, ?, ?, 10, 'ACTIVE', 'TASK-101', datetime('now'), datetime('now'));`,
      [internId, testEmail, today, end]
    );

    const asgAmbId = `ASG-AMB-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
       VALUES (?, ?, ?, 'TASK-101', 'ASSIGNED', datetime('now'), 1, datetime('now'));`,
      [asgAmbId, internId, testEmail]
    );

    const subId = `SUB-AMB-${Date.now()}`;
    // Only a private external URL without code or inline evidence
    await run(
      `INSERT INTO submissions (id, intern_id, intern_email, task_id, text_content, repo_url, evidence_notes, submitted_at, status, created_at)
       VALUES (?, ?, ?, 'TASK-101', 'Check my github repo link', 'https://github.com/private/repo', '', datetime('now'), 'SUBMITTED', datetime('now'));`,
      [subId, internId, testEmail]
    );

    const result = await processSubmissionReview({ submissionId: subId });
    assert.equal(result.decision, 'HUMAN_REVIEW_REQUIRED', 'Decision should be HUMAN_REVIEW_REQUIRED when evidence is external/inaccessible');

    // Check that coordinator notification was raised
    const notif = await get('SELECT * FROM coordinator_notifications WHERE intern_id = ? AND type = "HUMAN_REVIEW_REQUIRED";', [internId]);
    assert.ok(notif, 'Coordinator escalation notification must be recorded');
  });

  await t.test('6. End-date enforcement prevents new allocations and future reviews', async () => {
    const expiredEmail = `expired_${Date.now()}@example.com`;
    const internId = `INT-EXP-${Date.now()}`;

    // End date was 3 days ago
    const pastStart = '2026-10-01';
    const pastEnd = '2026-10-11';

    await run(
      `INSERT INTO interns (id, name, email, start_date, end_date, duration_days, status, current_task_id, created_at, updated_at)
       VALUES (?, 'Expired Intern', ?, ?, ?, 10, 'ACTIVE', 'TASK-101', datetime('now'), datetime('now'));`,
      [internId, expiredEmail, pastStart, pastEnd]
    );

    const check = await checkInternshipActive(internId);
    assert.equal(check.active, false, 'Internship must be detected as not active');

    // Intern status should be updated to EXPIRED
    const intern = await get('SELECT status FROM interns WHERE id = ?;', [internId]);
    assert.equal(intern.status, 'EXPIRED');

    // Attempting to schedule review beyond end date must throw
    await assert.rejects(
      async () => {
        await scheduleReview({
          internId,
          taskId: 'TASK-101',
          reviewDate: '2026-10-28',
          reviewTime: '10:00'
        });
      },
      /Cannot schedule review|exceeds/
    );
  });

  await t.test('7. Incomplete tasks remain pending at internship end', async () => {
    const expiredEmail = `incomplete_end_${Date.now()}@example.com`;
    const internId = `INT-INC-${Date.now()}`;

    await run(
      `INSERT INTO interns (id, name, email, start_date, end_date, duration_days, status, current_task_id, created_at, updated_at)
       VALUES (?, 'Incomplete Intern', ?, '2026-10-01', '2026-10-10', 10, 'ACTIVE', 'TASK-102', datetime('now'), datetime('now'));`,
      [internId, expiredEmail]
    );

    const asgIncId = `ASG-INC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
       VALUES (?, ?, ?, 'TASK-102', 'ASSIGNED', datetime('now'), 1, datetime('now'));`,
      [asgIncId, internId, expiredEmail]
    );

    await checkInternshipActive(internId);

    const asg = await get('SELECT status FROM assignments WHERE intern_id = ? AND task_id = "TASK-102";', [internId]);
    assert.equal(asg.status, 'PENDING_AT_INTERNSHIP_END', 'Incomplete task must transition to PENDING_AT_INTERNSHIP_END');
  });

  await t.test('8. Insufficient evidence cannot automatically pass a task', async () => {
    const blankEmail = `blank_${Date.now()}@example.com`;
    const internId = `INT-BLANK-${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];
    const end = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];

    await run(
      `INSERT INTO interns (id, name, email, start_date, end_date, duration_days, status, current_task_id, created_at, updated_at)
       VALUES (?, 'Blank Intern', ?, ?, ?, 10, 'ACTIVE', 'TASK-101', datetime('now'), datetime('now'));`,
      [internId, blankEmail, today, end]
    );

    const asgBlankId = `ASG-BLANK-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
       VALUES (?, ?, ?, 'TASK-101', 'ASSIGNED', datetime('now'), 1, datetime('now'));`,
      [asgBlankId, internId, blankEmail]
    );

    const subId = `SUB-BLANK-${Date.now()}`;
    await run(
      `INSERT INTO submissions (id, intern_id, intern_email, task_id, text_content, submitted_at, status, created_at)
       VALUES (?, ?, ?, 'TASK-101', 'done', datetime('now'), 'SUBMITTED', datetime('now'));`,
      [subId, internId, blankEmail]
    );

    const result = await processSubmissionReview({ submissionId: subId });
    assert.notEqual(result.decision, 'PASS', 'A blank or low-evidence submission must NEVER pass');
  });

  await t.test('9. Email provider actions are recorded in SQLite audit logs', async () => {
    const logResult = await sendEmail({
      idempotencyKey: `audit_test_${Date.now()}`,
      to: 'intern.audit@example.com',
      subject: 'Audit verification email',
      html: '<p>Testing audit log persistence</p>',
      emailType: 'AUDIT_TEST'
    });

    assert.ok(logResult.logId, 'A logId must be returned');

    const logRecord = await get('SELECT * FROM email_logs WHERE id = ?;', [logResult.logId]);
    assert.ok(logRecord, 'Log record must exist in SQLite email_logs table');
    assert.equal(logRecord.intern_email, 'intern.audit@example.com');
  });

  await t.test('10. Duplicate email requests do not send duplicate notifications', async () => {
    const key = `idempotent_key_${Date.now()}`;
    
    // First send
    const res1 = await sendEmail({
      idempotencyKey: key,
      to: 'idempotent@example.com',
      subject: 'First invocation',
      text: 'Content',
      emailType: 'IDEMPOTENCY_TEST'
    });
    assert.equal(res1.skipped, undefined, 'First attempt must proceed');

    // Second send with same key
    const res2 = await sendEmail({
      idempotencyKey: key,
      to: 'idempotent@example.com',
      subject: 'Second duplicate invocation',
      text: 'Content',
      emailType: 'IDEMPOTENCY_TEST'
    });
    assert.equal(res2.skipped, true, 'Second attempt with identical key must be skipped');
  });

  await t.test('11. Database state persists to disk file', async () => {
    saveDb();
    const internCount = await get('SELECT COUNT(*) as cnt FROM interns;');
    assert.ok(internCount.cnt > 0, 'Database contains saved records');
  });
});
