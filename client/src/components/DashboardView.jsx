import React from 'react';

export default function DashboardView({
  dashboardData,
  coordinatorNotifs,
  onResolveNotif,
  setActiveTab,
  onSelectSubmissionForReview
}) {
  const pendingNotifs = (coordinatorNotifs || []).filter(n => !n.is_resolved);

  return (
    <div>
      {/* Quick Interactive Demo Flow Helper Banner */}
      <div style={{
        background: 'rgba(99, 102, 241, 0.12)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <span style={{ fontWeight: 800, color: '#818cf8', fontSize: '0.95rem' }}>🎯 Quick Interview Demo Guide:</span>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: '#cbd5e1' }}>
            1. <strong>PASS Flow</strong>: Go to Submissions → submit full code/evidence → Watch current task pass & next task auto-assigned with email.<br />
            2. <strong>NEEDS_CHANGES Flow</strong>: Submit brief/partial code → Watch mentor give detailed remediation & keep same task assigned.<br />
            3. <strong>Lifecycle & End-Date</strong>: View Ananya Iyer (ended yesterday) → Task marked <em>PENDING_AT_INTERNSHIP_END</em> and coordinator alerted.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('submissions')}>
            Submit Work & Review
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('interns')}>
            Manage Interns
          </button>
        </div>
      </div>

      {/* Coordinator Escalations Action Queue */}
      {pendingNotifs.length > 0 && (
        <div className="panel" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="panel-header">
            <h3 className="panel-title" style={{ color: '#fbbf24' }}>
              ⚠️ Coordinator Action Required ({pendingNotifs.length})
            </h3>
            <span className="badge badge-warning">High Priority</span>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Intern</th>
                  <th>Task ID</th>
                  <th>Reason / Details</th>
                  <th>Timestamp</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingNotifs.map(notif => (
                  <tr key={notif.id}>
                    <td>
                      <span className={`badge ${notif.type === 'HUMAN_REVIEW_REQUIRED' ? 'badge-danger' : 'badge-warning'}`}>
                        {notif.type}
                      </span>
                    </td>
                    <td><strong>{notif.intern_email}</strong></td>
                    <td><code>{notif.task_id}</code></td>
                    <td style={{ fontSize: '0.85rem' }}>{notif.message}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{notif.created_at}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {notif.type === 'HUMAN_REVIEW_REQUIRED' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setActiveTab('aiReview')}
                          >
                            Review & Override
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onResolveNotif(notif.id)}
                        >
                          Resolve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Two-Column Grid: Recent Submissions & Recent Reviews */}
      <div className="grid-2">
        {/* Recent Submissions */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">📝 Recent Submissions</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('submissions')}>
              View All
            </button>
          </div>

          {(!dashboardData?.recentSubmissions || dashboardData.recentSubmissions.length === 0) ? (
            <div className="empty-state">No submissions yet</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Intern</th>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.recentSubmissions.map(sub => (
                    <tr key={sub.id}>
                      <td>
                        <strong>{sub.intern_name}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>{sub.intern_email}</div>
                      </td>
                      <td><code>{sub.task_id}</code></td>
                      <td>
                        <span className={`badge ${sub.status === 'PASS' ? 'badge-success' : sub.status === 'NEEDS_CHANGES' ? 'badge-warning' : 'badge-info'}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{sub.submitted_at?.split(' ')[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Reviews */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">🤖 Recent AI Evaluations</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('reviewHistory')}>
              View All
            </button>
          </div>

          {(!dashboardData?.recentReviews || dashboardData.recentReviews.length === 0) ? (
            <div className="empty-state">No reviews yet</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Intern</th>
                    <th>Task</th>
                    <th>Decision</th>
                    <th>Evaluator</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.recentReviews.map(rev => (
                    <tr key={rev.id}>
                      <td>
                        <strong>{rev.intern_name}</strong>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>{rev.intern_email}</div>
                      </td>
                      <td><code>{rev.task_id}</code></td>
                      <td>
                        <span className={`badge ${rev.overall_decision === 'PASS' ? 'badge-success' : rev.overall_decision === 'NEEDS_CHANGES' ? 'badge-warning' : 'badge-danger'}`}>
                          {rev.overall_decision}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>{rev.evaluator_mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
