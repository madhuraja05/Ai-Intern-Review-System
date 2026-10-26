import express from 'express';
import { query, get, run } from '../db/database.js';
import { checkInternshipActive } from '../services/reviewCycle.js';
import { sendEmail } from '../services/emailService.js';

const router = express.Router();

/**
 * GET /api/tasks
 * Return all official company tasks sorted by sequence order
 */
router.get('/', async (req, res) => {
  try {
    const tasks = await query('SELECT * FROM tasks ORDER BY sequence_order ASC;');
    res.json({
      success: true,
      count: tasks.length,
      tasks: tasks.map(t => ({
        ...t,
        requirements: JSON.parse(t.requirements || '[]')
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/tasks
 * Add a new official task to the library
 */
router.post('/', async (req, res) => {
  try {
    const {
      id,
      module,
      title,
      description,
      requirements,
      deliverables,
      acceptance_criteria,
      sequence_order,
      estimated_duration,
      reference_docs
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, error: 'Title and description are required' });
    }

    const taskId = id ? id.trim().toUpperCase() : `TASK-${Date.now().toString().slice(-3)}`;
    const existing = await get('SELECT id FROM tasks WHERE id = ?;', [taskId]);
    if (existing) {
      return res.status(400).json({ success: false, error: `Task ID ${taskId} already exists` });
    }

    // Determine sequence if not provided
    let seq = parseInt(sequence_order, 10);
    if (isNaN(seq)) {
      const maxSeq = await get('SELECT MAX(sequence_order) as maxSeq FROM tasks;');
      seq = (maxSeq?.maxSeq || 0) + 1;
    }

    const reqArray = Array.isArray(requirements)
      ? requirements
      : (typeof requirements === 'string' ? requirements.split('\n').filter(Boolean) : []);

    await run(
      `INSERT INTO tasks (id, module, title, description, requirements, deliverables, acceptance_criteria, sequence_order, estimated_duration, is_active, reference_docs, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'));`,
      [
        taskId,
        module || 'General Engineering',
        title.trim(),
        description.trim(),
        JSON.stringify(reqArray),
        deliverables || 'Code submission and test evidence',
        acceptance_criteria || 'All mandatory criteria satisfied',
        seq,
        estimated_duration || '2 Days',
        reference_docs || ''
      ]
    );

    const created = await get('SELECT * FROM tasks WHERE id = ?;', [taskId]);
    res.status(201).json({
      success: true,
      task: {
        ...created,
        requirements: JSON.parse(created.requirements || '[]')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/tasks/:id
 * Edit company task details
 */
router.put('/:id', async (req, res) => {
  try {
    const task = await get('SELECT * FROM tasks WHERE id = ?;', [req.params.id]);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const {
      module,
      title,
      description,
      requirements,
      deliverables,
      acceptance_criteria,
      sequence_order,
      estimated_duration,
      is_active,
      reference_docs
    } = req.body;

    const reqArray = requirements !== undefined
      ? (Array.isArray(requirements) ? requirements : requirements.split('\n').filter(Boolean))
      : JSON.parse(task.requirements || '[]');

    await run(
      `UPDATE tasks 
       SET module = ?, title = ?, description = ?, requirements = ?, deliverables = ?, acceptance_criteria = ?, sequence_order = ?, estimated_duration = ?, is_active = ?, reference_docs = ?
       WHERE id = ?;`,
      [
        module !== undefined ? module : task.module,
        title !== undefined ? title : task.title,
        description !== undefined ? description : task.description,
        JSON.stringify(reqArray),
        deliverables !== undefined ? deliverables : task.deliverables,
        acceptance_criteria !== undefined ? acceptance_criteria : task.acceptance_criteria,
        sequence_order !== undefined ? parseInt(sequence_order, 10) : task.sequence_order,
        estimated_duration !== undefined ? estimated_duration : task.estimated_duration,
        is_active !== undefined ? (is_active ? 1 : 0) : task.is_active,
        reference_docs !== undefined ? reference_docs : task.reference_docs,
        req.params.id
      ]
    );

    const updated = await get('SELECT * FROM tasks WHERE id = ?;', [req.params.id]);
    res.json({
      success: true,
      task: {
        ...updated,
        requirements: JSON.parse(updated.requirements || '[]')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/tasks/assignments
 * List all task assignments with intern and task details
 */
router.get('/assignments', async (req, res) => {
  try {
    const { internEmail, taskId, status } = req.query;
    let sql = `
      SELECT a.*, i.name as intern_name, i.status as intern_status, i.end_date, t.title as task_title, t.module 
      FROM assignments a
      JOIN interns i ON a.intern_id = i.id
      JOIN tasks t ON a.task_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (internEmail) {
      sql += ' AND a.intern_email = ?';
      params.push(internEmail);
    }

    if (taskId) {
      sql += ' AND a.task_id = ?';
      params.push(taskId);
    }

    if (status) {
      sql += ' AND a.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY a.created_at DESC;';
    const assignments = await query(sql, params);
    res.json({ success: true, count: assignments.length, assignments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/tasks/assignments
 * Admin assigns a task to an intern
 */
router.post('/assignments', async (req, res) => {
  try {
    const { internEmail, taskId } = req.body;
    if (!internEmail || !taskId) {
      return res.status(400).json({ success: false, error: 'internEmail and taskId are required' });
    }

    const intern = await get('SELECT * FROM interns WHERE email = ?;', [internEmail.trim().toLowerCase()]);
    if (!intern) {
      return res.status(404).json({ success: false, error: 'Intern not found' });
    }

    const task = await get('SELECT * FROM tasks WHERE id = ?;', [taskId.trim().toUpperCase()]);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Check internship active
    const { active, reason } = await checkInternshipActive(intern.id);
    if (!active) {
      return res.status(400).json({ success: false, error: `Cannot assign task: ${reason}` });
    }

    // Prevent duplicate assignment
    const existing = await get(
      'SELECT id, status FROM assignments WHERE intern_email = ? AND task_id = ?;',
      [intern.email, task.id]
    );

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Intern is already assigned to ${task.id} (Status: ${existing.status})`
      });
    }

    const assignmentId = `ASG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    await run(
      `INSERT INTO assignments (id, intern_id, intern_email, task_id, status, assigned_at, attempts, created_at)
       VALUES (?, ?, ?, ?, 'ASSIGNED', datetime('now'), 1, datetime('now'));`,
      [assignmentId, intern.id, intern.email, task.id]
    );

    await run('UPDATE interns SET current_task_id = ?, updated_at = datetime("now") WHERE id = ?;', [task.id, intern.id]);

    // Send notification
    await sendEmail({
      idempotencyKey: `manual_asg_${assignmentId}`,
      to: intern.email,
      subject: `New Task Assignment: ${task.id} - ${task.title}`,
      html: `<p>Dear ${intern.name}, you have been assigned to <strong>${task.id}: ${task.title}</strong>.</p>`,
      text: `You have been assigned to ${task.id}: ${task.title}`,
      emailType: 'TASK_ASSIGNED',
      ccAdmin: true
    });

    res.status(201).json({
      success: true,
      assignmentId,
      intern: intern.email,
      task: task.id
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
