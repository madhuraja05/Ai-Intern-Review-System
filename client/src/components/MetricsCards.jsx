import React from 'react';

export default function MetricsCards({ metrics }) {
  if (!metrics) return null;

  return (
    <div className="metrics-grid">
      <div className="metric-card indigo">
        <div className="metric-label">Total Interns</div>
        <div className="metric-value">{metrics.totalInterns}</div>
      </div>

      <div className="metric-card emerald">
        <div className="metric-label">Active Interns</div>
        <div className="metric-value">{metrics.activeInterns}</div>
      </div>

      <div className="metric-card sky">
        <div className="metric-label">Tasks Assigned</div>
        <div className="metric-value">{metrics.tasksAssigned}</div>
      </div>

      <div className="metric-card emerald">
        <div className="metric-label">Tasks Passed</div>
        <div className="metric-value">{metrics.tasksPassed}</div>
      </div>

      <div className="metric-card amber">
        <div className="metric-label">Reviews Pending</div>
        <div className="metric-value">{metrics.reviewsPending}</div>
      </div>

      <div className="metric-card rose">
        <div className="metric-label">Needs Changes</div>
        <div className="metric-value">{metrics.tasksNeedingChanges}</div>
      </div>

      <div className="metric-card amber">
        <div className="metric-label">End-Date Alerts</div>
        <div className="metric-value">{metrics.internshipEndEscalations}</div>
      </div>
    </div>
  );
}
