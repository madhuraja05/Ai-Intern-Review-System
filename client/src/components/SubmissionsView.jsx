import React, { useState, useEffect } from 'react';

export default function SubmissionsView({ interns, tasks, onSubmissionComplete, onViewReview }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });

  // Submission form state
  const [form, setForm] = useState({
    internEmail: interns[0]?.email || '',
    taskId: 'TASK-101',
    text_content: '',
    repo_url: '',
    evidence_notes: ''
  });

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/submissions');
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.submissions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  // Update task ID default when intern selected
  const handleInternChange = (email) => {
    const selected = interns.find(i => i.email === email);
    setForm({
      ...form,
      internEmail: email,
      taskId: selected?.current_task_id || 'TASK-101'
    });
  };

  // Quick Demo Autofills
  const fillPassDemo = () => {
    setForm({
      ...form,
      taskId: 'TASK-101',
      text_content: `// Project Setup & Git Workflow Implementation
// 1. Initialized repository with atomic Conventional Commits
// 2. Configured ESLint & Prettier with zero lint warnings
// 3. Documented setup commands in README.md

const express = require('express');
const app = express();
app.use(express.json());

// Conventional Commits History:
// commit 1: feat: initialize core directory structure and package.json
// commit 2: chore: configure eslint and prettier rules with pre-commit hook
// commit 3: docs: write comprehensive installation and run guide in README.md`,
      repo_url: 'https://github.com/company-interns/task-101-setup',
      evidence_notes: `Executed 'npm run lint' -> 0 errors, 0 warnings.
Verified .gitignore excludes node_modules and .env.
Git log verified with 3 atomic Conventional Commits.`
    });
  };

  const fillNeedsChangesDemo = () => {
    setForm({
      ...form,
      taskId: 'TASK-101',
      text_content: `// Just started basic git init.
console.log("Hello world");`,
      repo_url: '',
      evidence_notes: `Haven't set up eslint or prettier yet, will do it in next commit.`
    });
  };

  const fillHumanReviewDemo = () => {
    setForm({
      ...form,
      taskId: 'TASK-101',
      text_content: `Code is hosted on my private enterprise GitLab repository.`,
      repo_url: 'https://gitlab.internal-corp.local/private/repo-review',
      evidence_notes: `External enterprise network required for inspection.`
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatusMessage({ text: '', type: '' });

    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!data.success) {
        setStatusMessage({ text: data.error, type: 'error' });
        return;
      }

      setStatusMessage({
        text: `✔ Submission accepted! AI evaluated with decision: ${data.review?.decision || 'PROCESSED'}.`,
        type: 'success'
      });

      // Clear text
      setForm({ ...form, text_content: '', evidence_notes: '', repo_url: '' });
      fetchSubmissions();
      if (onSubmissionComplete) onSubmissionComplete(data);
      if (onViewReview && data.review?.reviewId) {
        onViewReview(data.review.reviewId);
      }
    } catch (err) {
      setStatusMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Intern Submission Portal Form */}
      <div className="panel" style={{ borderTop: '4px solid var(--primary)' }}>
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 className="panel-title">📝 Intern Task Submission Portal</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
              Submissions are validated against the intern's active assignment and evaluated by the AI Mentor service.
            </p>
          </div>
          {/* Quick Demo Fill Buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={fillPassDemo}>
              🧪 Demo: PASS Submission
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={fillNeedsChangesDemo}>
              🧪 Demo: NEEDS_CHANGES
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={fillHumanReviewDemo}>
              🧪 Demo: HUMAN_REVIEW
            </button>
          </div>
        </div>

        {statusMessage.text && (
          <div style={{
            background: statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            border: `1px solid ${statusMessage.type === 'error' ? '#ef4444' : '#10b981'}`,
            color: statusMessage.type === 'error' ? '#f87171' : '#34d399',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '0.88rem'
          }}>
            {statusMessage.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                Intern Account (Email)
              </label>
              <select
                required
                className="select"
                value={form.internEmail}
                onChange={(e) => handleInternChange(e.target.value)}
              >
                <option value="">-- Select Intern --</option>
                {interns.map(i => (
                  <option key={i.id} value={i.email}>
                    {i.name} ({i.email}) — Current: {i.current_task_id || 'None'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                Target Task ID
              </label>
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
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Project / Repository URL (Optional)
            </label>
            <input
              type="url"
              className="input"
              placeholder="https://github.com/username/project-repo"
              value={form.repo_url}
              onChange={(e) => setForm({ ...form, repo_url: e.target.value })}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Code Implementation & Explanation of Completed Work
            </label>
            <textarea
              required
              className="textarea"
              style={{ minHeight: '120px' }}
              placeholder="Paste code excerpts, explanation of design patterns, and how you met the requirements..."
              value={form.text_content}
              onChange={(e) => setForm({ ...form, text_content: e.target.value })}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Testing Evidence & Terminal Execution Logs
            </label>
            <textarea
              className="textarea"
              style={{ minHeight: '80px' }}
              placeholder="Paste terminal test output, curl verification logs, or lint results..."
              value={form.evidence_notes}
              onChange={(e) => setForm({ ...form, evidence_notes: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ padding: '10px 24px', fontSize: '0.95rem' }}
            >
              {submitting ? 'Running AI Evaluation...' : '🚀 Submit Work & Trigger AI Review'}
            </button>
          </div>
        </form>
      </div>

      {/* Submissions Registry */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">📋 Submissions Registry ({submissions.length})</h3>
          <button className="btn btn-secondary btn-sm" onClick={fetchSubmissions}>
            Refresh
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Submission ID</th>
                <th>Intern Name</th>
                <th>Task ID</th>
                <th>Status</th>
                <th>Evaluator</th>
                <th>Submitted Timestamp</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" className="empty-state">Loading submissions...</td></tr>
              ) : submissions.length === 0 ? (
                <tr><td colSpan="7" className="empty-state">No submissions recorded yet</td></tr>
              ) : (
                submissions.map(sub => (
                  <tr key={sub.id}>
                    <td><code>{sub.id}</code></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{sub.intern_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>{sub.intern_email}</div>
                    </td>
                    <td><code>{sub.task_id}</code></td>
                    <td>
                      <span className={`badge ${
                        sub.status === 'PASS' ? 'badge-success' :
                        sub.status === 'NEEDS_CHANGES' ? 'badge-warning' :
                        sub.status === 'HUMAN_REVIEW_REQUIRED' ? 'badge-danger' :
                        'badge-info'
                      }`}>
                        {sub.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>{sub.evaluator_mode || 'Auto'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{sub.submitted_at}</td>
                    <td>
                      {sub.review_id && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => onViewReview(sub.review_id)}
                        >
                          View Review
                        </button>
                      )}
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
