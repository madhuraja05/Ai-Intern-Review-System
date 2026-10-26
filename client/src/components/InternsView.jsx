import React, { useState } from 'react';

export default function InternsView({ interns, onRefreshInterns, onSelectInternForSubmission }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingIntern, setEditingIntern] = useState(null);
  const [selectedInternDetail, setSelectedInternDetail] = useState(null);
  const [detailData, setDetailData] = useState(null);

  // Add form state
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    start_date: new Date().toISOString().split('T')[0],
    duration_days: 10
  });

  // CSV Import state
  const [csvText, setCsvText] = useState('');
  const [importReport, setImportReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filtered interns
  const filteredInterns = (interns || []).filter(i => {
    const matchesSearch = 
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Handle Add Intern
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const res = await fetch('/api/interns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm)
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || 'Failed to add intern');
        return;
      }
      setIsAddModalOpen(false);
      setAddForm({ name: '', email: '', start_date: new Date().toISOString().split('T')[0], duration_days: 10 });
      onRefreshInterns();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  // Handle Edit Intern
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingIntern) return;
    try {
      const res = await fetch(`/api/interns/${editingIntern.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingIntern)
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error);
        return;
      }
      setEditingIntern(null);
      onRefreshInterns();
    } catch (err) {
      alert(err.message);
    }
  };

  // Handle CSV Import
  const handleCsvImport = async () => {
    if (!csvText.trim()) return;
    setLoading(true);
    setImportReport(null);
    try {
      const res = await fetch('/api/interns/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData: csvText })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error);
      } else {
        setImportReport(data);
        onRefreshInterns();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Open Intern Detail View
  const handleViewDetail = async (intern) => {
    setSelectedInternDetail(intern);
    setDetailData(null);
    try {
      const res = await fetch(`/api/interns/${intern.id}`);
      const data = await res.json();
      if (data.success) {
        setDetailData(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      {/* Header and Controls */}
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 className="panel-title">👥 Intern Management ({interns.length} Registered)</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
              Add, monitor, search, and manage up to 100 interns with automatic task sequencing & lifecycle tracking.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)}>
              📥 Import CSV
            </button>
            <button className="btn btn-primary" onClick={() => { setIsAddModalOpen(true); setErrorMsg(''); }}>
              ➕ Register Intern
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input"
            placeholder="Search by name, email, or intern ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, minWidth: '220px' }}
          />
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {/* Interns Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name & Email</th>
                <th>Timeline (Start → End)</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Current Task</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInterns.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">No interns matching your criteria</td>
                </tr>
              ) : (
                filteredInterns.map(intern => (
                  <tr key={intern.id}>
                    <td><code>{intern.id}</code></td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{intern.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{intern.email}</div>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>
                      {intern.start_date} <span style={{ color: 'var(--text-sub)' }}>→</span> <strong>{intern.end_date}</strong>
                    </td>
                    <td>{intern.duration_days} Days</td>
                    <td>
                      <span className={`badge ${intern.status === 'ACTIVE' ? 'badge-success' : intern.status === 'EXPIRED' ? 'badge-danger' : 'badge-neutral'}`}>
                        {intern.status}
                      </span>
                    </td>
                    <td>
                      {intern.current_task_id ? (
                        <span className="badge badge-info">{intern.current_task_id}</span>
                      ) : (
                        <span style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>None</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewDetail(intern)}
                          title="View complete lifecycle & review history"
                        >
                          Lifecycle
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setEditingIntern({ ...intern })}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Intern Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="panel-title">➕ Register New Intern</h3>
              <button className="modal-close" onClick={() => setIsAddModalOpen(false)}>×</button>
            </div>
            {errorMsg && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '0.88rem' }}>
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleAddSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Full Name</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="e.g. Maya Krishnan"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Email Address</label>
                <input
                  type="email"
                  required
                  className="input"
                  placeholder="e.g. maya.krishnan@example.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Start Date</label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={addForm.start_date}
                    onChange={(e) => setAddForm({ ...addForm, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Duration (Calendar Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    required
                    className="input"
                    value={addForm.duration_days}
                    onChange={(e) => setAddForm({ ...addForm, duration_days: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', color: '#a5b4fc', marginBottom: '18px' }}>
                ℹ️ Initial task <strong>TASK-101</strong> will be automatically allocated upon registration, and an assignment email will be dispatched.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save & Allocate Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Intern Modal */}
      {editingIntern && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="panel-title">✏️ Edit Intern Details ({editingIntern.id})</h3>
              <button className="modal-close" onClick={() => setEditingIntern(null)}>×</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Full Name</label>
                <input
                  type="text"
                  required
                  className="input"
                  value={editingIntern.name}
                  onChange={(e) => setEditingIntern({ ...editingIntern, name: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Email Address</label>
                <input
                  type="email"
                  required
                  className="input"
                  value={editingIntern.email}
                  onChange={(e) => setEditingIntern({ ...editingIntern, email: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Start Date</label>
                  <input
                    type="date"
                    className="input"
                    value={editingIntern.start_date}
                    onChange={(e) => setEditingIntern({ ...editingIntern, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>End Date</label>
                  <input
                    type="date"
                    className="input"
                    value={editingIntern.end_date}
                    onChange={(e) => setEditingIntern({ ...editingIntern, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Status</label>
                <select
                  className="select"
                  value={editingIntern.status}
                  onChange={(e) => setEditingIntern({ ...editingIntern, status: e.target.value })}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingIntern(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Intern</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="panel-title">📥 Bulk CSV Import Interns</h3>
              <button className="modal-close" onClick={() => { setIsImportModalOpen(false); setImportReport(null); }}>×</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '14px' }}>
              Paste CSV content below or use the template. Includes validation for email syntax and duplicate detection.
            </p>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginBottom: '12px' }}
              onClick={() => setCsvText("name,email,start_date,duration_days\nKavita Raman,kavita.raman@example.com,2026-10-26,10\nNaveen Kumar,naveen.kumar@example.com,2026-10-26,10\nDeepa Menon,deepa.menon@example.com,2026-10-26,10")}
            >
              📋 Load Sample CSV Template
            </button>

            <textarea
              className="textarea"
              style={{ minHeight: '140px', marginBottom: '14px' }}
              placeholder="name,email,start_date,duration_days&#10;John Doe,john.doe@example.com,2026-10-26,10"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />

            {importReport && (
              <div style={{ background: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px' }}>Import Summary:</div>
                <div style={{ display: 'flex', gap: '14px', fontSize: '0.85rem', marginBottom: '8px' }}>
                  <span style={{ color: '#34d399' }}>✔ Imported: {importReport.summary.importedCount}</span>
                  <span style={{ color: '#fbbf24' }}>⚠ Skipped (Duplicates): {importReport.summary.skippedCount}</span>
                  <span style={{ color: '#f87171' }}>✖ Errors: {importReport.summary.errorCount}</span>
                </div>
                {importReport.results.errors?.length > 0 && (
                  <div style={{ fontSize: '0.78rem', color: '#f87171' }}>
                    Errors: {importReport.results.errors.map((e, idx) => <div key={idx}>Line {e.line}: {e.error}</div>)}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setIsImportModalOpen(false); setImportReport(null); }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCsvImport}
                disabled={loading || !csvText.trim()}
              >
                {loading ? 'Validating...' : 'Validate & Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intern Detail Lifecycle Drawer */}
      {selectedInternDetail && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <div>
                <h3 className="panel-title">{selectedInternDetail.name} — Lifecycle & Audit</h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>
                  ID: {selectedInternDetail.id} | Email: {selectedInternDetail.email} | Status: {selectedInternDetail.status}
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedInternDetail(null)}>×</button>
            </div>

            {!detailData ? (
              <div className="empty-state">Loading intern history...</div>
            ) : (
              <div>
                {/* Active check alert if expired */}
                {!detailData.activeStatus?.active && (
                  <div className="alert-pill">
                    <span>⚠️ {detailData.activeStatus?.reason}</span>
                    <span className="badge badge-danger">Lifecycle Inactive</span>
                  </div>
                )}

                {/* Timeline info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '8px', marginBottom: '18px', fontSize: '0.85rem' }}>
                  <div><span style={{ color: 'var(--text-sub)' }}>Start Date:</span> <strong>{detailData.intern.start_date}</strong></div>
                  <div><span style={{ color: 'var(--text-sub)' }}>End Date:</span> <strong>{detailData.intern.end_date}</strong></div>
                  <div><span style={{ color: 'var(--text-sub)' }}>Duration:</span> <strong>{detailData.intern.duration_days} Days</strong></div>
                  <div><span style={{ color: 'var(--text-sub)' }}>Current Task:</span> <strong>{detailData.intern.current_task_id || 'None'}</strong></div>
                </div>

                {/* Assignments history */}
                <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--primary)' }}>Task Assignments</h4>
                <div className="table-container" style={{ marginBottom: '18px' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Task ID</th>
                        <th>Task Title</th>
                        <th>Status</th>
                        <th>Assigned At</th>
                        <th>Passed At</th>
                        <th>Attempts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.assignments.length === 0 ? (
                        <tr><td colSpan="6" className="empty-state">No assignments recorded</td></tr>
                      ) : (
                        detailData.assignments.map(asg => (
                          <tr key={asg.id}>
                            <td><code>{asg.task_id}</code></td>
                            <td>{asg.task_title}</td>
                            <td>
                              <span className={`badge ${asg.status === 'PASSED' ? 'badge-success' : asg.status === 'NEEDS_CHANGES' ? 'badge-warning' : asg.status === 'PENDING_AT_INTERNSHIP_END' ? 'badge-danger' : 'badge-info'}`}>
                                {asg.status}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.8rem' }}>{asg.assigned_at?.split(' ')[0]}</td>
                            <td style={{ fontSize: '0.8rem' }}>{asg.passed_at ? asg.passed_at.split(' ')[0] : '—'}</td>
                            <td>{asg.attempts}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Review Decisions History */}
                <h4 style={{ fontSize: '0.95rem', marginBottom: '8px', color: 'var(--primary)' }}>AI Review & Evaluation History</h4>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Decision</th>
                        <th>Evaluator</th>
                        <th>Mentor Feedback Preview</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.reviews.length === 0 ? (
                        <tr><td colSpan="5" className="empty-state">No reviews recorded yet</td></tr>
                      ) : (
                        detailData.reviews.map(rev => (
                          <tr key={rev.id}>
                            <td><code>{rev.task_id}</code></td>
                            <td>
                              <span className={`badge ${rev.overall_decision === 'PASS' ? 'badge-success' : rev.overall_decision === 'NEEDS_CHANGES' ? 'badge-warning' : 'badge-danger'}`}>
                                {rev.overall_decision}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.78rem' }}>{rev.evaluator_mode}</td>
                            <td style={{ fontSize: '0.82rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {rev.mentor_feedback}
                            </td>
                            <td style={{ fontSize: '0.8rem' }}>{rev.reviewed_at?.split(' ')[0]}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
