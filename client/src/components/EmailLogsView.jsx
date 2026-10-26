import React, { useState, useEffect } from 'react';

export default function EmailLogsView({ emailStatus, onRefreshStatus }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testingEmail, setTestingEmail] = useState(false);
  const [selectedLogPreview, setSelectedLogPreview] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/logs');
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    setTestingEmail(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: testEmailTarget || undefined })
      });
      const data = await res.json();
      setTestResult(data);
      fetchLogs();
      if (onRefreshStatus) onRefreshStatus();
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div>
      {/* Email Integration Status Card */}
      <div className="panel" style={{ borderLeft: `4px solid ${emailStatus?.realDeliveryConfigured ? '#10b981' : '#f59e0b'}` }}>
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h3 className="panel-title">
              ✉️ Email Delivery Engine: {emailStatus?.mode}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
              {emailStatus?.realDeliveryConfigured
                ? `Gmail SMTP is actively configured. Outgoing messages are delivered live to inboxes.`
                : `Operating in Safe Test Email Mode. Outgoing emails are safely recorded to SQLite logs below without requiring external credentials.`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <span className={`badge ${emailStatus?.realDeliveryConfigured ? 'badge-success' : 'badge-neutral'}`}>
              {emailStatus?.realDeliveryConfigured ? 'Live SMTP: Connected' : 'Safe Mode: Enabled'}
            </span>
          </div>
        </div>

        {/* Test Email Box */}
        <form onSubmit={handleSendTestEmail} style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', background: 'rgba(255, 255, 255, 0.03)', padding: '14px', borderRadius: '8px' }}>
          <input
            type="email"
            className="input"
            placeholder="Recipient email address for test (defaults to Admin Email)..."
            value={testEmailTarget}
            onChange={(e) => setTestEmailTarget(e.target.value)}
            style={{ flex: 1, minWidth: '280px' }}
          />
          <button type="submit" className="btn btn-primary" disabled={testingEmail}>
            {testingEmail ? 'Sending Test...' : '🚀 Send Verification Test Email'}
          </button>
        </form>

        {testResult && (
          <div style={{
            marginTop: '14px',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            background: testResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${testResult.success ? '#10b981' : '#ef4444'}`,
            color: testResult.success ? '#34d399' : '#f87171'
          }}>
            {testResult.message}
          </div>
        )}
      </div>

      {/* Email Outbox & Logs Table */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">📋 Outbox & Audit Logs ({logs.length})</h3>
          <button className="btn btn-secondary btn-sm" onClick={fetchLogs}>
            Refresh Logs
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Type</th>
                <th>Recipient (To)</th>
                <th>Subject</th>
                <th>Timestamp</th>
                <th>Content Preview</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="empty-state">Loading email logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan="6" className="empty-state">No email logs recorded yet</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td>
                      <span className={`badge ${
                        log.status === 'SENT' ? 'badge-success' :
                        log.status === 'SIMULATED' ? 'badge-neutral' :
                        'badge-danger'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                        {log.email_type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.intern_email}</div>
                      {log.admin_email && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>CC: {log.admin_email}</div>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{log.subject}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{log.sent_at}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedLogPreview(log)}
                      >
                        Inspect Preview
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Preview Modal */}
      {selectedLogPreview && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3 className="panel-title">{selectedLogPreview.subject}</h3>
                <span className={`badge ${selectedLogPreview.status === 'SENT' ? 'badge-success' : 'badge-neutral'}`}>
                  {selectedLogPreview.status}
                </span>
              </div>
              <button className="modal-close" onClick={() => setSelectedLogPreview(null)}>×</button>
            </div>

            <div style={{ fontSize: '0.85rem', lineHeight: '1.7', color: 'var(--text-muted)', marginBottom: '14px' }}>
              <div><strong>Recipient:</strong> {selectedLogPreview.intern_email}</div>
              <div><strong>Admin CC:</strong> {selectedLogPreview.admin_email || 'None'}</div>
              <div><strong>Event Type:</strong> {selectedLogPreview.email_type}</div>
              <div><strong>Dispatched At:</strong> {selectedLogPreview.sent_at}</div>
              {selectedLogPreview.idempotency_key && (
                <div><strong>Idempotency Key:</strong> <code>{selectedLogPreview.idempotency_key}</code></div>
              )}
            </div>

            <div className="code-box" style={{ whiteSpace: 'pre-wrap' }}>
              {selectedLogPreview.content_preview || 'No preview available'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedLogPreview(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
