import React from 'react';

export default function Navbar({ activeTab, setActiveTab, systemInfo, unresolvedCount }) {
  return (
    <header className="navbar">
      <div className="nav-brand" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
        <div className="brand-icon">⚡</div>
        <div className="brand-title">
          <span>InternOps AI</span>
          <span>Task Allocation & Review Automation</span>
        </div>
      </div>

      <div className="nav-badges">
        {/* AI Provider Badge */}
        <span
          className={`badge ${systemInfo?.isAiDemo ? 'badge-warning' : 'badge-success'}`}
          title={systemInfo?.isAiDemo ? 'Deterministic evaluation fallback (Configure GEMINI_API_KEY or OPENAI_API_KEY in .env for live LLM)' : 'Live LLM Provider Active'}
        >
          🤖 AI: {systemInfo?.aiProvider || 'DEMO_DETERMINISTIC'}
        </span>

        {/* Email Mode Badge */}
        <span
          className={`badge ${systemInfo?.realEmailConfigured ? 'badge-success' : 'badge-neutral'}`}
          title={systemInfo?.realEmailConfigured ? 'Gmail SMTP connected' : 'Safe test mode (no credentials in .env, saving to SQLite logs)'}
        >
          ✉️ {systemInfo?.realEmailConfigured ? 'Gmail SMTP Active' : 'Safe Test Email Mode'}
        </span>

        {/* Coordinator Escalations Bell */}
        {unresolvedCount > 0 && (
          <button
            className="btn btn-warning btn-sm"
            onClick={() => setActiveTab('dashboard')}
            title="Coordinator Action Required"
            style={{ fontWeight: 700 }}
          >
            ⚠️ {unresolvedCount} Action{unresolvedCount > 1 ? 's' : ''} Needed
          </button>
        )}
      </div>
    </header>
  );
}
