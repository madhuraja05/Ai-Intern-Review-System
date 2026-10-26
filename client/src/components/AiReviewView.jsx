import React, { useState, useEffect } from 'react';

export default function AiReviewView({ initialReviewId, onReviewUpdated }) {
  const [reviewsList, setReviewsList] = useState([]);
  const [selectedReviewId, setSelectedReviewId] = useState(initialReviewId || '');
  const [reviewData, setReviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [overrideDecision, setOverrideDecision] = useState('PASS');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  // Load reviews list
  const fetchReviewsList = async () => {
    try {
      const res = await fetch('/api/reviews');
      const data = await res.json();
      if (data.success && data.reviews.length > 0) {
        setReviewsList(data.reviews);
        if (!selectedReviewId) {
          setSelectedReviewId(data.reviews[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Load single review details
  const fetchReviewDetails = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${id}`);
      const data = await res.json();
      if (data.success) {
        setReviewData(data.review);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviewsList();
  }, []);

  useEffect(() => {
    if (initialReviewId) {
      setSelectedReviewId(initialReviewId);
    }
  }, [initialReviewId]);

  useEffect(() => {
    if (selectedReviewId) {
      fetchReviewDetails(selectedReviewId);
    }
  }, [selectedReviewId]);

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReviewId) return;
    setOverrideSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${selectedReviewId}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: overrideDecision,
          notes: overrideNotes || `Manual coordinator review override applied.`
        })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error);
        return;
      }
      setIsOverrideModalOpen(false);
      setOverrideNotes('');
      fetchReviewDetails(selectedReviewId);
      fetchReviewsList();
      if (onReviewUpdated) onReviewUpdated();
    } catch (err) {
      alert(err.message);
    } finally {
      setOverrideSubmitting(false);
    }
  };

  return (
    <div>
      {/* Top Review Selector & Overview */}
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="panel-title">🤖 AI Task Evaluator & Mentor Review</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
              Evaluates submitted work against mandatory requirements, generates senior mentor feedback, and records audit findings.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Select Review:</label>
            <select
              className="select"
              style={{ width: '280px' }}
              value={selectedReviewId}
              onChange={(e) => setSelectedReviewId(e.target.value)}
            >
              {reviewsList.map(r => (
                <option key={r.id} value={r.id}>
                  {r.id}: {r.intern_name} — {r.task_id} ({r.overall_decision})
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">Loading AI evaluation findings...</div>
        ) : !reviewData ? (
          <div className="empty-state">No review selected or available</div>
        ) : (
          <div>
            {/* Decision Hero Banner */}
            <div style={{
              background: reviewData.overall_decision === 'PASS'
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.1))'
                : reviewData.overall_decision === 'NEEDS_CHANGES'
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.1))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(185, 28, 28, 0.1))',
              border: `1px solid ${
                reviewData.overall_decision === 'PASS' ? '#10b981' :
                reviewData.overall_decision === 'NEEDS_CHANGES' ? '#f59e0b' :
                '#ef4444'
              }`,
              borderRadius: 'var(--radius-lg)',
              padding: '22px',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span className={`badge ${
                    reviewData.overall_decision === 'PASS' ? 'badge-success' :
                    reviewData.overall_decision === 'NEEDS_CHANGES' ? 'badge-warning' :
                    'badge-danger'
                  }`} style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
                    DECISION: {reviewData.overall_decision}
                  </span>
                  <span className="badge badge-neutral">Mode: {reviewData.evaluator_mode}</span>
                  {reviewData.coordinator_override ? (
                    <span className="badge badge-info">✔ Coordinator Overridden</span>
                  ) : null}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                  {reviewData.intern_name} ({reviewData.intern_email})
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
                  Task: <strong>{reviewData.task_id}</strong> — {reviewData.task_title} | Evaluated on {reviewData.reviewed_at}
                </p>
              </div>

              {/* Coordinator Override Button */}
              <div>
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsOverrideModalOpen(true)}
                  style={{ fontWeight: 700 }}
                >
                  ⚖️ Coordinator Override
                </button>
              </div>
            </div>

            {/* Senior Developer Mentor Feedback Card (Conversational Tone) */}
            <div className="mentor-feedback-card">
              <div className="mentor-header">
                <div className="mentor-avatar">👨‍💻</div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                    Senior Developer Mentor Feedback
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Personalized, encouraging engineering guidance dispatched to the intern
                  </div>
                </div>
              </div>
              <div className="mentor-text">
                {reviewData.mentor_feedback}
              </div>
            </div>

            {/* Requirement-by-Requirement Technical Findings */}
            <div style={{ marginTop: '28px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '14px', color: '#f8fafc' }}>
                📋 Requirement-by-Requirement Evidence Breakdown
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {reviewData.requirement_findings?.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(17, 24, 39, 0.8)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px 20px',
                      borderLeft: `4px solid ${
                        item.status === 'MET' ? '#10b981' :
                        item.status === 'PARTIALLY_MET' ? '#f59e0b' :
                        '#ef4444'
                      }`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9' }}>
                        {idx + 1}. {item.requirement}
                      </div>
                      <span className={`badge ${
                        item.status === 'MET' ? 'badge-success' :
                        item.status === 'PARTIALLY_MET' ? 'badge-warning' :
                        'badge-danger'
                      }`}>
                        {item.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                      <div><strong style={{ color: '#94a3b8' }}>Evidence Observed:</strong> {item.evidence}</div>
                      {item.missing_functionality && item.missing_functionality !== 'None' && (
                        <div style={{ marginTop: '4px' }}>
                          <strong style={{ color: '#f87171' }}>Missing Functionality:</strong> {item.missing_functionality}
                        </div>
                      )}
                      {item.recommended_improvement && (
                        <div style={{ marginTop: '4px' }}>
                          <strong style={{ color: '#60a5fa' }}>Actionable Guidance:</strong> {item.recommended_improvement}
                        </div>
                      )}
                      {item.suggested_tests && (
                        <div style={{ marginTop: '4px' }}>
                          <strong style={{ color: '#34d399' }}>Suggested Verification:</strong> <code>{item.suggested_tests}</code>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Company Internal Audit Report */}
            <div style={{ marginTop: '28px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '10px', color: '#94a3b8' }}>
                🏢 Company Internal Coordinator Audit Report
              </h3>
              <div className="code-box">
                {reviewData.internal_report}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Coordinator Override Modal */}
      {isOverrideModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="panel-title">⚖️ Coordinator Manual Override</h3>
              <button className="modal-close" onClick={() => setIsOverrideModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleOverrideSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Override Decision To:
                </label>
                <select
                  className="select"
                  value={overrideDecision}
                  onChange={(e) => setOverrideDecision(e.target.value)}
                >
                  <option value="PASS">PASS (Mark current task Passed & advance to next task)</option>
                  <option value="NEEDS_CHANGES">NEEDS_CHANGES (Keep current task assigned & request revisions)</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Coordinator Audit Reason / Notes:
                </label>
                <textarea
                  required
                  className="textarea"
                  style={{ minHeight: '90px' }}
                  placeholder="Explain reason for coordinator override (e.g. Verified Git repo externally during review call)..."
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsOverrideModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={overrideSubmitting}>
                  {overrideSubmitting ? 'Applying Override...' : 'Confirm Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
