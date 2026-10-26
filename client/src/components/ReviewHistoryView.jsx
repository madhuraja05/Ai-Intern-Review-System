import React, { useState, useEffect } from 'react';

export default function ReviewHistoryView({ onViewReview }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('ALL');

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reviews');
      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const filtered = reviews.filter(r => {
    const matchesSearch =
      r.intern_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.intern_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.task_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDecision = decisionFilter === 'ALL' || r.overall_decision === decisionFilter;
    return matchesSearch && matchesDecision;
  });

  return (
    <div>
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h2 className="panel-title">📜 Historical AI Review Records ({reviews.length})</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
              Complete audit log of all automated and manual evaluations. Preserved across all 10-day lifecycle stages.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchReviews}>
            Refresh
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input"
            placeholder="Search by intern, email, or task ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1, minWidth: '220px' }}
          />
          <select
            className="select"
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            style={{ width: '180px' }}
          >
            <option value="ALL">All Decisions</option>
            <option value="PASS">PASS</option>
            <option value="NEEDS_CHANGES">NEEDS_CHANGES</option>
            <option value="HUMAN_REVIEW_REQUIRED">HUMAN_REVIEW_REQUIRED</option>
          </select>
        </div>

        {/* Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Review ID</th>
                <th>Intern Name & Email</th>
                <th>Task ID</th>
                <th>Decision</th>
                <th>Evaluator Mode</th>
                <th>Reviewed Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="empty-state">Loading history...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7" className="empty-state">No matching review records found</td></tr>
              ) : (
                filtered.map(r => (
                  <tr key={r.id}>
                    <td><code>{r.id}</code></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.intern_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>{r.intern_email}</div>
                    </td>
                    <td><code>{r.task_id}</code></td>
                    <td>
                      <span className={`badge ${
                        r.overall_decision === 'PASS' ? 'badge-success' :
                        r.overall_decision === 'NEEDS_CHANGES' ? 'badge-warning' :
                        'badge-danger'
                      }`}>
                        {r.overall_decision}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>{r.evaluator_mode}</td>
                    <td style={{ fontSize: '0.8rem' }}>{r.reviewed_at}</td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onViewReview(r.id)}
                      >
                        Inspect Findings
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
