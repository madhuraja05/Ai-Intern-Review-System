# ⚡ AI Intern Task Allocation & Review Automation System

An interview-ready, full-stack enterprise automation system for managing internship cohorts, company task libraries, AI-powered submission evaluation, natural senior developer mentor feedback, persistent review scheduling, and 10-day lifecycle enforcement.

---

## 🌟 Key Features

1. **Intern Management (Up to 100 Interns)**
   - Create, edit, view, search, and filter interns.
   - Compound key assignment tracking: Identified by `intern_email` + `task_id`.
   - CSV / Excel-compatible bulk import with live validation, email syntax checking, and duplicate detection.

2. **Official Company Task Library**
   - Sequenced tasks (`TASK-101` through `TASK-105`) with modules, deliverables, and acceptance criteria.
   - Evaluator evaluates submissions strictly against company requirements saved in SQLite.

3. **Automated Review Cycle & Progression**
   - **PASS**: Marks current task passed, records review, finds next sequential task, assigns it, updates current task ID, and dispatches assignment notifications.
   - **NEEDS_CHANGES**: Keeps same task assigned, increments revision attempt counter, delivers actionable remediation guidance, and prevents progression.
   - **HUMAN_REVIEW_REQUIRED**: Escalates to coordinator action queue when evidence is insufficient or external private links require manual inspection.
   - **Coordinator Override**: Coordinator can approve or request changes with recorded audit rationale.

4. **10-Day Lifecycle & End-Date Enforcement**
   - Enforces calendar end date.
   - Prevents new allocations and future review scheduling once end date has passed.
   - Incomplete tasks automatically transition to `PENDING_AT_INTERNSHIP_END`.
   - Dispatches coordinator escalation alerts.

5. **Human-like Senior Developer AI Mentor**
   - Conversational, friendly, encouraging senior developer tone (ChatGPT style).
   - Explains what was done well, which requirements are missing, why they matter in production, and how to test fixes.
   - Dual output: Intern-facing mentor guidance + Internal company audit report.
   - Configurable AI: Google Gemini, OpenAI GPT-4o-mini, Anthropic, or Deterministic Demo Evaluator.

6. **Email Automation & Safe Test Mode**
   - Real Gmail SMTP delivery using Google App Passwords.
   - Safe Test Mode: When credentials are not configured, emails are recorded to SQLite `email_logs`.
   - Admin CC and separate dedicated Admin AI Review Reports.
   - Idempotency keys prevent duplicate notifications.

7. **Review Scheduling & Calendar**
   - Persistent scheduling in SQLite.
   - Google Meet links & manual meeting URLs.
   - Downloadable standard `.ics` iCalendar export files.
   - Background reminder worker checking upcoming reviews.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Tailored Glassmorphic CSS Design System.
- **Backend**: Node.js, Express.
- **Database**: SQLite (via `sql.js` WebAssembly engine with persistent file storage `server/data/intern_system.db`).
- **AI Service**: Configurable Gemini / OpenAI / Anthropic / Deterministic Demo.
- **Email**: Nodemailer with Gmail SMTP & SQLite audit logger.
- **Testing**: Node.js built-in test runner (`node --test`).

---

## 🚀 Quick Start Instructions

### Prerequisites
- Node.js v18+ installed on your system.

### Option 1: Convenience Launcher (Windows)
Double-click `start.bat` in the project root.

### Option 2: Running from Terminal

**1. Start the Backend Server:**
```powershell
cd "d:/intern reivew system/server"
npm start
# Listening on http://localhost:5000
```

**2. Start the Frontend Dev Server:**
```powershell
cd "d:/intern reivew system/client"
npm run dev
# Ready on http://localhost:3000
```

**3. Open in Browser:**
Navigate to **`http://localhost:3000`** (or `http://localhost:5000` for single-port unified serving).

---

## 🧪 Running Automated Tests

Execute the 11-step comprehensive verification test suite:
```powershell
cd "d:/intern reivew system/server"
npm test
```

### Verified Test Cases:
1. `Intern creation and duplicate email validation`
2. `Initial task allocation upon intern registration`
3. `PASS marks current task Passed and allocates next task exactly once`
4. `NEEDS_CHANGES keeps same task assigned and records revision attempt`
5. `HUMAN_REVIEW_REQUIRED blocks advancement until coordinator acts`
6. `End-date enforcement prevents new allocations and future reviews`
7. `Incomplete tasks remain pending at internship end`
8. `Insufficient evidence cannot automatically pass a task`
9. `Email provider actions are recorded in SQLite audit logs`
10. `Duplicate email requests do not send duplicate notifications (idempotency)`
11. `Database state persists to disk file`

---

## ✉️ Real Gmail SMTP Configuration Guide

The application runs in **Safe Test Email Mode** by default. To connect real Gmail delivery:

1. Copy `.env.example` to `server/.env`:
   ```powershell
   copy .env.example server/.env
   ```
2. Open `server/.env` and set:
   ```env
   EMAIL_USER=your_email@gmail.com
   EMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   ADMIN_EMAIL=coordinator@company.com
   ```
3. **How to get a Google App Password:**
   - Go to [Google Account Security](https://myaccount.google.com/security).
   - Ensure **2-Step Verification** is turned ON.
   - Go to [App Passwords](https://myaccount.google.com/apppasswords).
   - Select App Name: `Intern Automation System`.
   - Copy the generated 16-character password into `EMAIL_APP_PASSWORD` (remove any spaces).
4. Restart the backend server.
5. In the UI, go to **✉️ Email Outbox** and click **🚀 Send Verification Test Email** to verify your inbox!

---

## 🎭 Live Interview Demo Scenarios

### Scenario A: Test PASS & Next Task Allocation
1. Go to the **📝 Submissions** tab.
2. Select intern **Priya Sharma** (`priya.sharma@example.com`).
3. Click **🧪 Demo: PASS Submission** button.
4. Click **🚀 Submit Work & Trigger AI Review**.
5. Observe:
   - Evaluator verifies all 4 criteria as `MET`.
   - Decision is `PASS`.
   - Senior developer mentor feedback celebrates the passing work.
   - `TASK-101` is marked `PASSED`.
   - `TASK-102` is automatically assigned to Priya!
   - Next task assignment email is recorded in SQLite logs.

### Scenario B: Test NEEDS_CHANGES & Mentor Feedback
1. Go to **📝 Submissions**.
2. Select intern **Rohan Das**.
3. Click **🧪 Demo: NEEDS_CHANGES**.
4. Click **🚀 Submit Work & Trigger AI Review**.
5. Observe:
   - Missing criteria flagged as `NOT_MET`.
   - Decision is `NEEDS_CHANGES`.
   - Senior mentor explains why the missing parts matter and provides step-by-step remediation suggestions.
   - Same task is retained with attempt counter incremented.

### Scenario C: 10-Day Lifecycle & End-Date Enforcement
1. Open the **👥 Interns** tab.
2. Observe intern **Ananya Iyer** (Internship ended yesterday).
3. Status is `EXPIRED` and incomplete task is marked `PENDING_AT_INTERNSHIP_END`.
4. Check the **Dashboard** banner: A high-priority Coordinator Action alert is raised.
5. Attempting to allocate tasks or schedule reviews past her end date is blocked by business logic.

### Scenario D: Coordinator Manual Override
1. Open the **🤖 AI Review Runner** tab.
2. Select any review flagged as `HUMAN_REVIEW_REQUIRED`.
3. Click **⚖️ Coordinator Override**.
4. Select `PASS` or `NEEDS_CHANGES`, add audit remarks, and click **Confirm Override**.
5. Review is updated with `coordinator_override = 1` and tasks advance accordingly.
