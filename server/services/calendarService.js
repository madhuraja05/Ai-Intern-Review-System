import { get, query, run } from '../db/database.js';
import { sendEmail } from './emailService.js';
import { checkInternshipActive } from './reviewCycle.js';

/**
 * Schedule a new review session.
 * Enforces internship active check so reviews are not scheduled past end date.
 */
export async function scheduleReview({
  internId,
  internEmail,
  taskId,
  reviewDate,
  reviewTime,
  timezone = 'Asia/Kolkata',
  meetUrl,
  prepInstructions
}) {
  // Validate intern
  const intern = await get('SELECT * FROM interns WHERE id = ? OR email = ?;', [internId || '', internEmail || '']);
  if (!intern) {
    throw new Error('Intern not found');
  }

  // Validate task
  const task = await get('SELECT * FROM tasks WHERE id = ?;', [taskId]);
  if (!task) {
    throw new Error('Task not found');
  }

  // Check internship active & verify review date is not beyond end date
  const { active, reason } = await checkInternshipActive(intern.id);
  if (!active) {
    throw new Error(`Cannot schedule review: ${reason}`);
  }

  if (reviewDate > intern.end_date) {
    throw new Error(`Review date (${reviewDate}) exceeds the intern's scheduled end date (${intern.end_date}).`);
  }

  const scheduleId = `SCHED-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const finalMeetUrl = meetUrl || `https://meet.google.com/new`;
  const defaultPrep = prepInstructions || `Please prepare to share your screen, present your code implementation, and show test results for ${task.id}.`;

  await run(
    `INSERT INTO review_schedules (id, intern_id, intern_email, task_id, review_date, review_time, timezone, meet_url, prep_instructions, status, reminder_sent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', 0, datetime('now'));`,
    [
      scheduleId,
      intern.id,
      intern.email,
      task.id,
      reviewDate,
      reviewTime,
      timezone,
      finalMeetUrl,
      defaultPrep
    ]
  );

  // Send invitation email
  await sendEmail({
    idempotencyKey: `sched_invitation_${scheduleId}`,
    to: intern.email,
    subject: `Review Scheduled: ${task.id} (${task.title}) on ${reviewDate} at ${reviewTime}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b;">Review Session Scheduled</h2>
        <p>Dear ${intern.name},</p>
        <p>A review discussion has been scheduled for your current task.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr><td style="padding: 6px 0; color: #64748b;"><strong>Task:</strong></td><td><strong>${task.id}</strong> - ${task.title}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;"><strong>Date & Time:</strong></td><td>${reviewDate} at ${reviewTime} (${timezone})</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;"><strong>Meeting Link:</strong></td><td><a href="${finalMeetUrl}" style="color: #2563eb;">${finalMeetUrl}</a></td></tr>
        </table>
        <div style="background: #f8fafc; padding: 12px; border-radius: 6px; font-size: 14px;">
          <strong>Preparation:</strong>
          <p style="margin: 5px 0 0 0;">${defaultPrep}</p>
        </div>
      </div>
    `,
    text: `Review scheduled for ${task.id} on ${reviewDate} at ${reviewTime}. Meet Link: ${finalMeetUrl}`,
    emailType: 'REVIEW_INVITATION',
    ccAdmin: true
  });

  return {
    scheduleId,
    internName: intern.name,
    internEmail: intern.email,
    taskId: task.id,
    taskTitle: task.title,
    reviewDate,
    reviewTime,
    meetUrl: finalMeetUrl
  };
}

/**
 * Generate iCalendar .ics format string for Google Calendar or Outlook import
 */
export function generateIcsFile({ schedule, task, intern }) {
  const dtStart = schedule.review_date.replace(/-/g, '') + 'T' + schedule.review_time.replace(/:/g, '') + '00';
  
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI Intern Review System//EN',
    'BEGIN:VEVENT',
    `UID:${schedule.id}@internsystem.local`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${dtStart}`,
    `SUMMARY:Intern Task Review: ${task.id} - ${task.title}`,
    `DESCRIPTION:Review discussion with ${intern.name} (${intern.email})\\nMeeting Link: ${schedule.meet_url}\\nInstructions: ${schedule.prep_instructions}`,
    `LOCATION:${schedule.meet_url}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Periodic scheduler check for upcoming/overdue review reminders.
 * Runs safely and survives backend restarts.
 */
export async function checkReviewReminders() {
  const pendingReminders = await query(
    `SELECT s.*, i.name as intern_name, t.title as task_title 
     FROM review_schedules s
     JOIN interns i ON s.intern_id = i.id
     JOIN tasks t ON s.task_id = t.id
     WHERE s.status = 'SCHEDULED' AND s.reminder_sent = 0;`
  );

  const todayStr = new Date().toISOString().split('T')[0];

  for (const item of pendingReminders) {
    if (item.review_date <= todayStr) {
      // Mark reminder sent
      await run('UPDATE review_schedules SET reminder_sent = 1 WHERE id = ?;', [item.id]);

      // Dispatch reminder email
      await sendEmail({
        idempotencyKey: `review_reminder_${item.id}`,
        to: item.intern_email,
        subject: `Reminder: Today's Task Review for ${item.task_id}`,
        html: `<p>Hi ${item.intern_name}, this is a reminder of your review discussion today at ${item.review_time} for ${item.task_id}. Meet link: <a href="${item.meet_url}">${item.meet_url}</a>.</p>`,
        text: `Reminder: Review for ${item.task_id} today at ${item.review_time}. Link: ${item.meet_url}`,
        emailType: 'REVIEW_REMINDER',
        ccAdmin: true
      });
    }
  }
}
