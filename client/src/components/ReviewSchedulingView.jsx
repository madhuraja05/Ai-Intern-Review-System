import React, { useState, useEffect } from 'react';

export default function ReviewSchedulingView({ interns, tasks, onRefresh }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form state
  const [form, setForm] = useState({
    internEmail: interns[0]?.email || '',
    taskId: 'TASK-101',
    reviewDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    reviewTime: '15:00',
    timezone: 'Asia/Kolkata',
    meetUrl: 'https://meet.google.com/new',
    prepInstructions: 'Please prepare your terminal to demonstrate git log, tests, and code implementation.'
  });

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/schedules');
      const data = await res.json();
      if (data.success) {
        setSchedules(data.schedules);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error);
        return;
      }
      setIsModalOpen(false);
      fetchSchedules();
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleDownloadIcs = (scheduleId) => {
    window.open(`/api/schedules/${scheduleId}/ics`, '_blank');
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 className="panel-title">📅 Review Scheduling & Calendar Sync</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
              Schedule 1-on-1 code reviews. Enforces end-date boundaries and provides instant <code>.ics</code> calendar exports and Google Meet links.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => { setIsModalOpen(true); setErrorMsg(''); }}>
            ➕ Schedule Review Session
          </button>
        </div>

        {/* Schedules Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Intern Name & Email</th>
                <th>Task ID</th>
                <th>Meeting URL</th>
                <th>Status</th>
                <th>Reminder</th>
                <th>Calendar Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="empty-state">Loading schedules...</td></tr>
              ) : schedules.length === 0 ? (
                <tr><td colSpan="7" className="empty-state">No upcoming reviews scheduled</td></tr>
              ) : (
                schedules.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{s.review_date}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{s.review_time} ({s.timezone})</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.intern_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>{s.intern_email}</div>
                    </td>
                    <td><code>{s.task_id}</code></td>
                    <td>
                      <a
                        href={s.meet_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600, fontSize: '0.85rem' }}
                      >
                        🎥 Open Meet Link
                      </a>
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'SCHEDULED' ? 'badge-info' : 'badge-neutral'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${s.reminder_sent ? 'badge-success' : 'badge-neutral'}`}>
                        {s.reminder_sent ? '✔ Dispatched' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDownloadIcs(s.id)}
                        title="Download standard .ics iCalendar file"
                      >
                        📥 Download .ics
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="panel-title">📅 Schedule Review Discussion</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.88rem' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleScheduleSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Select Intern</label>
                <select
                  required
                  className="select"
                  value={form.internEmail}
                  onChange={(e) => setForm({ ...form, internEmail: e.target.value })}
                >
                  {interns.map(i => (
                    <option key={i.id} value={i.email}>
                      {i.name} ({i.email}) — End Date: {i.end_date}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Target Task</label>
                <select
                  required
                  className="select"
                  value={form.taskId}
                  onChange={(e) => setForm({ ...form, taskId: e.target.value })}
                >
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.id}: {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Review Date</label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={form.reviewDate}
                    onChange={(e) => setForm({ ...form, reviewDate: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Review Time</label>
                  <input
                    type="time"
                    required
                    className="input"
                    value={form.reviewTime}
                    onChange={(e) => setForm({ ...form, reviewTime: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Google Meet / Meeting Link (Manual or auto-generated)
                </label>
                <input
                  type="url"
                  required
                  className="input"
                  value={form.meetUrl}
                  onChange={(e) => setForm({ ...form, meetUrl: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Preparation Notes</label>
                <textarea
                  className="textarea"
                  style={{ minHeight: '70px' }}
                  value={form.prepInstructions}
                  onChange={(e) => setForm({ ...form, prepInstructions: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Schedule & Send Invitation</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
