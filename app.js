const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────

app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-sqa-lab-2026',
  resave: false,
  saveUninitialized: false
}));

// ── Database ────────────────────────────────────────────────────────────

const DB_PATH = process.env.DB_PATH || (process.env.VERCEL ? '/tmp/students.db' : path.join(__dirname, 'students.db'));
const db = new Database(DB_PATH);

// Trust proxy for Vercel / Render behind load balancers
app.set('trust proxy', 1);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT '',
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    student_id TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL
  );
`);

// Migrate existing users table to add name column if missing
const cols = db.prepare("PRAGMA table_info('users')").all();
if (!cols.find(c => c.name === 'name')) {
  db.exec("ALTER TABLE users ADD COLUMN name TEXT DEFAULT ''");
}

// ── Helper ──────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    req.session.messages = ['Please log in first.'];
    return res.redirect('/login');
  }
  next();
}

function getFlash(req) {
  const msgs = req.session.messages || [];
  delete req.session.messages;
  return msgs;
}

function flash(req, msg, type = 'danger') {
  if (!req.session.messages) req.session.messages = [];
  req.session.messages.push({ text: msg, type });
}

function render(res, html, req) {
  const msgs = getFlash(req);
  const result = html.replace('<!--FLASH-->', renderFlash(msgs));
  res.send(result);
}

function renderFlash(msgs) {
  return msgs.map((m, i) =>
    `<div class="flash-${m.type}" id="flash-${i + 1}">${m.text}</div>`
  ).join('');
}

// ── Templates ──────────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #F8FAFC;
  color: #0F172A;
  min-height: 100vh;
}

.card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
  width: 380px;
  border-left: 4px solid #3B82F6;
}

.card-wide { width: 440px; }

h2 {
  text-align: center;
  margin-bottom: 28px;
  color: #0F172A;
  font-weight: 700;
  font-size: 22px;
  letter-spacing: -0.3px;
}

label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  font-size: 13px;
  color: #475569;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

input {
  width: 100%;
  padding: 11px 14px;
  margin-bottom: 18px;
  border: 1.5px solid #E2E8F0;
  border-radius: 8px;
  font-size: 15px;
  font-family: 'Inter', sans-serif;
  color: #0F172A;
  background: #F8FAFC;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  outline: none;
}

input:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  background: white;
}

button { cursor: pointer; font-family: 'Inter', sans-serif; }

.link {
  text-align: center;
  margin-top: 20px;
  font-size: 14px;
  color: #64748B;
}

.link a {
  color: #3B82F6;
  text-decoration: none;
  font-weight: 600;
}

.link a:hover {
  text-decoration: underline;
}

.flash-danger {
  background: #FEF2F2;
  color: #991B1B;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 18px;
  text-align: center;
  font-size: 14px;
  border: 1px solid #FECACA;
  font-weight: 500;
}

.flash-success {
  background: #F0FDF4;
  color: #166534;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 18px;
  text-align: center;
  font-size: 14px;
  border: 1px solid #BBF7D0;
  font-weight: 500;
}

.navbar {
  background: #1E293B;
  color: white;
  padding: 0 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 64px;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}

.navbar h1 {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: #F8FAFC;
}

.navbar a {
  color: white;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
  background: #EF4444;
  padding: 8px 18px;
  border-radius: 6px;
  transition: background 0.2s;
}

.navbar a:hover {
  background: #DC2626;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-link {
  background: transparent !important;
  color: #CBD5E1 !important;
  padding: 6px 14px !important;
  border: 1px solid #475569 !important;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500 !important;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.nav-link:hover {
  background: #334155 !important;
  color: #F8FAFC !important;
  border-color: #64748B !important;
}

.profile-section {
  background: white;
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
  border: 1px solid #E2E8F0;
  max-width: 520px;
  margin: 0 auto;
}

.profile-section h3 {
  margin-bottom: 24px;
  color: #0F172A;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.2px;
}

.profile-field {
  margin-bottom: 20px;
}

.profile-field label {
  font-size: 12px;
  font-weight: 600;
  color: #64748B;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  margin-bottom: 5px;
}

.profile-field .value {
  font-size: 16px;
  color: #0F172A;
  font-weight: 500;
  padding: 10px 14px;
  background: #F8FAFC;
  border: 1.5px solid #E2E8F0;
  border-radius: 8px;
}

hr.section-divider {
  border: none;
  border-top: 1px solid #E2E8F0;
  margin: 28px 0;
}

.input-readonly {
  background: #F1F5F9 !important;
  color: #64748B !important;
  cursor: not-allowed;
}

.container {
  max-width: 1050px;
  margin: 32px auto;
  padding: 0 20px;
}

.add-section {
  background: white;
  padding: 28px 32px;
  border-radius: 12px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
  margin-bottom: 28px;
  border: 1px solid #E2E8F0;
}

.add-section h3 {
  margin-bottom: 20px;
  color: #0F172A;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.2px;
}

.form-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  align-items: flex-end;
}

.form-row label {
  font-size: 12px;
  font-weight: 600;
  color: #64748B;
  display: block;
  margin-bottom: 5px;
  letter-spacing: 0.4px;
}

.form-row input {
  padding: 10px 14px;
  border: 1.5px solid #E2E8F0;
  border-radius: 8px;
  font-size: 14px;
  width: 200px;
  margin-bottom: 0;
  font-family: 'Inter', sans-serif;
  background: #F8FAFC;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-row input:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  background: white;
}

.form-row button {
  padding: 10px 24px;
  background: #3B82F6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.2s, transform 0.1s;
}

.form-row button:hover {
  background: #2563EB;
}

.form-row button:active {
  transform: scale(0.98);
}

.form-group { display: flex; flex-direction: column; }

.table-wrapper {
  overflow-y: auto;
  max-height: 480px;
  border-radius: 12px;
  border: 1px solid #E2E8F0;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
}

table {
  width: 100%;
  background: white;
  border-collapse: collapse;
}

th, td {
  padding: 14px 18px;
  text-align: left;
  border-bottom: 1px solid #F1F5F9;
}

th {
  background: #F1F5F9;
  color: #475569;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  position: sticky;
  top: 0;
  z-index: 10;
}

tr:last-child td {
  border-bottom: none;
}

tbody tr:nth-child(even) {
  background: #F8FAFC;
}

tbody tr:hover {
  background: #EFF6FF;
}

td:nth-child(2) {
  font-family: 'DM Mono', monospace;
  font-size: 13px;
  letter-spacing: 0.2px;
  color: #1E293B;
}

.action-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  font-weight: 500;
  transition: background 0.2s;
}

.edit-btn {
  background: #EFF6FF;
  color: #2563EB;
  margin-right: 8px;
  border: 1px solid #BFDBFE;
}

.edit-btn:hover {
  background: #DBEAFE;
}

.delete-btn {
  background: #FEF2F2;
  color: #DC2626;
  border: 1px solid #FECACA;
}

.delete-btn:hover {
  background: #FEE2E2;
}

.empty-msg {
  text-align: center;
  padding: 48px 32px;
  color: #94A3B8;
  font-style: italic;
  font-size: 15px;
}

.btn-row {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.btn-row button, .btn-row a {
  flex: 1;
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  border: none;
  transition: background 0.2s;
}

.save-btn {
  background: #3B82F6;
  color: white;
}

.save-btn:hover {
  background: #2563EB;
}

.cancel-btn {
  background: #F1F5F9;
  color: #475569;
  display: inline-block;
  line-height: 1;
  padding: 12px 0;
}

.cancel-btn:hover {
  background: #E2E8F0;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: #3B82F6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  transition: background 0.2s, transform 0.1s;
}

.btn-primary:hover {
  background: #2563EB;
}

.btn-primary:active {
  transform: scale(0.98);
}
`;

const LOGIN_PAGE = `<!DOCTYPE html>
<html>
<head><title>Login - Student Management</title><style>${CSS}</style></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;">
<div class="card">
  <h2 id="login-title">Login</h2>
  <!--FLASH-->
  <form method="POST" action="/login">
    <label for="login-email">Email</label>
    <input type="email" id="login-email" name="email" placeholder="you@example.com" required>
    <label for="login-password">Password</label>
    <input type="password" id="login-password" name="password" placeholder="Enter password" required>
    <button type="submit" id="login-btn" class="btn-primary">Sign In</button>
  </form>
  <div class="link">Don't have an account? <a href="/register" id="register-link">Register</a></div>
</div>
</body>
</html>`;

const REGISTER_PAGE = `<!DOCTYPE html>
<html>
<head><title>Register - Student Management</title><style>${CSS}</style></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;">
<div class="card">
  <h2 id="register-title">Register</h2>
  <!--FLASH-->
  <form method="POST" action="/register">
    <label for="reg-name">Name</label>
    <input type="text" id="reg-name" name="name" placeholder="Your full name" required>
    <label for="reg-email">Email</label>
    <input type="email" id="reg-email" name="email" placeholder="you@example.com" required>
    <label for="reg-password">Password</label>
    <input type="password" id="reg-password" name="password" placeholder="Min 6 characters" required>
    <label for="reg-confirm">Confirm Password</label>
    <input type="password" id="reg-confirm" name="confirm" placeholder="Re-enter password" required>
    <button type="submit" id="reg-btn" class="btn-primary">Create Account</button>
  </form>
  <div class="link">Already have an account? <a href="/login" id="login-link">Login</a></div>
</div>
</body>
</html>`;

function dashboardPage(req) {
  const students = db.prepare('SELECT * FROM students ORDER BY id ASC').all();
  const msgs = getFlash(req);
  const flashHtml = msgs.map((m, i) =>
    `<div class="flash-${m.type}" id="flash-${i + 1}">${m.text}</div>`
  ).join('');

  let rows = '';
  if (students.length === 0) {
    rows = `<tr><td colspan="4" class="empty-msg" id="empty-msg">No students found. Add one above!</td></tr>`;
  } else {
    for (const s of students) {
      rows += `<tr id="student-row-${s.id}">
        <td id="student-name-${s.id}">${s.name}</td>
        <td id="student-sid-${s.id}">${s.student_id}</td>
        <td id="student-dept-${s.id}">${s.department}</td>
        <td>
          <a href="/edit/${s.id}" class="action-btn edit-btn" id="edit-btn-${s.id}">Edit</a>
          <form method="POST" action="/delete/${s.id}" style="display:inline;">
            <button type="submit" class="action-btn delete-btn" id="delete-btn-${s.id}" onclick="return confirm('Delete ${s.name}?')">Delete</button>
          </form>
        </td>
      </tr>`;
    }
  }

  return `<!DOCTYPE html>
<html>
<head><title>Dashboard - Student Management</title><style>${CSS}</style></head>
<body>
<div class="navbar">
  <h1 id="dashboard-title">Student Management Dashboard</h1>
  <div class="nav-links">
    <a href="/profile" class="nav-link" id="profile-link">Profile</a>
    <a href="/logout" id="logout-btn">Logout</a>
  </div>
</div>
<div class="container">
  ${flashHtml}
  <div class="add-section">
    <h3 id="add-student-heading">Add New Student</h3>
    <form method="POST" action="/add_student" class="form-row">
      <div class="form-group">
        <label for="add-name">Name</label>
        <input type="text" id="add-name" name="name" placeholder="Full name" required>
      </div>
      <div class="form-group">
        <label for="add-student-id">Student ID</label>
        <input type="text" id="add-student-id" name="student_id" placeholder="e.g. S12345" required>
      </div>
      <div class="form-group">
        <label for="add-department">Department</label>
        <input type="text" id="add-department" name="department" placeholder="e.g. Computer Science" required>
      </div>
      <button type="submit" id="add-student-btn">Add Student</button>
    </form>
  </div>
  <div class="table-wrapper">
  <table id="student-table">
    <thead>
      <tr>
        <th id="col-name">Name</th>
        <th id="col-student-id">Student ID</th>
        <th id="col-department">Department</th>
        <th id="col-actions">Actions</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  </div>
</div>
</body>
</html>`;
}

function editPage(student, req) {
  const msgs = getFlash(req);
  const flashHtml = msgs.map((m, i) =>
    `<div class="flash-${m.type}" id="flash-${i + 1}">${m.text}</div>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head><title>Edit Student - Student Management</title><style>${CSS}</style></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;">
<div class="card card-wide">
  <h2 id="edit-title">Edit Student</h2>
  ${flashHtml}
  <form method="POST" action="/edit/${student.id}">
    <label for="edit-name-${student.id}">Name</label>
    <input type="text" id="edit-name-${student.id}" name="name" value="${student.name}" required>
    <label for="edit-student-id-${student.id}">Student ID</label>
    <input type="text" id="edit-student-id-${student.id}" name="student_id" value="${student.student_id}" required>
    <label for="edit-department-${student.id}">Department</label>
    <input type="text" id="edit-department-${student.id}" name="department" value="${student.department}" required>
    <div class="btn-row">
      <button type="submit" class="save-btn" id="edit-save-btn-${student.id}">Save Changes</button>
      <a href="/dashboard" class="cancel-btn" id="edit-cancel-btn">Cancel</a>
    </div>
  </form>
</div>
</body>
</html>`;
}

function profilePage(user, req) {
  const msgs = getFlash(req);
  const flashHtml = msgs.map((m, i) =>
    `<div class="flash-${m.type}" id="flash-${i + 1}">${m.text}</div>`
  ).join('');

  return `<!DOCTYPE html>
<html>
<head><title>Profile - Student Management</title><style>${CSS}</style></head>
<body>
<div class="navbar">
  <h1 id="profile-title">My Profile</h1>
  <div class="nav-links">
    <a href="/dashboard" class="nav-link" id="back-to-dashboard-link">Dashboard</a>
    <a href="/logout" id="logout-btn">Logout</a>
  </div>
</div>
<div class="container">
  ${flashHtml}
  <div class="profile-section">
    <h3 id="profile-heading">Account Information</h3>
    <form method="POST" action="/profile">
      <div class="profile-field">
        <label for="profile-name">Name</label>
        <input type="text" id="profile-name" name="name" value="${user.name || ''}" placeholder="Your name" required>
      </div>
      <div class="profile-field">
        <label for="profile-email">Email</label>
        <input type="email" id="profile-email" name="email" value="${user.email}" class="input-readonly" readonly>
      </div>

      <hr class="section-divider">

      <h3 id="change-password-heading" style="margin-bottom:20px;color:#0F172A;font-weight:700;font-size:16px;letter-spacing:-0.2px;">Change Password</h3>

      <div class="profile-field">
        <label for="profile-current-password">Current Password</label>
        <input type="password" id="profile-current-password" name="current_password" placeholder="Enter current password">
      </div>
      <div class="profile-field">
        <label for="profile-new-password">New Password</label>
        <input type="password" id="profile-new-password" name="new_password" placeholder="Min 6 characters">
      </div>
      <div class="profile-field">
        <label for="profile-confirm-password">Confirm New Password</label>
        <input type="password" id="profile-confirm-password" name="confirm_password" placeholder="Re-enter new password">
      </div>

      <button type="submit" class="btn-primary" id="profile-save-btn">Save Changes</button>
    </form>
    <div class="link" style="margin-top:16px;">
      <a href="/dashboard" id="profile-cancel-link">Back to Dashboard</a>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ── Auth Routes ─────────────────────────────────────────────────────────

app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  render(res, LOGIN_PAGE, req);
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    req.session.messages = [{ text: 'Invalid email or password.', type: 'danger' }];
    return res.redirect('/login');
  }
  req.session.userId = user.id;
  res.redirect('/dashboard');
});

app.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/dashboard');
  render(res, REGISTER_PAGE, req);
});

app.post('/register', (req, res) => {
  const { name, email, password, confirm } = req.body;
  if (!name || !name.trim()) {
    req.session.messages = [{ text: 'Please enter your name.', type: 'danger' }];
    return res.redirect('/register');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    req.session.messages = [{ text: 'Please enter a valid email address.', type: 'danger' }];
    return res.redirect('/register');
  }
  if (!password || password.length < 6) {
    req.session.messages = [{ text: 'Password must be at least 6 characters.', type: 'danger' }];
    return res.redirect('/register');
  }
  if (password !== confirm) {
    req.session.messages = [{ text: 'Passwords do not match.', type: 'danger' }];
    return res.redirect('/register');
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    req.session.messages = [{ text: 'An account with this email already exists.', type: 'danger' }];
    return res.redirect('/register');
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name.trim(), email, hash);
  req.session.messages = [{ text: 'Registration successful! Please log in.', type: 'success' }];
  res.redirect('/login');
});

app.get('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.redirect('/login');
  res.send(profilePage(user, req));
});

app.post('/profile', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.redirect('/login');
  const { name, current_password, new_password, confirm_password } = req.body;
  if (name && name.trim()) {
    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.session.userId);
  }
  if (current_password || new_password || confirm_password) {
    if (!current_password || !bcrypt.compareSync(current_password, user.password_hash)) {
      req.session.messages = [{ text: 'Current password is incorrect.', type: 'danger' }];
      return res.redirect('/profile');
    }
    if (!new_password || new_password.length < 6) {
      req.session.messages = [{ text: 'New password must be at least 6 characters.', type: 'danger' }];
      return res.redirect('/profile');
    }
    if (new_password !== confirm_password) {
      req.session.messages = [{ text: 'New passwords do not match.', type: 'danger' }];
      return res.redirect('/profile');
    }
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.session.userId);
  }
  req.session.messages = [{ text: 'Profile updated successfully!', type: 'success' }];
  res.redirect('/profile');
});

// ── Dashboard & Student CRUD ────────────────────────────────────────────

app.get('/', requireAuth, (req, res) => {
  res.redirect('/dashboard');
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.send(dashboardPage(req));
});

app.post('/add_student', requireAuth, (req, res) => {
  const { name, student_id, department } = req.body;
  if (!name || !student_id || !department) {
    req.session.messages = [{ text: 'All fields are required.', type: 'danger' }];
    return res.redirect('/dashboard');
  }
  const existing = db.prepare('SELECT id FROM students WHERE student_id = ?').get(student_id);
  if (existing) {
    req.session.messages = [{ text: 'Student ID already exists.', type: 'danger' }];
    return res.redirect('/dashboard');
  }
  db.prepare('INSERT INTO students (name, student_id, department) VALUES (?, ?, ?)').run(name, student_id, department);
  req.session.messages = [{ text: `Student "${name}" added successfully!`, type: 'success' }];
  res.redirect('/dashboard');
});

app.get('/edit/:id', requireAuth, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.redirect('/dashboard');
  res.send(editPage(student, req));
});

app.post('/edit/:id', requireAuth, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.redirect('/dashboard');
  const { name, student_id, department } = req.body;
  if (!name || !student_id || !department) {
    req.session.messages = [{ text: 'All fields are required.', type: 'danger' }];
    return res.redirect(`/edit/${req.params.id}`);
  }
  const dup = db.prepare('SELECT id FROM students WHERE student_id = ? AND id != ?').get(student_id, req.params.id);
  if (dup) {
    req.session.messages = [{ text: 'Student ID already belongs to another student.', type: 'danger' }];
    return res.redirect(`/edit/${req.params.id}`);
  }
  db.prepare('UPDATE students SET name = ?, student_id = ?, department = ? WHERE id = ?').run(name, student_id, department, req.params.id);
  req.session.messages = [{ text: `Student "${name}" updated successfully!`, type: 'success' }];
  res.redirect('/dashboard');
});

app.post('/delete/:id', requireAuth, (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!student) return res.redirect('/dashboard');
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
  req.session.messages = [{ text: `Student "${student.name}" deleted.`, type: 'success' }];
  res.redirect('/dashboard');
});

// ── Export for Vercel / Start for local ─────────────────────────────────

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
