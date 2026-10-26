import nodemailer from 'nodemailer';
import { run, get, query } from '../db/database.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure server/.env is loaded regardless of execution working directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

/**
 * Creates and returns the nodemailer transporter if real credentials exist.
 */
function getTransporter() {
  const user = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : null;
  const pass = process.env.EMAIL_APP_PASSWORD ? process.env.EMAIL_APP_PASSWORD.trim() : null;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });
}

/**
 * Get current admin email setting.
 * Prioritizes ADMIN_EMAIL from server/.env, then system_settings table, then fallback.
 */
export async function getAdminEmail() {
  const envAdmin = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.trim() : null;
  if (envAdmin) {
    return envAdmin;
  }
  const setting = await get('SELECT value FROM system_settings WHERE key = "ADMIN_EMAIL";');
  return setting?.value || 'coordinator@company.com';
}

/**
 * Check if real email delivery is configured
 */
export function isRealEmailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);
}

/**
 * Safe email dispatcher.
 * Handles idempotency, safe logging, SQLite audit recording, and admin copies.
 */
export async function sendEmail({
  idempotencyKey,
  to,
  subject,
  html,
  text,
  emailType,
  ccAdmin = true
}) {
  // 1. Check idempotency to prevent duplicate emails
  if (idempotencyKey) {
    const existing = await get('SELECT id, status FROM email_logs WHERE idempotency_key = ?;', [idempotencyKey]);
    if (existing) {
      console.log(`[Email] Skipping duplicate email for idempotency key: ${idempotencyKey}`);
      return { skipped: true, reason: 'Duplicate event detected (idempotent)', logId: existing.id, status: existing.status };
    }
  }

  const adminEmail = await getAdminEmail();
  const transporter = getTransporter();
  const logId = `EML-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const preview = (text || html || '').replace(/<[^>]+>/g, '').substring(0, 160);

  let deliveryStatus = 'SIMULATED';
  let errorMessage = null;

  if (transporter) {
    try {
      const shouldCcAdmin = Boolean(ccAdmin && adminEmail && adminEmail.toLowerCase() !== to.toLowerCase());
      
      const info = await transporter.sendMail({
        from: `"AI Intern Automation System" <${process.env.EMAIL_USER}>`,
        to: to,
        cc: shouldCcAdmin ? adminEmail : undefined,
        subject: subject,
        text: text,
        html: html
      });

      deliveryStatus = 'SENT';
      console.log(`[Email] REAL email delivered to ${to} (MessageId: ${info.messageId})`);
    } catch (err) {
      deliveryStatus = 'FAILED';
      errorMessage = err.message || 'Unknown SMTP error';
      console.error(`[Email] REAL email delivery failed to ${to}:`, errorMessage);
    }
  } else {
    // Safe simulation mode
    console.log(`[Email] [SAFE TEST MODE - SIMULATED] To: ${to} | Subject: "${subject}" | Admin CC: ${adminEmail}`);
  }

  // 2. Persist record in SQLite email_logs
  try {
    await run(
      `INSERT INTO email_logs (id, idempotency_key, intern_email, admin_email, email_type, subject, content_preview, status, error_message, sent_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'));`,
      [logId, idempotencyKey || null, to, adminEmail, emailType, subject, preview, deliveryStatus, errorMessage]
    );
  } catch (dbErr) {
    console.error('[Email] Failed to persist email_log:', dbErr.message);
  }

  return {
    logId,
    status: deliveryStatus,
    realDelivery: Boolean(transporter && deliveryStatus === 'SENT'),
    error: errorMessage
  };
}

/**
 * Send Review Details specifically to the ADMIN_EMAIL in server/.env.
 * Explicitly includes: intern name, task ID, review decision, mentor feedback, and review date.
 */
export async function sendAdminReviewReport({
  intern,
  task,
  review,
  findings,
  nextAction
}) {
  const adminEmail = await getAdminEmail();
  if (!adminEmail) {
    console.warn('[Email] Cannot send admin review report: ADMIN_EMAIL is not configured');
    return { success: false, error: 'ADMIN_EMAIL is not configured' };
  }

  // Extract all required fields flexibly
  const internName = intern?.name || review?.intern_name || 'Intern';
  const internEmail = intern?.email || review?.intern_email || '';
  const taskId = task?.id || review?.task_id || 'N/A';
  const taskTitle = task?.title || review?.task_title || '';
  const decision = review?.overall_decision || review?.decision || 'PROCESSED';
  const mentorFeedback = review?.mentor_feedback || review?.mentorFeedback || 'No mentor feedback provided.';
  const reviewDate = review?.reviewed_at || review?.review_date || review?.reviewDate || new Date().toISOString();
  const evaluatorMode = review?.evaluator_mode || review?.evaluatorMode || 'AI_AUTO';
  const internalReport = review?.internal_report || review?.internalReport || '';
  const resolvedNextAction = nextAction || review?.nextAction || 'Review saved in database.';
  const reviewFindings = findings || (typeof review?.requirement_findings === 'string' ? JSON.parse(review.requirement_findings || '[]') : review?.requirement_findings) || [];
  const reviewId = review?.id || `REV-${Date.now()}`;

  const subject = `[Review Saved] ${internName} - ${taskId}: ${decision}`;
  
  const findingsRows = (reviewFindings || []).map(f => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>${escapeHtml(f.requirement)}</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: ${f.status === 'MET' ? '#16a34a' : f.status === 'PARTIALLY_MET' ? '#ca8a04' : '#dc2626'};">${f.status}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(f.evidence || 'N/A')}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
      <h2 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">Task Review Saved — Review Details</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr><td style="padding: 8px 0; color: #64748b; width: 140px;"><strong>Intern Name:</strong></td><td><strong style="color: #0f172a;">${escapeHtml(internName)}</strong> ${internEmail ? `(${escapeHtml(internEmail)})` : ''}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b;"><strong>Task ID:</strong></td><td><strong>${escapeHtml(taskId)}</strong>${taskTitle ? ` — ${escapeHtml(taskTitle)}` : ''}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b;"><strong>Review Decision:</strong></td><td><span style="display:inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; background: ${decision === 'PASS' ? '#dcfce7; color: #166534;' : decision === 'NEEDS_CHANGES' ? '#fef9c3; color: #854d0e;' : '#fee2e2; color: #991b1b;'}">${escapeHtml(decision)}</span></td></tr>
        <tr><td style="padding: 8px 0; color: #64748b;"><strong>Review Date:</strong></td><td>${escapeHtml(reviewDate)}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b;"><strong>Evaluator Mode:</strong></td><td>${escapeHtml(evaluatorMode)}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b;"><strong>Next Action:</strong></td><td>${escapeHtml(resolvedNextAction)}</td></tr>
      </table>

      <h3 style="color: #1e293b; margin-top: 24px; margin-bottom: 8px;">Senior Developer Mentor Feedback</h3>
      <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 14px; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-line; margin-bottom: 20px;">
        ${escapeHtml(mentorFeedback)}
      </div>

      ${reviewFindings && reviewFindings.length > 0 ? `
      <h3 style="color: #1e293b; margin-top: 20px; margin-bottom: 8px;">Requirement Breakdown</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Requirement</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left; width: 120px;">Status</th>
            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Evidence</th>
          </tr>
        </thead>
        <tbody>
          ${findingsRows}
        </tbody>
      </table>` : ''}

      ${internalReport ? `
      <h3 style="color: #1e293b; margin-top: 20px; margin-bottom: 8px;">Internal Coordinator Summary</h3>
      <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.5; color: #334155;">
        ${escapeHtml(internalReport)}
      </div>` : ''}
    </div>
  `;

  const text = `
===================================================
TASK REVIEW SAVED - DETAILS NOTIFICATION
===================================================
Intern Name:     ${internName} (${internEmail})
Task ID:         ${taskId}${taskTitle ? ' - ' + taskTitle : ''}
Review Decision: ${decision}
Review Date:     ${reviewDate}
Evaluator Mode:  ${evaluatorMode}
Next Action:     ${resolvedNextAction}
---------------------------------------------------
Senior Developer Mentor Feedback:
${mentorFeedback}
---------------------------------------------------
${internalReport ? `Internal Coordinator Summary:\n${internalReport}\n---------------------------------------------------\n` : ''}Dispatched by AI Intern Review & Automation System
  `.trim();

  return sendEmail({
    idempotencyKey: `admin_report_${reviewId}`,
    to: adminEmail,
    subject: subject,
    html: html,
    text: text,
    emailType: 'ADMIN_REVIEW_REPORT',
    ccAdmin: false // Already sent to admin
  });
}

export const sendReviewDetailsToAdmin = sendAdminReviewReport;

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
