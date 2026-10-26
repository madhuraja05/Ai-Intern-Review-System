import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import MetricsCards from './components/MetricsCards.jsx';
import DashboardView from './components/DashboardView.jsx';
import InternsView from './components/InternsView.jsx';
import TaskLibraryView from './components/TaskLibraryView.jsx';
import TaskAssignmentsView from './components/TaskAssignmentsView.jsx';
import SubmissionsView from './components/SubmissionsView.jsx';
import AiReviewView from './components/AiReviewView.jsx';
import ReviewHistoryView from './components/ReviewHistoryView.jsx';
import ReviewSchedulingView from './components/ReviewSchedulingView.jsx';
import EmailLogsView from './components/EmailLogsView.jsx';
import SettingsView from './components/SettingsView.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [interns, setInterns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [coordinatorNotifs, setCoordinatorNotifs] = useState([]);
  const [emailStatus, setEmailStatus] = useState(null);
  const [inspectedReviewId, setInspectedReviewId] = useState('');

  // Fetch all core system data
  const fetchDashboardStats = async () => {
    try {
      const res = await fetch('/api/stats/dashboard');
      const data = await res.json();
      if (data.success) {
        setDashboardData(data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    }
  };

  const fetchInterns = async () => {
    try {
      const res = await fetch('/api/interns');
      const data = await res.json();
      if (data.success) {
        setInterns(data.interns);
      }
    } catch (err) {
      console.error('Failed to fetch interns:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  };

  const fetchCoordinatorNotifs = async () => {
    try {
      const res = await fetch('/api/stats/coordinator-notifications');
      const data = await res.json();
      if (data.success) {
        setCoordinatorNotifs(data.notifications);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  const fetchEmailStatus = async () => {
    try {
      const res = await fetch('/api/email/status');
      const data = await res.json();
      if (data.success) {
        setEmailStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch email status:', err);
    }
  };

  const refreshAllData = () => {
    fetchDashboardStats();
    fetchInterns();
    fetchTasks();
    fetchCoordinatorNotifs();
    fetchEmailStatus();
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  const handleResolveNotif = async (notifId) => {
    try {
      await fetch(`/api/stats/coordinator-notifications/${notifId}/resolve`, { method: 'POST' });
      fetchCoordinatorNotifs();
      fetchDashboardStats();
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewReview = (reviewId) => {
    setInspectedReviewId(reviewId);
    setActiveTab('aiReview');
  };

  const unresolvedCount = (coordinatorNotifs || []).filter(n => !n.is_resolved).length;

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemInfo={dashboardData?.system}
        unresolvedCount={unresolvedCount}
      />

      {/* Navigation Tabs Bar */}
      <nav className="nav-tabs">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`tab-btn ${activeTab === 'interns' ? 'active' : ''}`}
          onClick={() => setActiveTab('interns')}
        >
          👥 Interns ({interns.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          📚 Task Library ({tasks.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => setActiveTab('assignments')}
        >
          🎯 Assignments
        </button>
        <button
          className={`tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('submissions')}
        >
          📝 Submissions
        </button>
        <button
          className={`tab-btn ${activeTab === 'aiReview' ? 'active' : ''}`}
          onClick={() => setActiveTab('aiReview')}
        >
          🤖 AI Review Runner
        </button>
        <button
          className={`tab-btn ${activeTab === 'reviewHistory' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviewHistory')}
        >
          📜 Review History
        </button>
        <button
          className={`tab-btn ${activeTab === 'scheduling' ? 'active' : ''}`}
          onClick={() => setActiveTab('scheduling')}
        >
          📅 Scheduling & Meet
        </button>
        <button
          className={`tab-btn ${activeTab === 'emailLogs' ? 'active' : ''}`}
          onClick={() => setActiveTab('emailLogs')}
        >
          ✉️ Email Outbox
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Global Key Metrics Overview */}
        <MetricsCards metrics={dashboardData?.metrics} />

        {/* Dynamic Page Views */}
        {activeTab === 'dashboard' && (
          <DashboardView
            dashboardData={dashboardData}
            coordinatorNotifs={coordinatorNotifs}
            onResolveNotif={handleResolveNotif}
            setActiveTab={setActiveTab}
            onSelectSubmissionForReview={handleViewReview}
          />
        )}

        {activeTab === 'interns' && (
          <InternsView
            interns={interns}
            onRefreshInterns={refreshAllData}
          />
        )}

        {activeTab === 'tasks' && (
          <TaskLibraryView
            tasks={tasks}
            onRefreshTasks={refreshAllData}
          />
        )}

        {activeTab === 'assignments' && (
          <TaskAssignmentsView
            interns={interns}
            tasks={tasks}
            onRefresh={refreshAllData}
          />
        )}

        {activeTab === 'submissions' && (
          <SubmissionsView
            interns={interns}
            tasks={tasks}
            onSubmissionComplete={refreshAllData}
            onViewReview={handleViewReview}
          />
        )}

        {activeTab === 'aiReview' && (
          <AiReviewView
            initialReviewId={inspectedReviewId}
            onReviewUpdated={refreshAllData}
          />
        )}

        {activeTab === 'reviewHistory' && (
          <ReviewHistoryView
            onViewReview={handleViewReview}
          />
        )}

        {activeTab === 'scheduling' && (
          <ReviewSchedulingView
            interns={interns}
            tasks={tasks}
            onRefresh={refreshAllData}
          />
        )}

        {activeTab === 'emailLogs' && (
          <EmailLogsView
            emailStatus={emailStatus}
            onRefreshStatus={fetchEmailStatus}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            onSettingsSaved={refreshAllData}
          />
        )}
      </main>
    </div>
  );
}
