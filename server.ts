import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import Database from 'better-sqlite3';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHIFT_START = '09:30';
const PUNCTUALITY_WEIGHT = 0.3;
const PRODUCTIVITY_WEIGHT = 0.7;
const STANDARD_WORKDAY_HOURS = 8;
const POINTS_PER_ERROR = 2;
const MAX_ERROR_PENALTY = 30;

const db = new Database(path.join(__dirname, 'bim_bytes_v2.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    joiningDate TEXT DEFAULT '',
    emergencyContact TEXT DEFAULT '',
    address TEXT DEFAULT '',
    weekOff TEXT DEFAULT 'Sunday',
    altSatOff INTEGER DEFAULT 1,
    photo TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS active_sessions (
    username TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    project TEXT NOT NULL,
    task TEXT NOT NULL,
    subtask TEXT NOT NULL,
    startStatus TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    comment TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'running',
    startTimeMs INTEGER NOT NULL,
    startDisplay TEXT NOT NULL,
    breakTotalSec INTEGER DEFAULT 0,
    currentBreakStartMs INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    project TEXT NOT NULL,
    task TEXT NOT NULL,
    subtask TEXT NOT NULL,
    startTime TEXT NOT NULL,
    endTime TEXT NOT NULL,
    workHours REAL NOT NULL,
    breakMinutes INTEGER NOT NULL,
    startStatus TEXT NOT NULL,
    endStatus TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    comment TEXT DEFAULT '',
    punctuality TEXT DEFAULT 'On Time'
  );

  CREATE TABLE IF NOT EXISTS qc_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    reviewer TEXT NOT NULL,
    employee TEXT NOT NULL,
    project TEXT NOT NULL,
    discipline TEXT NOT NULL,
    workType TEXT NOT NULL,
    subtask TEXT NOT NULL,
    errorCount INTEGER NOT NULL,
    comment TEXT DEFAULT '',
    status TEXT DEFAULT 'Pending',
    reviewedBy TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS circulars (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    postedBy TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    imageUrl TEXT DEFAULT '',
    posterUrl TEXT DEFAULT '',
    likesJson TEXT DEFAULT '[]',
    reactionsJson TEXT DEFAULT '{}',
    commentsJson TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    addedBy TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leaves (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    date TEXT NOT NULL,
    leaveType TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    appliedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS permissions (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    date TEXT NOT NULL,
    fromTime TEXT NOT NULL,
    toTime TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    appliedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS memos (
    id TEXT PRIMARY KEY,
    employee TEXT NOT NULL,
    type TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    sentBy TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    reply TEXT DEFAULT '',
    replyTime TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS chat_groups (
    groupId TEXT PRIMARY KEY,
    groupName TEXT NOT NULL,
    creator TEXT NOT NULL,
    membersJson TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    sender TEXT NOT NULL,
    receiver TEXT NOT NULL,
    message TEXT DEFAULT '',
    photoUrl TEXT DEFAULT '',
    isGroup INTEGER DEFAULT 0,
    timestamp TEXT NOT NULL,
    readByJson TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    actor TEXT NOT NULL,
    target TEXT NOT NULL,
    message TEXT NOT NULL,
    project TEXT DEFAULT '',
    task TEXT DEFAULT '',
    subtask TEXT DEFAULT '',
    extra TEXT DEFAULT '',
    timestamp TEXT NOT NULL,
    dismissed INTEGER DEFAULT 0,
    readByJson TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS project_milestones (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL,
    milestoneName TEXT NOT NULL,
    discipline TEXT NOT NULL,
    dueDate TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'In Progress',
    progress INTEGER NOT NULL DEFAULT 0,
    lead TEXT NOT NULL,
    deliverable TEXT DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'High'
  );

  CREATE TABLE IF NOT EXISTS role_rates (
    role TEXT PRIMARY KEY,
    hourlyRate REAL NOT NULL,
    currency TEXT DEFAULT 'USD'
  );

  CREATE TABLE IF NOT EXISTS project_budgets (
    project TEXT PRIMARY KEY,
    allocatedBudget REAL NOT NULL
  );
`);

function fmtDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function fmtClockShort(d = new Date()): string {
  return d.toTimeString().slice(0, 5);
}

function fmtTimestamp(d = new Date()): string {
  return `${fmtDate(d)} ${fmtClockShort(d)}`;
}

// Ensure priority column exists on existing SQLite tables
try {
  db.exec(`ALTER TABLE active_sessions ADD COLUMN priority TEXT DEFAULT 'Medium'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE sessions ADD COLUMN priority TEXT DEFAULT 'Medium'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE qc_logs ADD COLUMN status TEXT DEFAULT 'Pending'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE qc_logs ADD COLUMN reviewedBy TEXT DEFAULT ''`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN dailyFocus TEXT DEFAULT ''`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN dailyFocusDate TEXT DEFAULT ''`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN dailyFocusProject TEXT DEFAULT ''`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN employmentStatus TEXT DEFAULT 'Active'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN reportsTo TEXT DEFAULT 'Rebecca Mary'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN hourlySalary REAL DEFAULT 45`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN lunchBreakStart TEXT DEFAULT '13:00'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN lunchBreakEnd TEXT DEFAULT '13:45'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN teaBreakStart TEXT DEFAULT '17:00'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN teaBreakEnd TEXT DEFAULT '17:15'`);
} catch {
  // column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN autoBreakEnabled INTEGER DEFAULT 1`);
} catch {
  // column already exists
}
for (const colDef of [
  `empCode TEXT DEFAULT ''`,
  `department TEXT DEFAULT 'MEP-BIM'`,
  `designation TEXT DEFAULT 'BIM MODELER-MECHANICAL'`,
  `shiftIn TEXT DEFAULT '9:00 AM'`,
  `workingHours REAL DEFAULT 9`,
  `shiftOut TEXT DEFAULT '6:00 PM'`,
  `allSaturdaysOff INTEGER DEFAULT 0`,
  `monthlySalary REAL DEFAULT 23500`,
  `uanNumber TEXT DEFAULT '-'`,
  `workLocation TEXT DEFAULT 'BIM BYTES SOLUTIONS'`,
  `bankName TEXT DEFAULT '-'`,
  `bankAccountNo TEXT DEFAULT '-'`,
  `ifscCode TEXT DEFAULT '-'`,
  `branchName TEXT DEFAULT '-'`,
  `pfNumber TEXT DEFAULT '-'`,
  `esicNumber TEXT DEFAULT '-'`,
  `screenTimeHours REAL DEFAULT 0`,
]) {
  try {
    db.exec(`ALTER TABLE users ADD COLUMN ${colDef}`);
  } catch {
    // column already exists
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS job_assignments (
    id TEXT PRIMARY KEY,
    employee TEXT NOT NULL,
    project TEXT NOT NULL,
    task TEXT NOT NULL,
    subtask TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    assignedBy TEXT NOT NULL,
    assignedByRole TEXT NOT NULL,
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'Assigned',
    updatedAt TEXT NOT NULL
  );
`);

// Seed initial Daily Huddle focuses, Salary, Reports To, and Job Assignments if empty
{
  const todaySeed = fmtDate();
  const focusSamples: Array<[string, string, string, string, number, string]> = [
    ['Rebecca Mary', 'Federated MEP model review & Q4 milestone signoff for Station Level-2', 'CMRL', 'Founder / Board', 85, 'Active'],
    ['Arun Kumar', 'Resource allocation & budget burn audit across active hospital packages', 'RSRM Hospital', 'Rebecca Mary (Founder)', 80, 'Active'],
    ['Karthik S', 'LOD 350 HVAC & Fire Fighting QC clash matrix verification in Zone B', 'CMRL', 'Rebecca Mary (Manager)', 60, 'Active'],
    ['Priya Nair', 'Electrical ELV & lighting circuit parameter QA inspection', 'SPA RITZ AND ADDRESS', 'Arun Kumar (Coordinator)', 58, 'Active'],
    ['Vignesh R', 'Station chiller plant room DN250 header piping & fire damper sleeves', 'CMRL', 'Karthik S (Main Handover)', 45, 'Active'],
    ['Deepak M', 'Hall B 600mm ladder tray & busduct containment clash resolution', 'Data Center', 'Karthik S (Main Handover)', 44, 'Active'],
    ['Anitha V', 'Podium drainage slope verification & shop drawing sheets PL-101 to PL-108', 'MBS-IR2', 'Priya Nair (Coordinator)', 42, 'Active'],
    ['Surya Prakash', 'Chiller plant room equipment asset tagging & COBie parameter drop', 'Tanglin Shopping Center', 'Priya Nair (Coordinator)', 40, 'Active'],
  ];
  const updFocus = db.prepare(`
    UPDATE users
    SET dailyFocus = COALESCE(NULLIF(dailyFocus, ''), ?),
        dailyFocusDate = COALESCE(NULLIF(dailyFocusDate, ''), ?),
        dailyFocusProject = COALESCE(NULLIF(dailyFocusProject, ''), ?),
        reportsTo = COALESCE(NULLIF(reportsTo, ''), ?),
        hourlySalary = CASE WHEN hourlySalary IS NULL OR hourlySalary = 0 THEN ? ELSE hourlySalary END,
        employmentStatus = COALESCE(NULLIF(employmentStatus, ''), ?)
    WHERE username = ?
  `);
  for (const [uname, focusText, proj, repTo, hrSal, empStat] of focusSamples) {
    updFocus.run(focusText, todaySeed, proj, repTo, hrSal, empStat, uname);
  }

  const jobCount = (db.prepare(`SELECT COUNT(*) as c FROM job_assignments`).get() as { c: number }).c;
  if (jobCount === 0) {
    const insJob = db.prepare(`
      INSERT INTO job_assignments (id, employee, project, task, subtask, priority, assignedBy, assignedByRole, notes, status, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const nowTs = fmtTimestamp();
    insJob.run('job_1', 'Vignesh R', 'CMRL', 'Modeling', 'HVAC', 'High', 'Rebecca Mary', 'Main Handover', 'Complete Station Level-2 concourse HVAC duct routing & fire damper sleeves', 'In Progress', nowTs);
    insJob.run('job_2', 'Deepak M', 'Data Center', 'Coordination', 'Containment', 'Urgent', 'Arun Kumar', 'Coordinator', 'Resolve Hall B 600mm ladder tray & busduct clashes before 5 PM', 'Assigned', nowTs);
    insJob.run('job_3', 'Anitha V', 'MBS-IR2', 'Shop drawing', 'Plumbing', 'High', 'Rebecca Mary', 'Manager', 'Issue Podium drainage & plumbing shop drawing sheets PL-101 to PL-108', 'In Progress', nowTs);
    insJob.run('job_4', 'Surya Prakash', 'Tanglin Shopping Center', 'Asbuild', 'Asset Tagging', 'Medium', 'Karthik S', 'Main Handover', 'Complete chiller plant room COBie parameter tagging', 'Assigned', nowTs);
    insJob.run('job_5', 'Karthik S', 'CMRL', 'Coordination', 'Fire Fighting', 'High', 'Rebecca Mary', 'Founder', 'Verify Zone B sprinkler main clash-free matrix', 'Assigned', nowTs);
    insJob.run('job_6', 'Priya Nair', 'SPA RITZ AND ADDRESS', 'Low Voltage', 'Ceiling Lighting', 'Medium', 'Arun Kumar', 'HR', 'Audit guest room luminaire circuit tags', 'Assigned', nowTs);
    insJob.run('job_7', 'Rebecca Mary', 'CMRL', 'Coordination', 'HVAC', 'High', 'Rebecca Mary', 'Founder', 'Station Level-2 federated model priority review', 'In Progress', nowTs);
    insJob.run('job_8', 'MARI SELVAM', 'CMRL', 'Modeling', 'HVAC', 'High', 'SENTHIL KUMAR G', 'Main Handover', 'Station Concourse Mechanical HVAC Modeling Package', 'In Progress', nowTs);
    insJob.run('job_9', 'SONAIMUTHU V', 'CMRL', 'Coordination', 'HVAC', 'High', 'REBECCA MARY REETHU P', 'HR', 'Senior Mechanical BIM Coordination Signoff', 'In Progress', nowTs);
  }

  // Seed the full BIM Bytes Solutions Employee Roster from the user's attendance & payroll sheets
  const rosterEmployees: Array<{
    username: string;
    empCode: string;
    department: string;
    designation: string;
    role: string;
    shiftIn: string;
    workingHours: number;
    shiftOut: string;
    allSaturdaysOff: number;
    monthlySalary: number;
    hourlySalary: number;
    screenTimeHours: number;
    reportsTo: string;
  }> = [
    { username: 'SONAIMUTHU V', empCode: '1001', department: 'CO-ORDINATOR', designation: 'SENIOR BIM MODELER-MECHANICAL', role: 'Coordinator', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 32000, hourlySalary: 140, screenTimeHours: 168.5, reportsTo: 'REBECCA MARY REETHU P' },
    { username: 'KARTHI M', empCode: '1013', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24000, hourlySalary: 105, screenTimeHours: 52.4, reportsTo: 'SONAIMUTHU V' },
    { username: 'THANZEELER RAHMAN', empCode: '1017', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 25000, hourlySalary: 110, screenTimeHours: 171.2, reportsTo: 'SONAIMUTHU V' },
    { username: 'MARI SELVAM', empCode: '1018', department: 'MEP-BIM', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 142.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'JANARTHANAN', empCode: '1020', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 25000, hourlySalary: 110, screenTimeHours: 172.8, reportsTo: 'SONAIMUTHU V' },
    { username: 'DEEPAK', empCode: '1021', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24500, hourlySalary: 108, screenTimeHours: 163.5, reportsTo: 'SONAIMUTHU V' },
    { username: 'SIVAKUMAR', empCode: '1022', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24000, hourlySalary: 105, screenTimeHours: 160.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'AGATHIYAN EZHIL ADHAN', empCode: '1024', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24000, hourlySalary: 105, screenTimeHours: 158.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'GOKULNATH', empCode: '1025', department: 'MEP-MECHANICAL', designation: 'Jr.BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 19500, hourlySalary: 85, screenTimeHours: 174.2, reportsTo: 'SONAIMUTHU V' },
    { username: 'TAMIZHARASAN', empCode: '1029', department: 'MEP-MECHANICAL', designation: 'Jr.BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 19500, hourlySalary: 85, screenTimeHours: 160.4, reportsTo: 'SONAIMUTHU V' },
    { username: 'SIRIKI VEERA SATISH', empCode: '1030', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 155.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'REBECCA MARY REETHU P', empCode: '1031', department: 'BIM-HR/ADMIN', designation: 'BIM-HR/ADMIN', role: 'HR', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 1, monthlySalary: 35000, hourlySalary: 155, screenTimeHours: 85.5, reportsTo: 'Founder' },
    { username: 'KIRI PAVAN', empCode: '1034', department: 'MEP-ELECTRICAL', designation: 'Jr.BIM MODELER -ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 19000, hourlySalary: 82, screenTimeHours: 102.3, reportsTo: 'SONAIMUTHU V' },
    { username: 'MAJHARULLA', empCode: '1035', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 152.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'KARTHICK P', empCode: '1036', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'QC', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 26000, hourlySalary: 115, screenTimeHours: 164.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'SURYA PRAKASH', empCode: '1037', department: 'MEP-MECHANICAL', designation: 'Jr.BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 19000, hourlySalary: 82, screenTimeHours: 88.6, reportsTo: 'SONAIMUTHU V' },
    { username: 'RANJITHA D', empCode: '1038', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23000, hourlySalary: 100, screenTimeHours: 159.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'J MOHAMED HASIK', empCode: '1039', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 166.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'G AKASH', empCode: '1040', department: 'MEP-MECHANICAL', designation: 'Jr.BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 18500, hourlySalary: 80, screenTimeHours: 140.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'KARTHI G', empCode: '1041', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24000, hourlySalary: 105, screenTimeHours: 170.5, reportsTo: 'SONAIMUTHU V' },
    { username: 'THASLEEMA A', empCode: '1042', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 8, shiftOut: '5:00 PM', allSaturdaysOff: 1, monthlySalary: 22500, hourlySalary: 105, screenTimeHours: 154.0, reportsTo: 'REBECCA MARY REETHU P' },
    { username: 'KATTU BAVA K', empCode: '1043', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24500, hourlySalary: 108, screenTimeHours: 173.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'SARAVANA KUMAR BP', empCode: '1044', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24500, hourlySalary: 108, screenTimeHours: 167.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'SANJAY D', empCode: '1045', department: 'MEP-MECHANICAL', designation: 'Jr.BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 18500, hourlySalary: 80, screenTimeHours: 138.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'MOHANAKRISHNAN', empCode: '1046', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23000, hourlySalary: 100, screenTimeHours: 145.0, reportsTo: 'SONAIMUTHU V' },
    { username: 'SELVAN A', empCode: '1047', department: 'MEP-MECHANICAL', designation: 'SENIOR BIM MODELER-MECHANICAL', role: 'Main Handover', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 30000, hourlySalary: 132, screenTimeHours: 175.5, reportsTo: 'REBECCA MARY REETHU P' },
    { username: 'HASAN FAMEERDEEN S', empCode: '1048', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 24000, hourlySalary: 105, screenTimeHours: 172.0, reportsTo: 'SELVAN A' },
    { username: 'SENTHIL KUMAR G', empCode: '1049', department: 'MEP-MECHANICAL', designation: 'SENIOR BIM COORDINATOR', role: 'Main Handover', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 31000, hourlySalary: 135, screenTimeHours: 169.0, reportsTo: 'REBECCA MARY REETHU P' },
    { username: 'SARAN BALAJI S', empCode: '1050', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23000, hourlySalary: 100, screenTimeHours: 161.0, reportsTo: 'SELVAN A' },
    { username: 'NAGOOR MEERAN MALIK SK', empCode: '1051', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 163.0, reportsTo: 'SELVAN A' },
    { username: 'SURYA B', empCode: '1052', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 171.0, reportsTo: 'SELVAN A' },
    { username: 'ABHISHEK V', empCode: '1053', department: 'MEP-ELECTRICAL', designation: 'BIM MODELER-ELECTRICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23500, hourlySalary: 102, screenTimeHours: 172.5, reportsTo: 'SELVAN A' },
    { username: 'SABARISH D', empCode: '1054', department: 'MEP-MECHANICAL', designation: 'BIM MODELER-MECHANICAL', role: 'Production', shiftIn: '9:00 AM', workingHours: 9, shiftOut: '6:00 PM', allSaturdaysOff: 0, monthlySalary: 23000, hourlySalary: 100, screenTimeHours: 160.0, reportsTo: 'SELVAN A' },
  ];

  const insRosterUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      username, password, role, empCode, department, designation,
      shiftIn, workingHours, shiftOut, allSaturdaysOff,
      monthlySalary, hourlySalary, screenTimeHours, reportsTo,
      joiningDate, address, weekOff, altSatOff, employmentStatus,
      workLocation, uanNumber, bankName, bankAccountNo, ifscCode, branchName, pfNumber, esicNumber
    ) VALUES (?, '1234', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2024-01-10', 'Avadi, Chennai', 'Sunday', 1, 'Active', 'BIM BYTES SOLUTIONS', '-', '-', '-', '-', '-', '-', '-')
  `);
  const updRosterMeta = db.prepare(`
    UPDATE users
    SET empCode = CASE WHEN empCode IS NULL OR empCode = '' THEN ? ELSE empCode END,
        department = CASE WHEN department IS NULL OR department = '' THEN ? ELSE department END,
        designation = CASE WHEN designation IS NULL OR designation = '' THEN ? ELSE designation END,
        shiftIn = CASE WHEN shiftIn IS NULL OR shiftIn = '' THEN ? ELSE shiftIn END,
        workingHours = CASE WHEN workingHours IS NULL OR workingHours = 0 THEN ? ELSE workingHours END,
        shiftOut = CASE WHEN shiftOut IS NULL OR shiftOut = '' THEN ? ELSE shiftOut END,
        monthlySalary = CASE WHEN monthlySalary IS NULL OR monthlySalary = 0 THEN ? ELSE monthlySalary END,
        screenTimeHours = CASE WHEN screenTimeHours IS NULL OR screenTimeHours = 0 THEN ? ELSE screenTimeHours END
    WHERE username = ?
  `);
  for (const emp of rosterEmployees) {
    insRosterUser.run(
      emp.username,
      emp.role,
      emp.empCode,
      emp.department,
      emp.designation,
      emp.shiftIn,
      emp.workingHours,
      emp.shiftOut,
      emp.allSaturdaysOff,
      emp.monthlySalary,
      emp.hourlySalary,
      emp.screenTimeHours,
      emp.reportsTo
    );
    updRosterMeta.run(
      emp.empCode,
      emp.department,
      emp.designation,
      emp.shiftIn,
      emp.workingHours,
      emp.shiftOut,
      emp.monthlySalary,
      emp.screenTimeHours,
      emp.username
    );
  }
}

// Seed an active session for Rebecca Mary if none exists so the header active session priority display is immediately visible
const rebeccaActive = db.prepare(`SELECT username FROM active_sessions WHERE username = 'Rebecca Mary'`).get();
if (!rebeccaActive) {
  const nowInit = new Date();
  db.prepare(`
    INSERT INTO active_sessions (username, role, project, task, subtask, startStatus, priority, comment, status, startTimeMs, startDisplay, breakTotalSec, currentBreakStartMs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, 0, NULL)
  `).run(
    'Rebecca Mary',
    'Management',
    'CMRL',
    'Coordination',
    'HVAC',
    '60%',
    'High',
    'Station Level-2 federated model priority review',
    nowInit.getTime() - 5240 * 1000,
    '09:30:00'
  );
}

// Seed a sample BIM image in grp_mep_core and additional QC logs if not yet present
const imgMsgExists = db.prepare(`SELECT id FROM chat_messages WHERE id = 'msg_4_img'`).get();
if (!imgMsgExists) {
  const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="320" viewBox="0 0 600 320">
    <rect width="600" height="320" fill="#0d1119"/>
    <g stroke="#1e293b" stroke-width="1">
      <line x1="0" y1="60" x2="600" y2="60"/><line x1="0" y1="120" x2="600" y2="120"/>
      <line x1="0" y1="180" x2="600" y2="180"/><line x1="0" y1="240" x2="600" y2="240"/>
      <line x1="120" y1="0" x2="120" y2="320"/><line x1="240" y1="0" x2="240" y2="320"/>
      <line x1="360" y1="0" x2="360" y2="320"/><line x1="480" y1="0" x2="480" y2="320"/>
    </g>
    <rect x="40" y="70" width="520" height="42" rx="6" fill="#0284c7" fill-opacity="0.25" stroke="#38bdf8" stroke-width="2"/>
    <text x="60" y="96" fill="#e0f2fe" font-family="monospace" font-size="12" font-weight="bold">CHILLER HEADER PIPE DN250 · EL +3850mm</text>
    <rect x="250" y="35" width="84" height="210" rx="6" fill="#dc2626" fill-opacity="0.25" stroke="#ef4444" stroke-width="2"/>
    <circle cx="292" cy="91" r="22" fill="#ef4444" fill-opacity="0.35" stroke="#f87171" stroke-width="2.5" stroke-dasharray="4 3"/>
    <rect x="40" y="245" width="520" height="50" rx="8" fill="#111827" stroke="#334155" stroke-width="1.5"/>
    <text x="58" y="267" fill="#38bdf8" font-family="sans-serif" font-size="12" font-weight="bold">NAVISWORKS CLASH VIEWPOINT #18 · CMRL ZONE B</text>
    <text x="58" y="284" fill="#94a3b8" font-family="monospace" font-size="11">Click "Copy Image" or "Paste to Input" below, or press Ctrl+V in chat</text>
  </svg>`;
  const sampleDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(sampleSvg)}`;
  db.prepare(`
    INSERT INTO chat_messages (id, sender, receiver, message, photoUrl, isGroup, timestamp, readByJson)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'msg_4_img',
    'Karthik S',
    'grp_mep_core',
    'Attached the Navisworks clash viewpoint for CMRL Zone B — you can copy & paste screenshots directly in this chat (Ctrl+V).',
    sampleDataUrl,
    1,
    '10:24',
    JSON.stringify(['Karthik S'])
  );

  const qcCount = (db.prepare(`SELECT COUNT(*) as c FROM qc_logs`).get() as { c: number }).c;
  if (qcCount < 4) {
    const insQcExtra = db.prepare(`
      INSERT INTO qc_logs (timestamp, reviewer, employee, project, discipline, workType, subtask, errorCount, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insQcExtra.run('2026-11-05 11:20', 'Karthik S', 'Anitha V', 'MBS-IR2', 'Mechanical', 'Shop drawing', 'Plumbing', 4, 'Invert level annotation missing on Podium RWP riser sheet');
    insQcExtra.run('2026-11-06 09:50', 'Priya Nair', 'Surya Prakash', 'SPA RITZ AND ADDRESS', 'Electrical', 'Modeling', 'Lighting', 3, 'Emergency luminaire family circuit parameter mismatch');
    insQcExtra.run('2026-11-06 10:15', 'Karthik S', 'Vignesh R', 'Tanglin Shopping Center', 'Mechanical', 'Coordination', 'Fire Fighting', 0, 'Zero-error signoff on Zone A sprinkler main');
  }
}

// Seed initial realistic BIM Bytes data if empty
const rateCount = (db.prepare('SELECT COUNT(*) as c FROM role_rates').get() as { c: number }).c;
if (rateCount === 0) {
  const insRate = db.prepare(`INSERT INTO role_rates (role, hourlyRate, currency) VALUES (?, ?, ?)`);
  insRate.run('Management', 85, 'USD');
  insRate.run('QC', 60, 'USD');
  insRate.run('Production', 42, 'USD');

  const insBudget = db.prepare(`INSERT INTO project_budgets (project, allocatedBudget) VALUES (?, ?)`);
  insBudget.run('CMRL', 15000);
  insBudget.run('Data Center', 12000);
  insBudget.run('MBS-IR2', 18000);
  insBudget.run('SPA RITZ AND ADDRESS', 14000);
  insBudget.run('Tanglin Shopping Center', 10000);
  insBudget.run('RSRM Hospital', 9500);
}

const milestoneCount = (db.prepare('SELECT COUNT(*) as c FROM project_milestones').get() as { c: number }).c;
if (milestoneCount === 0) {
  const insMs = db.prepare(`
    INSERT INTO project_milestones (id, project, milestoneName, discipline, dueDate, status, progress, lead, deliverable, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const baseNow = Date.now();
  const dPlus = (days: number) => new Date(baseNow + days * 86400000).toISOString().slice(0, 10);

  insMs.run(
    'ms_1',
    'CMRL',
    'Station Level-2 HVAC & Fire Fighting Federated Model',
    'Mechanical',
    dPlus(3),
    'In Progress',
    78,
    'Vignesh R',
    'LOD 350 Federated NWD + Zero-Clash Matrix',
    'Critical'
  );
  insMs.run(
    'ms_2',
    'MBS-IR2',
    'Podium Drainage & Plumbing Shop Drawings Issue',
    'Mechanical',
    dPlus(6),
    'In Progress',
    65,
    'Anitha V',
    'Sheets PL-101 to PL-118 Rev B',
    'High'
  );
  insMs.run(
    'ms_3',
    'Data Center',
    'Hall B LV/ELV Containment Clash-Free Signoff',
    'Electrical',
    dPlus(10),
    'QA Review',
    90,
    'Karthik S',
    '600mm Ladder Tray & Busduct Clearance Signoff',
    'Critical'
  );
  insMs.run(
    'ms_4',
    'SPA RITZ AND ADDRESS',
    'Guest Room GRMS & Small Power As-Built Package',
    'Electrical',
    dPlus(16),
    'In Progress',
    52,
    'Deepak M',
    'As-Built Revit Models + Asset Tagging Schedule',
    'Medium'
  );
  insMs.run(
    'ms_5',
    'Tanglin Shopping Center',
    'Chiller Plant Room Equipment Tagging & COBie Drop',
    'Multi-Discipline',
    dPlus(23),
    'Upcoming',
    35,
    'Surya Prakash',
    'ISO-19650 COBie Spreadsheet + Sheet Set',
    'High'
  );
  insMs.run(
    'ms_6',
    'RSRM Hospital',
    'Medical Gas & OT Ceiling Coordination Submission',
    'Mechanical',
    dPlus(-2),
    'Completed',
    100,
    'Priya Nair',
    'Approved Client Submission Package v2.0',
    'High'
  );
}

const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
if (userCount === 0) {
  const insUser = db.prepare(`
    INSERT INTO users (username, password, role, joiningDate, emergencyContact, address, weekOff, altSatOff, photo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedUsers = [
    ['Rebecca Mary', '1234', 'Management', '2022-03-15', '+91 98401 22334', 'Anna Nagar, Chennai', 'Sunday', 1, ''],
    ['Arun Kumar', '1234', 'Management', '2021-06-01', '+91 98402 11223', 'Adyar, Chennai', 'Sunday', 1, ''],
    ['Karthik S', '1234', 'QC', '2023-01-10', '+91 98403 44556', 'Velachery, Chennai', 'Sunday', 1, ''],
    ['Priya Nair', '1234', 'QC', '2023-02-18', '+91 98404 55667', 'Guindy, Chennai', 'Sunday', 1, ''],
    ['Vignesh R', '1234', 'Production', '2023-07-12', '+91 98405 66778', 'Tambaram, Chennai', 'Sunday', 1, ''],
    ['Deepak M', '1234', 'Production', '2023-09-04', '+91 98406 77889', 'Porur, Chennai', 'Sunday', 1, ''],
    ['Anitha V', '1234', 'Production', '2024-01-20', '+91 98407 88990', 'OMR, Chennai', 'Sunday', 1, ''],
    ['Surya Prakash', '1234', 'Production', '2024-03-11', '+91 98408 99001', 'T. Nagar, Chennai', 'Sunday', 1, ''],
  ];
  for (const u of seedUsers) insUser.run(...u);

  const now = new Date();
  const today = fmtDate(now);
  const yesterday = fmtDate(new Date(now.getTime() - 86400000));
  const twoDaysAgo = fmtDate(new Date(now.getTime() - 2 * 86400000));

  const insSession = db.prepare(`
    INSERT INTO sessions (date, username, role, project, task, subtask, startTime, endTime, workHours, breakMinutes, startStatus, endStatus, comment, punctuality)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insSession.run(yesterday, 'Vignesh R', 'Production', 'CMRL', 'Modeling', 'HVAC', '09:18', '18:30', 8.4, 45, '20%', '80%', 'Completed Level 2 concourse HVAC duct routing', 'On Time');
  insSession.run(yesterday, 'Deepak M', 'Production', 'Data Center', 'Coordination', 'Containment', '09:38', '18:35', 8.2, 35, '40%', '90%', 'Clash detection resolved for Hall B cable trays', 'Late');
  insSession.run(yesterday, 'Anitha V', 'Production', 'MBS-IR2', 'Shop drawing', 'Fire Fighting', '09:15', '18:30', 8.6, 40, '30%', '100%', 'Sprinkler layout sheets 101-108 issued', 'On Time');
  insSession.run(twoDaysAgo, 'Rebecca Mary', 'Management', 'SPA RITZ AND ADDRESS', 'Coordination', 'HVAC', '09:20', '18:30', 8.6, 30, '50%', '100%', 'Model audit and client federated review', 'On Time');
  insSession.run(twoDaysAgo, 'Karthik S', 'QC', 'CMRL', 'Comments update', 'HVAC', '09:25', '18:25', 8.3, 35, '10%', '100%', 'QC verification for station mechanical rooms', 'On Time');

  // Seed 2 live active sessions
  const insActive = db.prepare(`
    INSERT INTO active_sessions (username, role, project, task, subtask, startStatus, comment, status, startTimeMs, startDisplay, breakTotalSec, currentBreakStartMs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insActive.run('Vignesh R', 'Production', 'CMRL', 'Modeling', 'HVAC', '60%', 'Station chiller plant room piping', 'running', now.getTime() - 9400 * 1000, '09:20:00', 600, null);
  insActive.run('Anitha V', 'Production', 'MBS-IR2', 'Coordination', 'Plumbing', '40%', 'Podium drainage slope verification', 'running', now.getTime() - 7800 * 1000, '09:26:00', 0, null);

  // Seed QC logs
  const insQc = db.prepare(`
    INSERT INTO qc_logs (timestamp, reviewer, employee, project, discipline, workType, subtask, errorCount, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insQc.run(`${yesterday} 16:40`, 'Karthik S', 'Vignesh R', 'CMRL', 'Mechanical', 'Modeling', 'HVAC', 2, 'Fire damper sleeve elevation mismatch at Grid C-04');
  insQc.run(`${yesterday} 17:15`, 'Priya Nair', 'Deepak M', 'Data Center', 'Electrical', 'Coordination', 'Containment', 1, 'Missing clearance tag on 600mm ladder tray');

  // Seed Circulars
  const insCirc = db.prepare(`
    INSERT INTO circulars (id, title, message, postedBy, timestamp, imageUrl, posterUrl, likesJson, reactionsJson, commentsJson)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insCirc.run(
    'circ_1',
    'BIM ISO-19650 Naming Standard v3.2 Rollout',
    'All production and QC engineers must verify sheet revision codes and workset naming conventions before Friday 17:00 submission for CMRL, MBS-IR2, and Data Center packages.',
    'Rebecca Mary',
    `${today} 09:30`,
    '',
    '',
    JSON.stringify(['Karthik S', 'Vignesh R']),
    JSON.stringify({ '👍': ['Karthik S', 'Vignesh R', 'Anitha V'], '🔥': ['Arun Kumar'] }),
    JSON.stringify([
      { id: 'cm_1', username: 'Karthik S', comment: 'Noted! QC checklist updated accordingly.', timestamp: '09:42' },
    ])
  );
  insCirc.run(
    'circ_2',
    'Q4 Client Milestone Delivery Appreciation',
    'Congratulations to the Mechanical & Electrical teams for achieving 99.2% clash-free delivery on SPA RITZ AND ADDRESS Phase 2!',
    'Arun Kumar',
    `${yesterday} 18:00`,
    '',
    '',
    JSON.stringify(['Rebecca Mary', 'Priya Nair']),
    JSON.stringify({ '🎉': ['Rebecca Mary', 'Priya Nair', 'Deepak M'], '❤️': ['Anitha V'] }),
    JSON.stringify([])
  );

  // Seed Holidays
  const insHol = db.prepare(`INSERT INTO holidays (id, date, name, addedBy) VALUES (?, ?, ?, ?)`);
  insHol.run('hol_1', '2026-11-12', 'Diwali Festival Holiday', 'Rebecca Mary');
  insHol.run('hol_2', '2026-12-25', 'Christmas Day', 'Rebecca Mary');
  insHol.run('hol_3', '2027-01-01', 'New Year Day', 'Rebecca Mary');

  // Seed Memos
  const insMemo = db.prepare(`
    INSERT INTO memos (id, employee, type, subject, message, sentBy, timestamp, reply, replyTime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insMemo.run(
    'memo_1',
    'Deepak M',
    'Memo',
    'Containment Clash Matrix Update',
    'Please ensure the Data Center Hall B containment clash matrix is updated prior to the 4:00 PM coordination review.',
    'Arun Kumar',
    `${today} 10:15`,
    '',
    ''
  );

  // Seed Chat Groups & Messages
  db.prepare(`INSERT INTO chat_groups (groupId, groupName, creator, membersJson, createdAt) VALUES (?, ?, ?, ?, ?)`).run(
    'grp_mep_core',
    'MEP Coordination Core',
    'Rebecca Mary',
    JSON.stringify(['Rebecca Mary', 'Arun Kumar', 'Karthik S', 'Priya Nair', 'Vignesh R', 'Deepak M', 'Anitha V']),
    today
  );

  const insChat = db.prepare(`
    INSERT INTO chat_messages (id, sender, receiver, message, photoUrl, isGroup, timestamp, readByJson)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insChat.run('msg_1', 'Karthik S', 'Rebecca Mary', 'Hi Rebecca, CMRL Mechanical QC checklist for Zone B is completed and logged.', '', 0, '10:05', JSON.stringify(['Karthik S']));
  insChat.run('msg_2', 'Anitha V', 'Rebecca Mary', 'Uploaded the updated federated NWD for MBS-IR2 podium level.', '', 0, '10:18', JSON.stringify(['Anitha V']));
  insChat.run('msg_3', 'Rebecca Mary', 'grp_mep_core', 'Morning team! Please ensure all active work timers are started with accurate Subtask tags today.', '', 1, '09:32', JSON.stringify(['Rebecca Mary']));

  // Seed Notifications
  const insNotif = db.prepare(`
    INSERT INTO notifications (id, type, actor, target, message, project, task, subtask, extra, timestamp, dismissed, readByJson)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insNotif.run('notif_1', 'qc_error', 'Karthik S', 'Vignesh R', 'flagged 2 QC error(s) on your HVAC Modeling deliverable', 'CMRL', 'Modeling', 'HVAC', 'Fire damper sleeve elevation mismatch at Grid C-04', `${yesterday} 16:40`, 0, JSON.stringify([]));
  insNotif.run('notif_2', 'session_start', 'Vignesh R', 'ALL', 'started working on Station chiller plant room piping', 'CMRL', 'Modeling', 'HVAC', 'On Time (09:20)', `${today} 09:20`, 0, JSON.stringify([]));
  insNotif.run('notif_3', 'session_start', 'Anitha V', 'ALL', 'started working on Podium drainage slope verification', 'MBS-IR2', 'Coordination', 'Plumbing', 'On Time (09:26)', `${today} 09:26`, 0, JSON.stringify([]));
  insNotif.run('notif_4', 'circular_posted', 'Rebecca Mary', 'ALL', 'published circular: BIM ISO-19650 Naming Standard v3.2 Rollout', '', '', '', 'Mandatory compliance before Friday', `${today} 09:30`, 0, JSON.stringify([]));
  insNotif.run('notif_5', 'chat_message', 'Karthik S', 'Rebecca Mary', 'sent you a direct message: "Hi Rebecca, CMRL Mechanical QC checklist..."', 'CMRL', '', '', '', `${today} 10:05`, 0, JSON.stringify([]));
}

// ============================================================================
// WEBSOCKET CONNECTION REGISTRY & HELPERS
// ============================================================================
interface WsClient {
  ws: WebSocket;
  username: string;
  role: string;
}

const wsClients = new Set<WsClient>();

function getEmployeesList() {
  const rows = db.prepare(`SELECT * FROM users ORDER BY CASE WHEN empCode != '' AND empCode IS NOT NULL THEN CAST(empCode AS INTEGER) ELSE 9999 END ASC, username ASC`).all() as any[];
  return rows.map((r, idx) => ({
    username: r.username,
    role: r.role,
    empCode: r.empCode || String(1001 + idx),
    department: r.department || 'MEP-BIM',
    designation: r.designation || (r.role === 'HR' || r.role === 'Management' ? 'BIM-HR/ADMIN' : 'BIM MODELER-MECHANICAL'),
    shiftIn: r.shiftIn || '9:00 AM',
    workingHours: Number(r.workingHours ?? 9),
    shiftOut: r.shiftOut || '6:00 PM',
    allSaturdaysOff: Boolean(r.allSaturdaysOff),
    monthlySalary: Number(r.monthlySalary ?? 23500),
    uanNumber: r.uanNumber || '-',
    workLocation: r.workLocation || 'BIM BYTES SOLUTIONS',
    bankName: r.bankName || '-',
    bankAccountNo: r.bankAccountNo || '-',
    ifscCode: r.ifscCode || '-',
    branchName: r.branchName || '-',
    pfNumber: r.pfNumber || '-',
    esicNumber: r.esicNumber || '-',
    screenTimeHours: Number(r.screenTimeHours ?? 156),
    joiningDate: r.joiningDate || '',
    emergencyContact: r.emergencyContact || '',
    address: r.address || 'Avadi, Chennai',
    weekOff: r.weekOff || 'Sunday',
    altSatOff: Boolean(r.altSatOff),
    photo: r.photo || '',
    dailyFocus: r.dailyFocus || '',
    dailyFocusDate: r.dailyFocusDate || '',
    dailyFocusProject: r.dailyFocusProject || '',
    employmentStatus: r.employmentStatus || 'Active',
    reportsTo: r.reportsTo || 'Rebecca Mary',
    hourlySalary: Number(r.hourlySalary ?? 102),
    lunchBreakStart: r.lunchBreakStart || '13:00',
    lunchBreakEnd: r.lunchBreakEnd || '13:45',
    teaBreakStart: r.teaBreakStart || '17:00',
    teaBreakEnd: r.teaBreakEnd || '17:15',
    autoBreakEnabled: r.autoBreakEnabled === undefined ? true : Boolean(r.autoBreakEnabled),
  }));
}

function getPresenceArray() {
  const users = getEmployeesList();
  const activeRows = db.prepare(`SELECT * FROM active_sessions`).all() as any[];
  const activeMap = new Map<string, any>();
  for (const a of activeRows) activeMap.set(a.username, a);

  const deviceCounts = new Map<string, number>();
  for (const c of wsClients) {
    if (c.username) {
      deviceCounts.set(c.username, (deviceCounts.get(c.username) || 0) + 1);
    }
  }

  return users.map((u) => {
    const act = activeMap.get(u.username);
    const devCount = deviceCounts.get(u.username) || (act ? 1 : 0);
    return {
      username: u.username,
      online: devCount > 0 || Boolean(act),
      devices: devCount,
      dailyFocus: u.dailyFocus || '',
      dailyFocusDate: u.dailyFocusDate || '',
      dailyFocusProject: u.dailyFocusProject || '',
      session: act
        ? {
            status: act.status as 'running' | 'on_break',
            project: act.project,
            task: act.task,
            subtask: act.subtask,
            priority: act.priority || 'Medium',
            startTimeMs: Number(act.startTimeMs),
            breakTotalSec: Number(act.breakTotalSec || 0),
            currentBreakStartMs: act.currentBreakStartMs ? Number(act.currentBreakStartMs) : null,
          }
        : null,
    };
  });
}

function broadcastWs(payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  for (const client of wsClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(raw);
    }
  }
}

function broadcastPresence() {
  broadcastWs({
    type: 'presence:updated',
    presence: getPresenceArray(),
  });
}

function createAndBroadcastNotification(params: {
  type: string;
  actor: string;
  target: string;
  message: string;
  project?: string;
  task?: string;
  subtask?: string;
  extra?: string;
}) {
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = fmtTimestamp();
  db.prepare(`
    INSERT INTO notifications (id, type, actor, target, message, project, task, subtask, extra, timestamp, dismissed, readByJson)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]')
  `).run(
    id,
    params.type,
    params.actor,
    params.target,
    params.message,
    params.project || '',
    params.task || '',
    params.subtask || '',
    params.extra || '',
    timestamp
  );

  const notification = {
    id,
    type: params.type,
    actor: params.actor,
    target: params.target,
    message: params.message,
    project: params.project || '',
    task: params.task || '',
    subtask: params.subtask || '',
    extra: params.extra || '',
    timestamp,
    dismissed: false,
    readBy: [] as string[],
  };

  broadcastWs({
    type: 'notification:created',
    notification,
  });

  return notification;
}

function computeUserPerformance(username: string) {
  const rows = db.prepare(`SELECT * FROM sessions WHERE username = ?`).all(username) as any[];
  const daysMap = new Map<string, { workHours: number; breakMinutes: number; onTime: boolean }>();

  let totalWorkHrs = 0;
  let totalBreakMin = 0;

  for (const r of rows) {
    const hrs = Number(r.workHours || 0);
    const brk = Number(r.breakMinutes || 0);
    totalWorkHrs += hrs;
    totalBreakMin += brk;
    const prev = daysMap.get(r.date) || { workHours: 0, breakMinutes: 0, onTime: r.punctuality !== 'Late' };
    prev.workHours += hrs;
    prev.breakMinutes += brk;
    daysMap.set(r.date, prev);
  }

  const totalDays = daysMap.size;
  let onTimeDays = 0;
  let lateDays = 0;
  daysMap.forEach((v) => {
    if (v.onTime) onTimeDays++;
    else lateDays++;
  });

  const punctuality = totalDays > 0 ? Math.round((onTimeDays / totalDays) * 100) : 100;
  const avgWorkHrs = totalDays > 0 ? Math.round((totalWorkHrs / totalDays) * 10) / 10 : 8.0;
  const rawProd = totalDays > 0 ? Math.min(100, Math.round((avgWorkHrs / STANDARD_WORKDAY_HOURS) * 100)) : 90;

  const qcMarkedRows = db.prepare(`SELECT errorCount FROM qc_logs WHERE employee = ?`).all(username) as { errorCount: number }[];
  const qcErrors = qcMarkedRows.reduce((s, r) => s + Number(r.errorCount || 0), 0);
  const qcDeduction = Math.min(MAX_ERROR_PENALTY, qcErrors * POINTS_PER_ERROR);

  const qcReviewed = (db.prepare(`SELECT COUNT(*) as c FROM qc_logs WHERE reviewer = ?`).get(username) as { c: number }).c;
  const qcPoints = qcReviewed - qcErrors * POINTS_PER_ERROR;

  const productivity = Math.max(0, rawProd - qcDeduction);
  const total = Math.round(punctuality * PUNCTUALITY_WEIGHT + productivity * PRODUCTIVITY_WEIGHT);

  return {
    punctuality,
    productivity,
    total,
    avgWorkHrs,
    totalWorkHrs: Math.round(totalWorkHrs * 10) / 10,
    totalBreakMin,
    onTimeDays,
    lateDays,
    totalDays,
    qcErrors,
    qcReviewed,
    qcPoints,
  };
}

function getMyQcErrors(username: string) {
  const rows = db.prepare(`SELECT * FROM qc_logs WHERE employee = ? ORDER BY id DESC`).all(username) as any[];
  let totalDeduction = 0;
  const errors = rows.map((r) => {
    const pts = Number(r.errorCount || 0) * POINTS_PER_ERROR;
    totalDeduction += pts;
    return {
      id: r.id,
      timestamp: r.timestamp,
      reviewer: r.reviewer,
      project: r.project,
      discipline: r.discipline,
      workType: r.workType,
      subtask: r.subtask,
      errorCount: r.errorCount,
      pointsDeducted: pts,
      comment: r.comment,
    };
  });
  return {
    errors,
    totalDeduction: Math.min(MAX_ERROR_PENALTY, totalDeduction),
  };
}

// ============================================================================
// START EXPRESS + VITE + WEBSOCKET SERVER
// ============================================================================
async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '25mb' }));

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const client: WsClient = { ws, username: '', role: '' };
    wsClients.add(client);

    ws.send(
      JSON.stringify({
        type: 'presence:updated',
        presence: getPresenceArray(),
      })
    );

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'auth' || msg.type === 'IDENTIFY') {
          client.username = String(msg.username || msg.userName || '').trim();
          client.role = String(msg.role || '').trim();
          broadcastPresence();
        }
      } catch {
        // ignore
      }
    });

    ws.on('close', () => {
      wsClients.delete(client);
      broadcastPresence();
    });
  });

  // 1. Employees list & Auth
  app.get('/api/employees', (_req, res) => {
    res.json({ employees: getEmployeesList() });
  });

  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const row = db
      .prepare(`SELECT * FROM users WHERE TRIM(username) = TRIM(?) AND TRIM(password) = TRIM(?)`)
      .get(String(username || ''), String(password || '')) as any;
    if (!row) {
      return res.json({
        success: false,
        message: 'Invalid employee name or security PIN. (Demo PIN: 1234)',
      });
    }
    const user = {
      username: row.username,
      role: row.role,
      joiningDate: row.joiningDate || '',
      emergencyContact: row.emergencyContact || '',
      address: row.address || '',
      weekOff: row.weekOff || 'Sunday',
      altSatOff: Boolean(row.altSatOff),
      photo: row.photo || '',
      dailyFocus: row.dailyFocus || '',
      dailyFocusDate: row.dailyFocusDate || '',
      dailyFocusProject: row.dailyFocusProject || '',
      employmentStatus: row.employmentStatus || 'Active',
      reportsTo: row.reportsTo || 'Rebecca Mary',
      hourlySalary: Number(row.hourlySalary ?? 45),
      lunchBreakStart: row.lunchBreakStart || '13:00',
      lunchBreakEnd: row.lunchBreakEnd || '13:45',
      teaBreakStart: row.teaBreakStart || '17:00',
      teaBreakEnd: row.teaBreakEnd || '17:15',
      autoBreakEnabled: row.autoBreakEnabled === undefined ? true : Boolean(row.autoBreakEnabled),
    };
    res.json({ success: true, user });
  });

  // 2. Bootstrap Full Workspace State
  app.get('/api/bootstrap', (req, res) => {
    const username = String(req.query.username || '');
    const employees = getEmployeesList();
    const presence = getPresenceArray();

    const activeRow = db.prepare(`SELECT * FROM active_sessions WHERE username = ?`).get(username) as any;
    const activeSession = activeRow
      ? {
          username: activeRow.username,
          role: activeRow.role,
          project: activeRow.project,
          task: activeRow.task,
          subtask: activeRow.subtask,
          startStatus: activeRow.startStatus,
          priority: activeRow.priority || 'Medium',
          comment: activeRow.comment || '',
          status: activeRow.status as 'running' | 'on_break',
          startTimeMs: Number(activeRow.startTimeMs),
          startDisplay: activeRow.startDisplay,
          breakTotalSec: Number(activeRow.breakTotalSec || 0),
          currentBreakStartMs: activeRow.currentBreakStartMs ? Number(activeRow.currentBreakStartMs) : null,
        }
      : null;

    const myPerformance = computeUserPerformance(username);
    const leaderboard = employees
      .map((e) => ({
        username: e.username,
        role: e.role,
        ...computeUserPerformance(e.username),
      }))
      .sort((a, b) => b.total - a.total);

    const mySessions = db.prepare(`SELECT * FROM sessions WHERE username = ? ORDER BY id DESC LIMIT 40`).all(username);
    const allSessions = db.prepare(`SELECT * FROM sessions ORDER BY id DESC LIMIT 200`).all();
    const qcRecent = db.prepare(`SELECT * FROM qc_logs ORDER BY id DESC LIMIT 50`).all();
    const myQcErrors = getMyQcErrors(username);

    const rawNotifs = db.prepare(`SELECT * FROM notifications WHERE dismissed = 0 ORDER BY rowid DESC LIMIT 60`).all() as any[];
    const notifications = rawNotifs.map((n) => ({
      id: n.id,
      type: n.type,
      actor: n.actor,
      target: n.target,
      message: n.message,
      project: n.project || '',
      task: n.task || '',
      subtask: n.subtask || '',
      extra: n.extra || '',
      timestamp: n.timestamp,
      dismissed: Boolean(n.dismissed),
      readBy: JSON.parse(n.readByJson || '[]'),
    }));

    const today = fmtDate();
    const startedTodaySet = new Set<string>();
    (db.prepare(`SELECT DISTINCT username FROM sessions WHERE date = ?`).all(today) as any[]).forEach((r) =>
      startedTodaySet.add(r.username)
    );
    (db.prepare(`SELECT DISTINCT username FROM active_sessions`).all() as any[]).forEach((r) =>
      startedTodaySet.add(r.username)
    );
    const notStarted = employees.filter(
      (e) =>
        !['Management', 'Founder', 'HR', 'Manager', 'Main Handover', 'Coordinator'].includes(e.role) &&
        e.employmentStatus === 'Active' &&
        !startedTodaySet.has(e.username)
    );
    const milestones = db.prepare(`SELECT * FROM project_milestones ORDER BY dueDate ASC`).all();
    const jobAssignments = db.prepare(`SELECT * FROM job_assignments ORDER BY rowid DESC`).all();

    res.json({
      employees,
      presence,
      activeSession,
      myPerformance,
      leaderboard,
      mySessions,
      allSessions,
      qcRecent,
      myQcErrors,
      notifications,
      notStarted,
      milestones,
      jobAssignments,
    });
  });

  // 2b. Project Milestones Endpoints
  app.post('/api/milestones/add', (req, res) => {
    const { project, milestoneName, discipline, dueDate, status, progress, lead, deliverable, priority, actor } = req.body;
    const id = `ms_${Date.now()}`;
    db.prepare(`
      INSERT INTO project_milestones (id, project, milestoneName, discipline, dueDate, status, progress, lead, deliverable, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      project,
      milestoneName,
      discipline || 'Mechanical',
      dueDate,
      status || 'In Progress',
      Number(progress ?? 25),
      lead || actor || 'Rebecca Mary',
      deliverable || 'LOD 350 Coordinated Deliverable',
      priority || 'High'
    );

    createAndBroadcastNotification({
      type: 'circular_posted',
      actor: actor || 'Management',
      target: 'ALL',
      message: `scheduled milestone "${milestoneName}" due ${dueDate}`,
      project,
      task: discipline,
      extra: `Lead: ${lead} · Priority: ${priority}`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true, id });
  });

  app.post('/api/milestones/update', (req, res) => {
    const { id, progress, status, dueDate, actor } = req.body;
    const row = db.prepare(`SELECT * FROM project_milestones WHERE id = ?`).get(id) as any;
    if (!row) return res.json({ success: false });

    db.prepare(`UPDATE project_milestones SET progress = ?, status = ?, dueDate = ? WHERE id = ?`).run(
      Number(progress ?? row.progress),
      status || row.status,
      dueDate || row.dueDate,
      id
    );

    createAndBroadcastNotification({
      type: 'session_end',
      actor: actor || row.lead,
      target: 'ALL',
      message: `updated milestone "${row.milestoneName}" to ${progress}% (${status})`,
      project: row.project,
      task: row.discipline,
      extra: `Target Due: ${dueDate || row.dueDate}`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/milestones/delete', (req, res) => {
    const { id } = req.body;
    db.prepare(`DELETE FROM project_milestones WHERE id = ?`).run(id);
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // 3. Synchronized Time Tracker Controls
  app.post('/api/session/start', (req, res) => {
    const { username, role, project, task, subtask, startStatus, priority, comment } = req.body;
    const sessionPriority = priority || 'Medium';
    const now = new Date();
    const startDisplay = now.toTimeString().slice(0, 8);
    const startTimeMs = now.getTime();

    // Check if this is the user's first daily session (0 completed sessions logged today)
    const todayStr = fmtDate(now);
    const completedTodayCount = (
      db
        .prepare(`SELECT COUNT(*) as c FROM sessions WHERE username = ? AND date = ?`)
        .get(username, todayStr) as { c: number }
    ).c;
    const isFirstDailySession = completedTodayCount === 0;

    db.prepare(`
      INSERT OR REPLACE INTO active_sessions (username, role, project, task, subtask, startStatus, priority, comment, status, startTimeMs, startDisplay, breakTotalSec, currentBreakStartMs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running', ?, ?, 0, NULL)
    `).run(username, role || 'Production', project, task, subtask, startStatus, sessionPriority, comment || '', startTimeMs, startDisplay);

    const activeSession = {
      username,
      role: role || 'Production',
      project,
      task,
      subtask,
      startStatus,
      priority: sessionPriority,
      comment: comment || '',
      status: 'running' as const,
      startTimeMs,
      startDisplay,
      breakTotalSec: 0,
      currentBreakStartMs: null,
    };

    createAndBroadcastNotification({
      type: 'session_start',
      actor: username,
      target: 'ALL',
      message: `started [${sessionPriority}] priority timer on ${project} (${task} / ${subtask})`,
      project,
      task,
      subtask,
      extra: `Start: ${startStatus} · Priority: ${sessionPriority}`,
    });

    broadcastWs({ type: 'session:updated', username, activeSession });
    broadcastPresence();
    res.json({ success: true, activeSession, isFirstDailySession });
  });

  // 3b. Daily Huddle Primary Focus Endpoint
  app.post('/api/profile/daily-huddle', (req, res) => {
    const { username, dailyFocus, dailyFocusProject } = req.body;
    if (!username) {
      return res.json({ success: false, message: 'Missing username' });
    }
    const todayStr = fmtDate();
    const cleanFocus = String(dailyFocus || '').trim();
    const cleanProject = String(dailyFocusProject || '').trim();

    db.prepare(`
      UPDATE users
      SET dailyFocus = ?, dailyFocusDate = ?, dailyFocusProject = ?
      WHERE username = ?
    `).run(cleanFocus, todayStr, cleanProject, username);

    const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as any;
    const updatedUser = row
      ? {
          username: row.username,
          role: row.role,
          joiningDate: row.joiningDate || '',
          emergencyContact: row.emergencyContact || '',
          address: row.address || '',
          weekOff: row.weekOff || 'Sunday',
          altSatOff: Boolean(row.altSatOff),
          photo: row.photo || '',
          dailyFocus: row.dailyFocus || '',
          dailyFocusDate: row.dailyFocusDate || '',
          dailyFocusProject: row.dailyFocusProject || '',
        }
      : null;

    if (cleanFocus) {
      createAndBroadcastNotification({
        type: 'session_start',
        actor: username,
        target: 'ALL',
        message: `logged Daily Huddle Focus: "${cleanFocus}"`,
        project: cleanProject,
        extra: `Daily Huddle (${todayStr})`,
      });
    }

    broadcastPresence();
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true, user: updatedUser });
  });

  app.post('/api/session/priority', (req, res) => {
    const { username, priority } = req.body;
    const row = db.prepare(`SELECT * FROM active_sessions WHERE username = ?`).get(username) as any;
    if (!row) return res.json({ success: false, message: 'No active session' });

    const nextPriority = priority || 'Medium';
    db.prepare(`UPDATE active_sessions SET priority = ? WHERE username = ?`).run(nextPriority, username);

    const activeSession = {
      ...row,
      priority: nextPriority,
      status: row.status as 'running' | 'on_break',
      startTimeMs: Number(row.startTimeMs),
      breakTotalSec: Number(row.breakTotalSec || 0),
      currentBreakStartMs: row.currentBreakStartMs ? Number(row.currentBreakStartMs) : null,
    };

    broadcastWs({ type: 'session:updated', username, activeSession });
    broadcastPresence();
    res.json({ success: true, activeSession });
  });

  app.post('/api/session/break', (req, res) => {
    const { username } = req.body;
    const row = db.prepare(`SELECT * FROM active_sessions WHERE username = ?`).get(username) as any;
    if (!row) return res.json({ success: false, message: 'No active session' });

    const nowMs = Date.now();
    db.prepare(`UPDATE active_sessions SET status = 'on_break', currentBreakStartMs = ? WHERE username = ?`).run(nowMs, username);

    const activeSession = {
      ...row,
      priority: row.priority || 'Medium',
      status: 'on_break',
      startTimeMs: Number(row.startTimeMs),
      breakTotalSec: Number(row.breakTotalSec || 0),
      currentBreakStartMs: nowMs,
    };

    createAndBroadcastNotification({
      type: 'break_start',
      actor: username,
      target: 'ALL',
      message: `paused on break (${row.project})`,
      project: row.project,
      task: row.task,
      subtask: row.subtask,
    });

    broadcastWs({ type: 'session:updated', username, activeSession });
    broadcastPresence();
    res.json({ success: true, activeSession });
  });

  app.post('/api/session/resume', (req, res) => {
    const { username } = req.body;
    const row = db.prepare(`SELECT * FROM active_sessions WHERE username = ?`).get(username) as any;
    if (!row) return res.json({ success: false, message: 'No active session' });

    const nowMs = Date.now();
    const addedBreakSec = row.currentBreakStartMs ? Math.max(0, Math.floor((nowMs - Number(row.currentBreakStartMs)) / 1000)) : 0;
    const newBreakTotalSec = Number(row.breakTotalSec || 0) + addedBreakSec;

    db.prepare(`UPDATE active_sessions SET status = 'running', breakTotalSec = ?, currentBreakStartMs = NULL WHERE username = ?`).run(
      newBreakTotalSec,
      username
    );

    const activeSession = {
      ...row,
      priority: row.priority || 'Medium',
      status: 'running',
      startTimeMs: Number(row.startTimeMs),
      breakTotalSec: newBreakTotalSec,
      currentBreakStartMs: null,
    };

    createAndBroadcastNotification({
      type: 'break_end',
      actor: username,
      target: 'ALL',
      message: `resumed production work on ${row.project}`,
      project: row.project,
      task: row.task,
      subtask: row.subtask,
    });

    broadcastWs({ type: 'session:updated', username, activeSession });
    broadcastPresence();
    res.json({ success: true, activeSession });
  });

  app.post('/api/session/end', (req, res) => {
    const { username, endStatus, priority, comment } = req.body;
    const row = db.prepare(`SELECT * FROM active_sessions WHERE username = ?`).get(username) as any;
    if (!row) return res.json({ success: false, message: 'No active session' });

    const now = new Date();
    const nowMs = now.getTime();
    const totalElapsedSec = Math.max(1, Math.floor((nowMs - Number(row.startTimeMs)) / 1000));
    let totalBreakSec = Number(row.breakTotalSec || 0);
    if (row.status === 'on_break' && row.currentBreakStartMs) {
      totalBreakSec += Math.max(0, Math.floor((nowMs - Number(row.currentBreakStartMs)) / 1000));
    }
    const netWorkSec = Math.max(0, totalElapsedSec - totalBreakSec);
    const workHours = Math.max(0.1, Math.round((netWorkSec / 3600) * 100) / 100);
    const breakMinutes = Math.round(totalBreakSec / 60);

    const startClock = String(row.startDisplay).slice(0, 5);
    const endClock = fmtClockShort(now);
    const punctuality = startClock <= SHIFT_START ? 'On Time' : 'Late';
    const finalPriority = priority || row.priority || 'Medium';

    db.prepare(`
      INSERT INTO sessions (date, username, role, project, task, subtask, startTime, endTime, workHours, breakMinutes, startStatus, endStatus, priority, comment, punctuality)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fmtDate(now),
      username,
      row.role,
      row.project,
      row.task,
      row.subtask,
      startClock,
      endClock,
      workHours,
      breakMinutes,
      row.startStatus,
      endStatus,
      finalPriority,
      comment || row.comment || '',
      punctuality
    );

    db.prepare(`DELETE FROM active_sessions WHERE username = ?`).run(username);

    createAndBroadcastNotification({
      type: 'session_end',
      actor: username,
      target: 'ALL',
      message: `completed [${finalPriority}] session on ${row.project} (${row.startStatus} → ${endStatus})`,
      project: row.project,
      task: row.task,
      subtask: row.subtask,
      extra: `Net: ${workHours}h · Break: ${breakMinutes}m · Priority: ${finalPriority}`,
    });

    broadcastWs({ type: 'session:updated', username, activeSession: null });
    broadcastPresence();
    res.json({ success: true, workHours, breakMinutes, priority: finalPriority });
  });

  app.post('/api/session/update-comment', (req, res) => {
    const { sessionId, username, newComment } = req.body;
    const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as any;
    if (!row) return res.json({ success: false });
    db.prepare(`UPDATE sessions SET comment = ? WHERE id = ?`).run(String(newComment || ''), sessionId);

    createAndBroadcastNotification({
      type: 'comment_updated',
      actor: username,
      target: 'MANAGEMENT',
      message: `updated session deliverable notes for ${row.project} (${row.date})`,
      project: row.project,
      task: row.task,
      subtask: row.subtask,
      extra: String(newComment || ''),
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // 4. QC Error Submit & Employee Inspection
  app.post('/api/qc/submit', (req, res) => {
    const { reviewer, employee, project, discipline, workType, subtask, errorCount, comment } = req.body;
    const ts = fmtTimestamp();
    const errs = Number(errorCount || 0);

    db.prepare(`
      INSERT INTO qc_logs (timestamp, reviewer, employee, project, discipline, workType, subtask, errorCount, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ts, reviewer, employee, project, discipline, workType, subtask, errs, comment || '');

    createAndBroadcastNotification({
      type: 'qc_error',
      actor: reviewer,
      target: employee,
      message: `logged ${errs} QC error(s) on your ${discipline} deliverable (-${errs * POINTS_PER_ERROR} pts)`,
      project,
      task: workType,
      subtask,
      extra: comment || 'Inspect QC log for details',
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.get('/api/qc/employee-errors', (req, res) => {
    const username = String(req.query.username || '');
    res.json(getMyQcErrors(username));
  });

  app.post('/api/qc/bulk-review', (req, res) => {
    const { ids, actor } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: false, message: 'No QC logs selected' });
    }
    const reviewerName = String(actor || 'Management');
    const stmt = db.prepare(`UPDATE qc_logs SET status = 'Reviewed', reviewedBy = ? WHERE id = ?`);
    let updatedCount = 0;
    for (const id of ids) {
      const info = stmt.run(reviewerName, Number(id));
      updatedCount += info.changes;
    }

    createAndBroadcastNotification({
      type: 'session_end',
      actor: reviewerName,
      target: 'ALL',
      message: `marked ${ids.length} QC inspection log(s) as Reviewed`,
      extra: `Bulk QC Verification · ${updatedCount} record(s) updated`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true, updatedCount });
  });

  // 5. Notifications Actions
  app.post('/api/notifications/read-all', (req, res) => {
    const { username } = req.body;
    const rows = db.prepare(`SELECT id, readByJson FROM notifications WHERE dismissed = 0`).all() as any[];
    const upd = db.prepare(`UPDATE notifications SET readByJson = ? WHERE id = ?`);
    for (const r of rows) {
      const arr: string[] = JSON.parse(r.readByJson || '[]');
      if (!arr.includes(username)) {
        arr.push(username);
        upd.run(JSON.stringify(arr), r.id);
      }
    }
    res.json({ success: true });
  });

  app.post('/api/notifications/dismiss', (req, res) => {
    const { id } = req.body;
    db.prepare(`UPDATE notifications SET dismissed = 1 WHERE id = ?`).run(id);
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/notifications/test', (req, res) => {
    const { username, project } = req.body;
    const notif = createAndBroadcastNotification({
      type: 'qc_error',
      actor: username || 'System',
      target: 'ALL',
      message: `broadcasted a live multi-device notification check across all open sessions!`,
      project: project || 'MBS-IR2',
      task: 'Coordination',
      subtask: 'HVAC',
      extra: 'Real-Time WebSocket + Sound Chime Active',
    });
    res.json({ success: true, notification: notif });
  });

  // 6. Circulars & Posters
  app.get('/api/circulars', (_req, res) => {
    const rows = db.prepare(`SELECT * FROM circulars ORDER BY rowid DESC`).all() as any[];
    const circulars = rows.map((r) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      postedBy: r.postedBy,
      timestamp: r.timestamp,
      imageUrl: r.imageUrl || '',
      posterUrl: r.posterUrl || '',
      likes: JSON.parse(r.likesJson || '[]'),
      reactions: JSON.parse(r.reactionsJson || '{}'),
      comments: JSON.parse(r.commentsJson || '[]'),
    }));
    res.json({ circulars });
  });

  app.post('/api/circulars', (req, res) => {
    const { username, title, message, imageUrl, posterUrl } = req.body;
    const id = `circ_${Date.now()}`;
    const timestamp = fmtTimestamp();
    db.prepare(`
      INSERT INTO circulars (id, title, message, postedBy, timestamp, imageUrl, posterUrl, likesJson, reactionsJson, commentsJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '{}', '[]')
    `).run(id, title, message, username, timestamp, imageUrl || '', posterUrl || '');

    createAndBroadcastNotification({
      type: 'circular_posted',
      actor: username,
      target: 'ALL',
      message: `published a new company circular: "${title}"`,
      extra: message.slice(0, 80),
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/circulars/edit', (req, res) => {
    const { id, title, message, imageUrl, posterUrl } = req.body;
    db.prepare(`UPDATE circulars SET title = ?, message = ?, imageUrl = ?, posterUrl = ? WHERE id = ?`).run(
      title,
      message,
      imageUrl || '',
      posterUrl || '',
      id
    );
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/circulars/delete', (req, res) => {
    const { id } = req.body;
    db.prepare(`DELETE FROM circulars WHERE id = ?`).run(id);
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/circulars/react', (req, res) => {
    const { id, username, emoji } = req.body;
    const row = db.prepare(`SELECT reactionsJson FROM circulars WHERE id = ?`).get(id) as any;
    if (row) {
      const reactions = JSON.parse(row.reactionsJson || '{}');
      const list: string[] = reactions[emoji] || [];
      if (list.includes(username)) {
        reactions[emoji] = list.filter((u) => u !== username);
      } else {
        reactions[emoji] = [...list, username];
      }
      db.prepare(`UPDATE circulars SET reactionsJson = ? WHERE id = ?`).run(JSON.stringify(reactions), id);
      broadcastWs({ type: 'state:updated' });
    }
    res.json({ success: true });
  });

  app.post('/api/circulars/comment', (req, res) => {
    const { id, username, comment } = req.body;
    const row = db.prepare(`SELECT commentsJson FROM circulars WHERE id = ?`).get(id) as any;
    if (row) {
      const comments = JSON.parse(row.commentsJson || '[]');
      comments.push({
        id: `cm_${Date.now()}`,
        username,
        comment,
        timestamp: fmtClockShort(),
      });
      db.prepare(`UPDATE circulars SET commentsJson = ? WHERE id = ?`).run(JSON.stringify(comments), id);
      broadcastWs({ type: 'state:updated' });
    }
    res.json({ success: true });
  });

  // 7. Calendar, Holidays, Leave & Permission
  app.get('/api/calendar', (req, res) => {
    const username = String(req.query.username || '');
    const holidays = db.prepare(`SELECT * FROM holidays ORDER BY date ASC`).all();
    const leaves = db.prepare(`SELECT * FROM leaves WHERE username = ? ORDER BY date DESC`).all(username);
    const permissions = db.prepare(`SELECT * FROM permissions WHERE username = ? ORDER BY date DESC`).all(username);

    const sessionRows = db.prepare(`SELECT date, workHours FROM sessions WHERE username = ?`).all(username) as any[];
    const workDays: Record<string, number> = {};
    for (const s of sessionRows) {
      workDays[s.date] = (workDays[s.date] || 0) + Number(s.workHours || 0);
    }

    const userRow = db.prepare(`SELECT weekOff, altSatOff FROM users WHERE username = ?`).get(username) as any;
    res.json({
      holidays,
      leaves,
      permissions,
      workDays,
      weekOff: userRow?.weekOff || 'Sunday',
      altSatOff: Boolean(userRow?.altSatOff),
    });
  });

  app.post('/api/holidays/add', (req, res) => {
    const { date, name, addedBy } = req.body;
    db.prepare(`INSERT INTO holidays (id, date, name, addedBy) VALUES (?, ?, ?, ?)`).run(
      `hol_${Date.now()}`,
      date,
      name,
      addedBy
    );
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/leaves/apply', (req, res) => {
    const { username, date, leaveType, reason } = req.body;
    db.prepare(`
      INSERT INTO leaves (id, username, date, leaveType, reason, status, appliedAt)
      VALUES (?, ?, ?, ?, ?, 'Pending', ?)
    `).run(`lv_${Date.now()}`, username, date, leaveType, reason, fmtTimestamp());

    createAndBroadcastNotification({
      type: 'leave_request',
      actor: username,
      target: 'MANAGEMENT',
      message: `applied for ${leaveType} on ${date}`,
      extra: reason,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/permissions/apply', (req, res) => {
    const { username, date, fromTime, toTime, reason } = req.body;
    db.prepare(`
      INSERT INTO permissions (id, username, date, fromTime, toTime, reason, status, appliedAt)
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)
    `).run(`pm_${Date.now()}`, username, date, fromTime, toTime, reason, fmtTimestamp());

    createAndBroadcastNotification({
      type: 'permission_request',
      actor: username,
      target: 'MANAGEMENT',
      message: `requested permission (${fromTime}–${toTime}) on ${date}`,
      extra: reason,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // 8. Project Dashboard & Drilldown
  app.get('/api/dashboard', (req, res) => {
    const fromDate = String(req.query.fromDate || '');
    const toDate = String(req.query.toDate || '');
    let rows = db.prepare(`SELECT * FROM sessions ORDER BY id DESC`).all() as any[];

    if (fromDate) rows = rows.filter((r) => r.date >= fromDate);
    if (toDate) rows = rows.filter((r) => r.date <= toDate);

    let totalWorkHours = 0;
    let totalBreakMinutes = 0;
    const empSet = new Set<string>();
    const projMap = new Map<string, { workHours: number; breakMinutes: number; sessions: number; employees: Set<string> }>();
    const employeesByProject: Record<string, Record<string, { username: string; role: string; workHours: number; breakMinutes: number; sessions: number }>> = {};
    const sessionsByProjectEmployee: Record<string, any[]> = {};

    for (const r of rows) {
      const wh = Number(r.workHours || 0);
      const bm = Number(r.breakMinutes || 0);
      totalWorkHours += wh;
      totalBreakMinutes += bm;
      empSet.add(r.username);

      const p = projMap.get(r.project) || { workHours: 0, breakMinutes: 0, sessions: 0, employees: new Set<string>() };
      p.workHours += wh;
      p.breakMinutes += bm;
      p.sessions += 1;
      p.employees.add(r.username);
      projMap.set(r.project, p);

      if (!employeesByProject[r.project]) employeesByProject[r.project] = {};
      if (!employeesByProject[r.project][r.username]) {
        employeesByProject[r.project][r.username] = {
          username: r.username,
          role: r.role,
          workHours: 0,
          breakMinutes: 0,
          sessions: 0,
        };
      }
      employeesByProject[r.project][r.username].workHours =
        Math.round((employeesByProject[r.project][r.username].workHours + wh) * 10) / 10;
      employeesByProject[r.project][r.username].breakMinutes += bm;
      employeesByProject[r.project][r.username].sessions += 1;

      const key = `${r.project}||${r.username}`;
      if (!sessionsByProjectEmployee[key]) sessionsByProjectEmployee[key] = [];
      sessionsByProjectEmployee[key].push(r);
    }

    const projects = Array.from(projMap.entries()).map(([project, d]) => ({
      project,
      workHours: Math.round(d.workHours * 10) / 10,
      breakMinutes: d.breakMinutes,
      sessions: d.sessions,
      employeeCount: d.employees.size,
    }));

    const formattedEmployeesByProject: Record<string, any[]> = {};
    for (const [proj, mapObj] of Object.entries(employeesByProject)) {
      formattedEmployeesByProject[proj] = Object.values(mapObj);
    }

    const rateRows = db.prepare(`SELECT role, hourlyRate, currency FROM role_rates`).all() as any[];
    const roleRates: Record<string, number> = { Management: 85, QC: 60, Production: 42 };
    let currency = 'USD';
    for (const r of rateRows) {
      roleRates[r.role] = Number(r.hourlyRate);
      if (r.currency) currency = r.currency;
    }

    const budgetRows = db.prepare(`SELECT project, allocatedBudget FROM project_budgets`).all() as any[];
    const projectBudgets: Record<string, number> = {};
    for (const b of budgetRows) {
      projectBudgets[b.project] = Number(b.allocatedBudget);
    }

    res.json({
      summary: {
        totalWorkHours: Math.round(totalWorkHours * 10) / 10,
        totalBreakMinutes,
        totalSessions: rows.length,
        totalEmployees: empSet.size,
        totalProjects: projects.length,
      },
      projects,
      employeesByProject: formattedEmployeesByProject,
      sessionsByProjectEmployee,
      roleRates,
      projectBudgets,
      currency,
    });
  });

  app.post('/api/financials/rates', (req, res) => {
    const { roleRates, currency, projectBudgets, actor } = req.body;
    if (roleRates && typeof roleRates === 'object') {
      const updRate = db.prepare(`INSERT OR REPLACE INTO role_rates (role, hourlyRate, currency) VALUES (?, ?, ?)`);
      for (const [role, rate] of Object.entries(roleRates)) {
        updRate.run(role, Number(rate), currency || 'USD');
      }
    }
    if (projectBudgets && typeof projectBudgets === 'object') {
      const updBudget = db.prepare(`INSERT OR REPLACE INTO project_budgets (project, allocatedBudget) VALUES (?, ?)`);
      for (const [proj, amt] of Object.entries(projectBudgets)) {
        updBudget.run(proj, Number(amt));
      }
    }

    createAndBroadcastNotification({
      type: 'circular_posted',
      actor: actor || 'Management',
      target: 'ALL',
      message: `updated Project Financial hourly role rates (${currency || 'USD'})`,
      extra: `Mgmt: ${roleRates?.Management ?? 85} · QC: ${roleRates?.QC ?? 60} · Prod: ${roleRates?.Production ?? 42}`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // 9. Chat & Group Messages
  app.get('/api/chat/users', (req, res) => {
    const username = String(req.query.username || '');
    const allUsers = getEmployeesList().filter((u) => u.username !== username);
    const allMsgs = db.prepare(`SELECT * FROM chat_messages ORDER BY rowid ASC`).all() as any[];

    const users = allUsers.map((u) => {
      const thread = allMsgs.filter(
        (m) =>
          !m.isGroup &&
          ((m.sender === username && m.receiver === u.username) ||
            (m.sender === u.username && m.receiver === username))
      );
      const last = thread[thread.length - 1];
      const unread = thread.filter(
        (m) => m.sender === u.username && !JSON.parse(m.readByJson || '[]').includes(username)
      ).length;
      return {
        ...u,
        lastMessage: last ? last.message || (last.photoUrl ? '📷 Photo / Sticker' : '') : '',
        unread,
      };
    });

    const rawGroups = db.prepare(`SELECT * FROM chat_groups`).all() as any[];
    const groups = rawGroups
      .map((g) => {
        const members: string[] = JSON.parse(g.membersJson || '[]');
        const thread = allMsgs.filter((m) => m.isGroup && m.receiver === g.groupId);
        const last = thread[thread.length - 1];
        const unread = thread.filter(
          (m) => m.sender !== username && !JSON.parse(m.readByJson || '[]').includes(username)
        ).length;
        return {
          groupId: g.groupId,
          groupName: g.groupName,
          members,
          lastMessage: last ? `${last.sender}: ${last.message || '📷 Media'}` : '',
          unread,
        };
      })
      .filter((g) => g.members.includes(username));

    res.json({ users, groups });
  });

  app.get('/api/chat/messages', (req, res) => {
    const username = String(req.query.username || '');
    const partner = String(req.query.partner || '');
    const isGroup = req.query.isGroup === 'true';

    let rows: any[] = [];
    if (isGroup) {
      rows = db.prepare(`SELECT * FROM chat_messages WHERE isGroup = 1 AND receiver = ? ORDER BY rowid ASC`).all(partner) as any[];
    } else {
      rows = db
        .prepare(
          `SELECT * FROM chat_messages WHERE isGroup = 0 AND ((sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)) ORDER BY rowid ASC`
        )
        .all(username, partner, partner, username) as any[];
    }

    const upd = db.prepare(`UPDATE chat_messages SET readByJson = ? WHERE id = ?`);
    for (const r of rows) {
      const readBy: string[] = JSON.parse(r.readByJson || '[]');
      if (!readBy.includes(username)) {
        readBy.push(username);
        upd.run(JSON.stringify(readBy), r.id);
      }
    }

    res.json({ messages: rows });
  });

  app.post('/api/chat/send', (req, res) => {
    const { sender, receiver, message, photoUrl, isGroup } = req.body;
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = fmtClockShort();
    db.prepare(`
      INSERT INTO chat_messages (id, sender, receiver, message, photoUrl, isGroup, timestamp, readByJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, sender, receiver, message || '', photoUrl || '', isGroup ? 1 : 0, timestamp, JSON.stringify([sender]));

    const msgObj = {
      id,
      sender,
      receiver,
      message: message || '',
      photoUrl: photoUrl || '',
      isGroup: Boolean(isGroup),
      timestamp,
    };

    createAndBroadcastNotification({
      type: 'chat_message',
      actor: sender,
      target: isGroup ? 'ALL' : receiver,
      message: `sent ${isGroup ? 'a group message' : 'you a message'}: "${(message || '📷 Media').slice(0, 50)}"`,
    });

    broadcastWs({ type: 'chat:message', message: msgObj });
    res.json({ success: true, message: msgObj });
  });

  app.post('/api/chat/groups/create', (req, res) => {
    const { groupName, creator, members } = req.body;
    const allMembers = Array.from(new Set([creator, ...(members || [])]));
    db.prepare(`INSERT INTO chat_groups (groupId, groupName, creator, membersJson, createdAt) VALUES (?, ?, ?, ?, ?)`).run(
      `grp_${Date.now()}`,
      groupName,
      creator,
      JSON.stringify(allMembers),
      fmtDate()
    );
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // 10. Memos & Warnings
  app.get('/api/memos', (req, res) => {
    const username = String(req.query.username || '');
    const myMemos = db.prepare(`SELECT * FROM memos WHERE employee = ? ORDER BY rowid DESC`).all(username);
    const allMemos = db.prepare(`SELECT * FROM memos ORDER BY rowid DESC`).all();
    res.json({ myMemos, allMemos });
  });

  app.post('/api/memos/send', (req, res) => {
    const { employee, type, subject, message, sentBy } = req.body;
    db.prepare(`
      INSERT INTO memos (id, employee, type, subject, message, sentBy, timestamp, reply, replyTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, '', '')
    `).run(`memo_${Date.now()}`, employee, type, subject, message, sentBy, fmtTimestamp());

    createAndBroadcastNotification({
      type: 'memo_issued',
      actor: sentBy,
      target: employee,
      message: `issued an official ${type}: "${subject}"`,
      extra: message.slice(0, 80),
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/memos/reply', (req, res) => {
    const { id, username, reply } = req.body;
    db.prepare(`UPDATE memos SET reply = ?, replyTime = ? WHERE id = ?`).run(reply, fmtTimestamp(), id);

    createAndBroadcastNotification({
      type: 'memo_reply',
      actor: username,
      target: 'MANAGEMENT',
      message: `replied to memo: "${reply.slice(0, 60)}"`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // 11. Profile & Management Settings
  app.post('/api/profile/photo', (req, res) => {
    const { username, photoDataUrl } = req.body;
    db.prepare(`UPDATE users SET photo = ? WHERE username = ?`).run(photoDataUrl, username);
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/profile/address', (req, res) => {
    const { username, address } = req.body;
    db.prepare(`UPDATE users SET address = ? WHERE username = ?`).run(address, username);
    res.json({ success: true });
  });

  app.post('/api/profile/password', (req, res) => {
    const { username, oldPass, newPass } = req.body;
    const row = db.prepare(`SELECT password FROM users WHERE username = ?`).get(username) as any;
    if (!row || row.password !== oldPass) {
      return res.json({ success: false, message: 'Incorrect current password.' });
    }
    db.prepare(`UPDATE users SET password = ? WHERE username = ?`).run(newPass, username);
    res.json({ success: true });
  });

  app.post('/api/profile/auto-break', (req, res) => {
    const {
      username,
      lunchBreakStart,
      lunchBreakEnd,
      teaBreakStart,
      teaBreakEnd,
      autoBreakEnabled,
    } = req.body;
    if (!username) return res.json({ success: false, message: 'Missing username' });

    db.prepare(`
      UPDATE users
      SET lunchBreakStart = ?,
          lunchBreakEnd = ?,
          teaBreakStart = ?,
          teaBreakEnd = ?,
          autoBreakEnabled = ?
      WHERE username = ?
    `).run(
      lunchBreakStart || '13:00',
      lunchBreakEnd || '13:45',
      teaBreakStart || '17:00',
      teaBreakEnd || '17:15',
      autoBreakEnabled ? 1 : 0,
      username
    );

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // Job Assignments Endpoints (Fixed Session Parameters by Main Handover, Coordinator, Manager, Founder, HR)
  app.post('/api/assignments/assign', (req, res) => {
    const {
      id,
      employee,
      project,
      task,
      subtask,
      priority,
      assignedBy,
      assignedByRole,
      notes,
    } = req.body;
    if (!employee || !project || !task || !subtask) {
      return res.json({
        success: false,
        message: 'Employee, Project Name, Task Type, and Subtask are required.',
      });
    }

    const jobId = id || `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const updatedAt = fmtTimestamp();

    db.prepare(`
      INSERT OR REPLACE INTO job_assignments (id, employee, project, task, subtask, priority, assignedBy, assignedByRole, notes, status, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Assigned', ?)
    `).run(
      jobId,
      employee,
      project,
      task,
      subtask,
      priority || 'Medium',
      assignedBy || 'Management',
      assignedByRole || 'Manager',
      notes || '',
      updatedAt
    );

    createAndBroadcastNotification({
      type: 'session_start',
      actor: `${assignedBy} (${assignedByRole || 'Manager'})`,
      target: employee,
      message: `assigned fixed job parameters: ${project} → ${task} / ${subtask}`,
      project,
      task,
      subtask,
      extra: notes ? `Note: ${notes}` : `Priority: ${priority || 'Medium'}`,
    });

    broadcastWs({ type: 'state:updated' });
    res.json({ success: true, id: jobId });
  });

  app.post('/api/assignments/delete', (req, res) => {
    const { id } = req.body;
    db.prepare(`DELETE FROM job_assignments WHERE id = ?`).run(id);
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/employees/add', (req, res) => {
    const {
      username,
      password,
      role,
      empCode,
      department,
      designation,
      shiftIn,
      workingHours,
      shiftOut,
      allSaturdaysOff,
      monthlySalary,
      uanNumber,
      workLocation,
      bankName,
      bankAccountNo,
      ifscCode,
      branchName,
      pfNumber,
      esicNumber,
      screenTimeHours,
      employmentStatus,
      reportsTo,
      hourlySalary,
      joiningDate,
    } = req.body;
    if (!username || !password) {
      return res.json({ success: false, message: 'Username and password are required.' });
    }
    const autoCode = empCode || String(1000 + Math.floor(Math.random() * 900));
    db.prepare(`
      INSERT OR REPLACE INTO users (
        username, password, role, empCode, department, designation,
        shiftIn, workingHours, shiftOut, allSaturdaysOff,
        monthlySalary, uanNumber, workLocation, bankName, bankAccountNo, ifscCode, branchName, pfNumber, esicNumber, screenTimeHours,
        joiningDate, weekOff, altSatOff, employmentStatus, reportsTo, hourlySalary,
        lunchBreakStart, lunchBreakEnd, teaBreakStart, teaBreakEnd, autoBreakEnabled
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Sunday', 1, ?, ?, ?, '13:00', '13:45', '17:00', '17:15', 1)
    `).run(
      username.trim(),
      password.trim(),
      role || 'Production',
      String(autoCode).trim(),
      department || 'MEP-BIM',
      designation || 'BIM MODELER-MECHANICAL',
      shiftIn || '9:00 AM',
      Number(workingHours ?? 9),
      shiftOut || '6:00 PM',
      allSaturdaysOff ? 1 : 0,
      Number(monthlySalary ?? 23500),
      uanNumber || '-',
      workLocation || 'BIM BYTES SOLUTIONS',
      bankName || '-',
      bankAccountNo || '-',
      ifscCode || '-',
      branchName || '-',
      pfNumber || '-',
      esicNumber || '-',
      Number(screenTimeHours ?? 160),
      joiningDate || fmtDate(),
      employmentStatus || 'Active',
      reportsTo || 'Rebecca Mary',
      Number(hourlySalary ?? 102)
    );
    broadcastPresence();
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/employees/update-details', (req, res) => {
    const {
      username,
      role,
      empCode,
      department,
      designation,
      shiftIn,
      workingHours,
      shiftOut,
      allSaturdaysOff,
      monthlySalary,
      uanNumber,
      workLocation,
      bankName,
      bankAccountNo,
      ifscCode,
      branchName,
      pfNumber,
      esicNumber,
      screenTimeHours,
      employmentStatus,
      reportsTo,
      hourlySalary,
      joiningDate,
      emergencyContact,
      weekOff,
      altSatOff,
    } = req.body;
    const existing = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as any;
    if (!existing) {
      return res.json({ success: false, message: 'Employee not found.' });
    }

    db.prepare(`
      UPDATE users
      SET role = ?,
          empCode = ?,
          department = ?,
          designation = ?,
          shiftIn = ?,
          workingHours = ?,
          shiftOut = ?,
          allSaturdaysOff = ?,
          monthlySalary = ?,
          uanNumber = ?,
          workLocation = ?,
          bankName = ?,
          bankAccountNo = ?,
          ifscCode = ?,
          branchName = ?,
          pfNumber = ?,
          esicNumber = ?,
          screenTimeHours = ?,
          employmentStatus = ?,
          reportsTo = ?,
          hourlySalary = ?,
          joiningDate = ?,
          emergencyContact = ?,
          weekOff = ?,
          altSatOff = ?
      WHERE username = ?
    `).run(
      role !== undefined ? role : existing.role || 'Production',
      empCode !== undefined ? String(empCode) : existing.empCode || '',
      department !== undefined ? department : existing.department || 'MEP-BIM',
      designation !== undefined ? designation : existing.designation || 'BIM MODELER-MECHANICAL',
      shiftIn !== undefined ? shiftIn : existing.shiftIn || '9:00 AM',
      workingHours !== undefined ? Number(workingHours) : Number(existing.workingHours ?? 9),
      shiftOut !== undefined ? shiftOut : existing.shiftOut || '6:00 PM',
      allSaturdaysOff !== undefined ? (allSaturdaysOff ? 1 : 0) : Number(existing.allSaturdaysOff ?? 0),
      monthlySalary !== undefined ? Number(monthlySalary) : Number(existing.monthlySalary ?? 23500),
      uanNumber !== undefined ? uanNumber : existing.uanNumber || '-',
      workLocation !== undefined ? workLocation : existing.workLocation || 'BIM BYTES SOLUTIONS',
      bankName !== undefined ? bankName : existing.bankName || '-',
      bankAccountNo !== undefined ? bankAccountNo : existing.bankAccountNo || '-',
      ifscCode !== undefined ? ifscCode : existing.ifscCode || '-',
      branchName !== undefined ? branchName : existing.branchName || '-',
      pfNumber !== undefined ? pfNumber : existing.pfNumber || '-',
      esicNumber !== undefined ? esicNumber : existing.esicNumber || '-',
      screenTimeHours !== undefined ? Number(screenTimeHours) : Number(existing.screenTimeHours ?? 156),
      employmentStatus || existing.employmentStatus || 'Active',
      reportsTo !== undefined ? reportsTo : existing.reportsTo || 'Rebecca Mary',
      hourlySalary !== undefined ? Number(hourlySalary) : Number(existing.hourlySalary ?? 102),
      joiningDate !== undefined ? joiningDate : existing.joiningDate || '',
      emergencyContact !== undefined ? emergencyContact : existing.emergencyContact || '',
      weekOff || existing.weekOff || 'Sunday',
      altSatOff !== undefined ? (altSatOff ? 1 : 0) : existing.altSatOff,
      username
    );

    if (employmentStatus && employmentStatus !== 'Active') {
      db.prepare(`DELETE FROM active_sessions WHERE username = ?`).run(username);
    }

    broadcastPresence();
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/employees/delete', (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ success: false, message: 'Missing username' });
    db.prepare(`DELETE FROM users WHERE username = ?`).run(username);
    db.prepare(`DELETE FROM active_sessions WHERE username = ?`).run(username);
    db.prepare(`DELETE FROM job_assignments WHERE employee = ?`).run(username);
    broadcastPresence();
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  app.post('/api/employees/remove-examples', (req, res) => {
    const { keepUsername } = req.body;
    const exampleNames = [
      'Arun Kumar',
      'Karthik S',
      'Priya Nair',
      'Vignesh R',
      'Deepak M',
      'Anitha V',
      'Surya Prakash',
    ].filter((n) => n !== keepUsername);

    const delUser = db.prepare(`DELETE FROM users WHERE username = ?`);
    const delAct = db.prepare(`DELETE FROM active_sessions WHERE username = ?`);
    const delAssign = db.prepare(`DELETE FROM job_assignments WHERE employee = ?`);
    for (const name of exampleNames) {
      delUser.run(name);
      delAct.run(name);
      delAssign.run(name);
    }

    broadcastPresence();
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true, removedCount: exampleNames.length });
  });

  app.post('/api/management/direct-leave-perm', (req, res) => {
    const { employee, actionType, date, leaveType, fromTime, toTime, reason, markedBy } = req.body;
    if (actionType === 'Leave') {
      db.prepare(`
        INSERT INTO leaves (id, username, date, leaveType, reason, status, appliedAt)
        VALUES (?, ?, ?, ?, ?, 'Approved', ?)
      `).run(`lv_${Date.now()}`, employee, date, leaveType || 'Casual Leave', reason || 'Marked by Management', fmtTimestamp());
      createAndBroadcastNotification({
        type: 'leave_status',
        actor: markedBy,
        target: employee,
        message: `marked Approved ${leaveType || 'Leave'} for ${date}`,
        extra: reason,
      });
    } else {
      db.prepare(`
        INSERT INTO permissions (id, username, date, fromTime, toTime, reason, status, appliedAt)
        VALUES (?, ?, ?, ?, ?, ?, 'Approved', ?)
      `).run(`pm_${Date.now()}`, employee, date, fromTime || '10:00', toTime || '12:00', reason || 'Marked by Management', fmtTimestamp());
      createAndBroadcastNotification({
        type: 'permission_status',
        actor: markedBy,
        target: employee,
        message: `marked Approved Permission (${fromTime}–${toTime}) for ${date}`,
        extra: reason,
      });
    }
    broadcastWs({ type: 'state:updated' });
    res.json({ success: true });
  });

  // Vite Dev Middleware or Static Production Build
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BIM Bytes Enterprise Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
