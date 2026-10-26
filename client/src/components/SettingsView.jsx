import React, { useState, useEffect } from 'react';

export default function SettingsView({ onSettingsSaved }) {
  const [settings, setSettings] = useState({
    AI_PROVIDER: 'DEMO_DETERMINISTIC',
    ADMIN_EMAIL: 'coordinator@company.com',
    DEFAULT_INTERNSHIP_DAYS: '10',
    TIMEZONE: 'Asia/Kolkata',
    SAFE_EMAIL_MODE: 'true'
  });

  const [envState, setEnvState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success) {
        setSettings(prev => ({ ...prev, ...data.settings }));
        setEnvState(data.envState);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSavedSuccess(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
      const data = await res.json();
      if (data.success) {
        setSavedSuccess(true);
        if (onSettingsSaved) onSettingsSaved();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="panel" style={{ maxWidth: '850px', margin: '0 auto' }}>
        <div className="panel-header">
          <div>
            <h2 className="panel-title">⚙️ System Configuration & Integrations</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
              Manage AI providers, administrator notification contacts, internship durations, and live email credentials.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            color: '#34d399',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '18px',
            fontSize: '0.88rem'
          }}>
            ✔ System settings successfully persisted in SQLite!
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* General Internship Policy */}
          <div style={{ marginBottom: '22px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', color: '#818cf8' }}>
              1. Internship Lifecycle Policy
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Default Internship Duration (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  className="input"
                  value={settings.DEFAULT_INTERNSHIP_DAYS}
                  onChange={(e) => setSettings({ ...settings, DEFAULT_INTERNSHIP_DAYS: e.target.value })}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                  System Timezone
                </label>
                <input
                  type="text"
                  className="input"
                  value={settings.TIMEZONE}
                  onChange={(e) => setSettings({ ...settings, TIMEZONE: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Admin Email Notifications */}
          <div style={{ marginBottom: '22px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', color: '#818cf8' }}>
              2. Coordinator Notification Email
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '8px' }}>
              All intern email dispatches CC this address, and dedicated AI Review Audit Reports are delivered here.
            </p>
            <input
              type="email"
              required
              className="input"
              value={settings.ADMIN_EMAIL}
              onChange={(e) => setSettings({ ...settings, ADMIN_EMAIL: e.target.value })}
            />
          </div>

          {/* AI Provider Config */}
          <div style={{ marginBottom: '22px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '10px', color: '#818cf8' }}>
              3. AI Reviewer Provider
            </h3>
            <select
              className="select"
              value={settings.AI_PROVIDER}
              onChange={(e) => setSettings({ ...settings, AI_PROVIDER: e.target.value })}
              style={{ marginBottom: '8px' }}
            >
              <option value="DEMO_DETERMINISTIC">DEMO: Deterministic Evaluator (No API key needed)</option>
              <option value="GEMINI_1.5_FLASH">Google Gemini 1.5 Flash (via GEMINI_API_KEY)</option>
              <option value="OPENAI_GPT_4O_MINI">OpenAI GPT-4o-mini (via OPENAI_API_KEY)</option>
            </select>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
              Environment Keys Status: Gemini: {envState?.geminiConfigured ? '✔ Active' : 'Not detected in .env'} | OpenAI: {envState?.openaiConfigured ? '✔ Active' : 'Not detected in .env'}
            </div>
          </div>

          {/* Live Gmail SMTP Setup Guide */}
          <div style={{ marginBottom: '24px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', color: '#f59e0b' }}>
              4. Gmail SMTP Integration Instructions
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: '1.6' }}>
              To enable real email delivery to live recipient inboxes:
            </p>
            <ol style={{ paddingLeft: '20px', fontSize: '0.84rem', color: '#cbd5e1', lineHeight: '1.7', marginTop: '6px' }}>
              <li>Copy <code>.env.example</code> to <code>server/.env</code></li>
              <li>Set <code>EMAIL_USER=your-email@gmail.com</code></li>
              <li>Enable Google 2-Step Verification in your Google Account security settings</li>
              <li>Generate a 16-character <strong>Google App Password</strong> (under Security → 2-Step Verification → App passwords)</li>
              <li>Set <code>EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx</code> in <code>server/.env</code></li>
              <li>Restart the backend server and test via the Email Outbox "Send Verification Test Email" button.</li>
            </ol>
            <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#94a3b8' }}>
              <em>Status: {envState?.gmailConfigured ? '✔ Real Gmail credentials active' : 'Safe test mode (no credentials; logging to SQLite)'}</em>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ padding: '10px 24px' }}>
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
