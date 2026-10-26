import React, { useState, useEffect } from 'react';

export default function TaskAssignmentsView({ interns, tasks, onRefresh }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ internEmail: '', taskId: '' });
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks/assignments');
      const data = await res.json();
      if (data.success) {
        setAssignments(data.assignments);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleManualAssign = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch('/api/tasks/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignForm)
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error);
        return;
      }
      setIsAssignModalOpen(false);
      setAssignForm({ internEmail: '', taskId: '' });
      fetchAssignments();
      if (onRefresh) onRefresh();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div>
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 className="panel-title">🎯 Intern Task Assignments</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
              Tracks each intern's assignment lifecycle. Passes automatically allocate next tasks; incomplete tasks at end date show <code>PENDING_AT_INTERNSHIP_END</code>.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => { setIsAssignModalOpen(true); setErrorMsg(''); }}>
            ➕ Manual Task Assignment
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Intern Name & Email</th>
                <th>Task ID</th>
                <th>Task Title</th>
                <th>Status</th>
                <th>Assigned Date</th>
                <th>Passed Date</th>
                <th>Revision Attempts</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="empty-state">Loading assignments...</td></tr>
              ) : assignments.length === 0 ? (
                <tr><td colSpan="7" className="empty-state">No assignments recorded</td></tr>
              ) : (
                assignments.map(asg => (
                  <tr key={asg.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{asg.intern_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{asg.intern_email}</div>
                    </td>
                    <td><code>{asg.task_id}</code></td>
                    <td style={{ fontWeight: 600 }}>{asg.task_title}</td>
                    <td>
                      <span className={`badge ${
                        asg.status === 'PASSED' ? 'badge-success' :
                        asg.status === 'NEEDS_CHANGES' ? 'badge-warning' :
                        asg.status === 'PENDING_AT_INTERNSHIP_END' ? 'badge-danger' :
                        'badge-info'
                      }`}>
                        {asg.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{asg.assigned_at?.split(' ')[0]}</td>
                    <td style={{ fontSize: '0.82rem' }}>{asg.passed_at ? asg.passed_at.split(' ')[0] : '—'}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: asg.attempts > 1 ? '#f59e0b' : 'inherit' }}>
                        {asg.attempts}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Assignment Modal */}
      {isAssignModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="panel-title">➕ Assign Task to Intern</h3>
              <button className="modal-close" onClick={() => setIsAssignModalOpen(false)}>×</button>
            </div>
            {errorMsg && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.88rem' }}>
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleManualAssign}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Select Intern</label>
                <select
                  required
                  className="select"
                  value={assignForm.internEmail}
                  onChange={(e) => setAssignForm({ ...assignForm, internEmail: e.target.value })}
                >
                  <option value="">-- Choose an Intern --</option>
                  {interns.map(i => (
                    <option key={i.id} value={i.email}>
                      {i.name} ({i.email}) — Status: {i.status}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Select Task</label>
                <select
                  required
                  className="select"
                  value={assignForm.taskId}
                  onChange={(e) => setAssignForm({ ...assignForm, taskId: e.target.value })}
                >
                  <option value="">-- Choose a Task --</option>
                  {tasks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.id}: {t.title} (#{t.sequence_order})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAssignModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Assign & Send Notification</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
