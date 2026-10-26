import { get, run, query } from './database.js';

export async function seedInitialData() {
  // Check if tasks already exist
  const existingTasks = await query('SELECT id FROM tasks LIMIT 1;');
  if (existingTasks.length === 0) {
    console.log('[Seed] Populating official company task library...');
    
    const tasks = [
      {
        id: 'TASK-101',
        module: 'Dev Environment & Git Workflow',
        title: 'Project Setup, Branching Strategy & Git Conventions',
        description: 'Initialize a clean project repository adhering to Conventional Commits, branch naming conventions (feature/*, fix/*), and configure a linter and formatter (ESLint & Prettier).',
        requirements: JSON.stringify([
          'Initialize git repository with a clean .gitignore ignoring node_modules and .env',
          'Configure ESLint and Prettier configuration files with no syntax errors',
          'Create a README.md documenting project setup and run commands',
          'Provide evidence of at least 3 atomic git commits following Conventional Commits format'
        ]),
        deliverables: 'GitHub/Git repository link or code zip, README.md, package.json, eslint config, and git log output.',
        acceptance_criteria: 'All 4 requirements met with verifiable evidence; clean commit messages without generic messages like "update".',
        sequence_order: 1,
        estimated_duration: '2 Days',
        is_active: 1,
        reference_docs: 'https://www.conventionalcommits.org/'
      },
      {
        id: 'TASK-102',
        module: 'Backend API Development',
        title: 'RESTful API Design & Structured Input Validation',
        description: 'Build an Express.js CRUD API for a core resource with robust schema validation, standardized JSON error responses, and HTTP status codes (200, 201, 400, 404, 500).',
        requirements: JSON.stringify([
          'Implement full CRUD endpoints (GET, POST, PUT, DELETE) for the entity',
          'Strict payload validation rejecting invalid or missing required fields with HTTP 400',
          'Unified error response schema { error: string, details: string[] }',
          'Provide curl commands or automated request samples with response output'
        ]),
        deliverables: 'Express route files, validation middleware, and sample API test outputs or Postman collection.',
        acceptance_criteria: 'Every endpoint functions, returns expected status codes, and rejects malformed inputs gracefully.',
        sequence_order: 2,
        estimated_duration: '2 Days',
        is_active: 1,
        reference_docs: 'https://restfulapi.net/'
      },
      {
        id: 'TASK-103',
        module: 'Database Architecture',
        title: 'Relational Schema Modeling & Transaction Safeguards',
        description: 'Design a normalized SQLite schema with foreign key constraints, indexes, and demonstrate transactional atomicity for complex write operations.',
        requirements: JSON.stringify([
          'Normalized relational schema with primary and foreign key constraints enabled',
          'Database indexes on frequently searched lookup columns',
          'Use BEGIN TRANSACTION / COMMIT / ROLLBACK on multi-step write operations',
          'Handling of duplicate unique key violations returning user-friendly error'
        ]),
        deliverables: 'Database schema SQL scripts, migration or setup file, and evidence of transaction rollback on failure.',
        acceptance_criteria: 'Foreign keys enforced; rollback successfully verified when an intermediate step fails.',
        sequence_order: 3,
        estimated_duration: '2 Days',
        is_active: 1,
        reference_docs: 'https://www.sqlite.org/foreignkeys.html'
      },
      {
        id: 'TASK-104',
        module: 'Security & Auth',
        title: 'JWT Authentication & Role-Based Access Control',
        description: 'Implement secure password hashing using bcrypt or argon2, stateless JWT token issuing with expiration, and role-based middleware guarding admin routes.',
        requirements: JSON.stringify([
          'Password hashing with salted bcrypt before saving to storage',
          'JWT authentication middleware verifying bearer token and expiry',
          'Role-based authorization guard checking intern vs coordinator roles',
          'Unit test or curl test demonstrating blocked access (401/403) for unauthorized requests'
        ]),
        deliverables: 'Auth controller, password hashing utility, auth middleware, and test tokens.',
        acceptance_criteria: 'Passwords never stored in plaintext; expired or tampered tokens return HTTP 401.',
        sequence_order: 4,
        estimated_duration: '2 Days',
        is_active: 1,
        reference_docs: 'https://jwt.io/introduction'
      },
      {
        id: 'TASK-105',
        module: 'Testing & QA',
        title: 'Automated Test Suite & Regression Safeguards',
        description: 'Write automated unit and integration tests using Node test runner or Jest, achieving at least 80% coverage on core business logic functions.',
        requirements: JSON.stringify([
          'Automated unit tests covering positive and negative test cases for business logic',
          'Integration tests for API endpoints with mock or test database',
          'Zero failing tests in the test suite run output',
          'Documented npm test command in README'
        ]),
        deliverables: 'Test files, test report screenshot or CLI logs, and npm test script.',
        acceptance_criteria: 'All test assertions pass cleanly with clear test case descriptions.',
        sequence_order: 5,
        estimated_duration: '2 Days',
        is_active: 1,
        reference_docs: 'https://nodejs.org/api/test.html'
      }
    ];

    for (const t of tasks) {
      await run(
        `INSERT INTO tasks (id, module, title, description, requirements, deliverables, acceptance_criteria, sequence_order, estimated_duration, is_active, reference_docs, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
        [t.id, t.module, t.title, t.description, t.requirements, t.deliverables, t.acceptance_criteria, t.sequence_order, t.estimated_duration, t.is_active, t.reference_docs]
      );
    }
  }

  // Check if interns already exist
  const existingInterns = await query('SELECT id FROM interns LIMIT 1;');
  if (existingInterns.length === 0) {
    console.log('[Seed] Populating realistic sample interns and assignments...');
    
    // Use dates relative to now: today is day 3 of 10 for active interns
    const today = new Date();
    
    // Active Intern 1 (Priya Sharma - Start: 3 days ago, End: 7 days from now)
    const priyaStart = new Date(today);
    priyaStart.setDate(today.getDate() - 3);
    const priyaEnd = new Date(today);
    priyaEnd.setDate(today.getDate() + 7);

    // Active Intern 2 (Aarav Patel - Start: 4 days ago, End: 6 days from now)
    const aaravStart = new Date(today);
    aaravStart.setDate(today.getDate() - 4);
    const aaravEnd = new Date(today);
    aaravEnd.setDate(today.getDate() + 6);

    // Active Intern 3 (Rohan Das - Start: 2 days ago, End: 8 days from now)
    const rohanStart = new Date(today);
    rohanStart.setDate(today.getDate() - 2);
    const rohanEnd = new Date(today);
    rohanEnd.setDate(today.getDate() + 8);

    // Expired Intern (Ananya Iyer - Ended yesterday, had 10 calendar days)
    const ananyaStart = new Date(today);
    ananyaStart.setDate(today.getDate() - 11);
    const ananyaEnd = new Date(today);
    ananyaEnd.setDate(today.getDate() - 1);

    // Active Intern 5 (Vikram Singh - Day 1 today)
    const vikramStart = new Date(today);
    const vikramEnd = new Date(today);
    vikramEnd.setDate(today.getDate() + 10);

    const sampleInterns = [
      {
        id: 'INT-101',
        name: 'Priya Sharma',
        email: 'priya.sharma@example.com',
        start_date: priyaStart.toISOString().split('T')[0],
        end_date: priyaEnd.toISOString().split('T')[0],
        duration_days: 10,
        status: 'ACTIVE',
        current_task_id: 'TASK-101'
      },
      {
        id: 'INT-102',
        name: 'Aarav Patel',
        email: 'aarav.patel@example.com',
        start_date: aaravStart.toISOString().split('T')[0],
        end_date: aaravEnd.toISOString().split('T')[0],
        duration_days: 10,
        status: 'ACTIVE',
        current_task_id: 'TASK-102'
      },
      {
        id: 'INT-103',
        name: 'Rohan Das',
        email: 'rohan.das@example.com',
        start_date: rohanStart.toISOString().split('T')[0],
        end_date: rohanEnd.toISOString().split('T')[0],
        duration_days: 10,
        status: 'ACTIVE',
        current_task_id: 'TASK-101'
      },
      {
        id: 'INT-104',
        name: 'Ananya Iyer',
        email: 'ananya.iyer@example.com',
        start_date: ananyaStart.toISOString().split('T')[0],
        end_date: ananyaEnd.toISOString().split('T')[0],
        duration_days: 10,
        status: 'EXPIRED',
        current_task_id: 'TASK-102'
      },
      {
        id: 'INT-105',
        name: 'Vikram Singh',
        email: 'vikram.singh@example.com',
        start_date: vikramStart.toISOString().split('T')[0],
        end_date: vikramEnd.toISOString().split('T')[0],
        duration_days: 10,
        status: 'ACTIVE',
        current_task_id: 'TASK-101'
      }
    ];

    for (const intern of sampleInterns) {
      await run(
        `INSERT INTO interns (id, name, email, start_date, end_date, duration_days, status, current_task_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'));`,
        [intern.id, intern.name, intern.email, intern.start_date, intern.end_date, intern.duration_days, intern.status, intern.current_task_id]
      );
    }

    // Seed assignments
    // Priya: Assigned TASK-101
    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
       VALUES ('ASG-101', 'INT-101', 'priya.sharma@example.com', 'TASK-101', 'ASSIGNED', datetime('now', '-3 days'), 1, datetime('now', '-3 days'));`
    );

    // Aarav: Passed TASK-101, now on TASK-102
    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, passed_at, attempts, created_at)
       VALUES ('ASG-102-A', 'INT-102', 'aarav.patel@example.com', 'TASK-101', 'PASSED', datetime('now', '-4 days'), datetime('now', '-2 days'), 1, datetime('now', '-4 days'));`
    );
    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
       VALUES ('ASG-102-B', 'INT-102', 'aarav.patel@example.com', 'TASK-102', 'ASSIGNED', datetime('now', '-2 days'), 1, datetime('now', '-2 days'));`
    );

    // Rohan: Assigned TASK-101 (previously got NEEDS_CHANGES)
    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
       VALUES ('ASG-103', 'INT-103', 'rohan.das@example.com', 'TASK-101', 'NEEDS_CHANGES', datetime('now', '-2 days'), 2, datetime('now', '-2 days'));`
    );

    // Ananya: Incomplete TASK-102 at internship end
    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
       VALUES ('ASG-104', 'INT-104', 'ananya.iyer@example.com', 'TASK-102', 'PENDING_AT_INTERNSHIP_END', datetime('now', '-5 days'), 1, datetime('now', '-5 days'));`
    );

    // Add coordinator escalation for Ananya
    await run(
      `INSERT INTO coordinator_notifications (id, type, intern_id, intern_email, task_id, message, is_resolved, created_at)
       VALUES ('NOTIF-101', 'INTERNSHIP_END_PENDING', 'INT-104', 'ananya.iyer@example.com', 'TASK-102',
       'Internship period concluded on ${ananyaEnd.toISOString().split('T')[0]}. Task TASK-102 remains incomplete (PENDING_AT_INTERNSHIP_END). Action required.', 0, datetime('now'));`
    );

    // Vikram: Newly assigned TASK-101
    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
       VALUES ('ASG-105', 'INT-105', 'vikram.singh@example.com', 'TASK-101', 'ASSIGNED', datetime('now'), 1, datetime('now'));`
    );

    // Seed a sample review history for Aarav's pass
    const aaravFindings = JSON.stringify([
      { requirement: 'Initialize git repository with a clean .gitignore ignoring node_modules and .env', status: 'MET', evidence: 'Repository contains verified .gitignore with node_modules/ and .env patterns.' },
      { requirement: 'Configure ESLint and Prettier configuration files with no syntax errors', status: 'MET', evidence: '.eslintrc.json and .prettierrc files present and validated.' },
      { requirement: 'Create a README.md documenting project setup and run commands', status: 'MET', evidence: 'README includes comprehensive installation, run, and test steps.' },
      { requirement: 'Provide evidence of at least 3 atomic git commits following Conventional Commits format', status: 'MET', evidence: 'Git log verifies feat: add base structure, chore: configure linting, docs: update readme.' }
    ]);

    await run(
      `INSERT INTO reviews (id, submission_id, intern_id, intern_email, task_id, overall_decision, requirement_findings, missing_functionality, mentor_feedback, internal_report, evaluator_mode, confidence_notes, reviewed_at, created_at)
       VALUES ('REV-101', 'SUB-101', 'INT-102', 'aarav.patel@example.com', 'TASK-101', 'PASS', ?,
       'None. All mandatory criteria satisfied.',
       'Hi Aarav, fantastic work on setting up your repository! Your git commit discipline is spot-on with Conventional Commits, and your configuration files are clean. Ready for Task 102!',
       'Candidate fulfilled all 4 criteria with concrete commit history and spotless config. Recommended for immediate progression.',
       'DEMO_DETERMINISTIC', 'High confidence. All artifacts present.', datetime('now', '-2 days'), datetime('now', '-2 days'));`,
      [aaravFindings]
    );

    // Seed email log for Aarav
    await run(
      `INSERT INTO email_logs (id, idempotency_key, intern_email, admin_email, email_type, subject, content_preview, status, sent_at, created_at)
       VALUES ('EML-101', 'seed_asg_aarav_101', 'aarav.patel@example.com', 'coordinator@company.com', 'TASK_PASSED',
       'Task Passed & Next Assignment: TASK-102', 'Congratulations Aarav! You have passed TASK-101...', 'SIMULATED', datetime('now', '-2 days'), datetime('now', '-2 days'));`
    );

    // Seed a review schedule for Priya Sharma
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    await run(
      `INSERT INTO review_schedules (id, intern_id, intern_email, task_id, review_date, review_time, timezone, meet_url, prep_instructions, status, reminder_sent, created_at)
       VALUES ('SCHED-101', 'INT-101', 'priya.sharma@example.com', 'TASK-101', ?, '14:30', 'Asia/Kolkata', 'https://meet.google.com/abc-defg-hij', 'Please have your terminal ready to demonstrate git log and npm run lint.', 'SCHEDULED', 0, datetime('now'));`,
      [tomorrow.toISOString().split('T')[0]]
    );
  }

  // Set default system settings
  const settings = [
    { key: 'AI_PROVIDER', value: 'DEMO_DETERMINISTIC' },
    { key: 'ADMIN_EMAIL', value: 'coordinator@company.com' },
    { key: 'DEFAULT_INTERNSHIP_DAYS', value: '10' },
    { key: 'TIMEZONE', value: 'Asia/Kolkata' },
    { key: 'SAFE_EMAIL_MODE', value: 'true' }
  ];

  for (const s of settings) {
    const existing = await get('SELECT key FROM system_settings WHERE key = ?;', [s.key]);
    if (!existing) {
      await run('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime("now"));', [s.key, s.value]);
    }
  }
}
