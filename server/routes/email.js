import express from 'express';
import { query, get, run } from '../db/database.js';
import { sendEmail, isRealEmailConfigured, getAdminEmail } from '../services/emailService.js';

const router = express.Router();

/**
 * GET /api/email/status
 * Returns current configuration status of email
 */
router.get('/status', async (req, res) => {
  try {
    const isConfigured = isRealEmailConfigured();
    const adminEmail = await getAdminEmail();
    const sender = process.env.EMAIL_USER ? `${process.env.EMAIL_USER.substring(0, 3)}***@gmail.com` : null;

    res.json({
      success: true,
      realDeliveryConfigured: isConfigured,
      mode: isConfigured ? 'REAL_GMAIL_SMTP' : 'SAFE_SIMULATION_MODE',
      senderEmailConfigured: Boolean(process.env.EMAIL_USER),
      maskedSender: sender,
      adminEmail
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/email/logs
 * List all email logs from SQLite
 */
router.get('/logs', async (req, res) => {
  try {
    const { emailType, status, internEmail } = req.query;
    let sql = 'SELECT * FROM email_logs WHERE 1=1';
    const params = [];

    if (emailType) {
      sql += ' AND email_type = ?';
      params.push(emailType);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (internEmail) {
      sql += ' AND intern_email = ?';
      params.push(internEmail.trim().toLowerCase());
    }

    sql += ' ORDER BY sent_at DESC LIMIT 100;';
    const logs = await query(sql, params);

    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/email/test
 * Send a verification test email
 */
router.post('/test', async (req, res) => {
  try {
    const { targetEmail } = req.body;
    const recipient = targetEmail || await getAdminEmail();

    if (!recipient) {
      return res.status(400).json({ success: false, error: 'Recipient email address is required' });
    }

    const testId = `test_${Date.now()}`;
    const result = await sendEmail({
      idempotencyKey: testId,
      to: recipient,
      subject: `[Test Email] AI Intern Review Automation Integration Check`,
      html: `
        <div style="font-family: sans-serif; max-width: 550px; padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px;">
          <h2 style="color: #0284c7;">Email Integration Verification</h2>
          <p>This is a verification test message from your AI Intern Task Allocation and Review System.</p>
          <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 10px; border-radius: 6px;">
            <p style="margin: 0; color: #166534; font-weight: bold;">✔ Connection verified successfully!</p>
          </div>
          <p style="color: #64748b; font-size: 13px; margin-top: 20px;">Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
      text: 'AI Intern Automation System: Test email successfully sent.',
      emailType: 'TEST_EMAIL',
      ccAdmin: false
    });

    res.json({
      success: true,
      result,
      recipient,
      realDelivery: result.realDelivery,
      status: result.status,
      message: result.realDelivery
        ? `Real email sent to ${recipient}. Please check your inbox or spam folder.`
        : `Safe simulation mode: Email saved to SQLite logs (no real SMTP credentials provided in .env).`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
