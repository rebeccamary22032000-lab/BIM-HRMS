export const SOA_URL = 'https://script.google.com/macros/s/AKfycbxp4KtZT6I8h3bNc6fJ-jV5fpuqSdF1BmlHLMq1nC8S7CAyyZ454OPvlhaWMcHJtXQ4_A/exec';

export const PROJECTS = [
  'CMRL',
  'TR-02',
  '5A(HSS)',
  'SPA RITZ AND ADDRESS',
  'MRO',
  'RSRM Hospital',
  'Chandighar Hospital',
  'Faena',
  'Oberoi',
  'HRM',
  'Cup Building',
  'Data Center',
  'Snow Park Waste Management',
  'Tanglin Shopping Center',
  'MBS-IR2',
  'Others',
  'Digital Marketing',
];

export const QC_PROJECTS = [
  'CMRL',
  'TR-02',
  '5A(HSS)',
  'SPA RITZ AND ADDRESS',
  'MRO',
  'RSRM Hospital',
  'Chandighar Hospital',
  'Faena',
  'Oberoi',
  'Cup Building',
  'Data Center',
  'Snow Park Waste Management',
  'Tanglin Shopping Center',
  'MBS-IR2',
  'Others',
  'Digital Marketing',
];

export const TASKS = [
  'Modeling',
  'Coordination',
  'Shop drawing',
  'Documentation',
  'Asbuild',
  'Comments update',
  'Rework',
  'Low Voltage',
  'Extra Low Voltage',
  'Others',
  'HRM',
  'Digital Marketing',
];

export const SUBTASKS = [
  'HVAC',
  'Fire Fighting',
  'Plumbing',
  'Gas System',
  'Asset Tagging',
  'Annotation',
  'Ceiling Lighting',
  'Floor Lighting',
  'Ground & Lightening Protection',
  'Mechanical Power',
  'Small Power',
  'Exterior Lighting',
  'Containment',
  'Security System',
  'Fire Alarm',
  'Audio - visual & public address',
  'ICT - Information & Communication Technology',
  'BMS - Building Management System',
  'GRMS - Guest Room Management System',
  'Others',
];

export const MECH_MAP: Record<string, string[]> = {
  'Modeling': ['HVAC', 'Fire Fighting', 'Plumbing', 'Gas System'],
  'Coordination': ['HVAC', 'Fire Fighting', 'Plumbing', 'Gas System'],
  'Shop drawing': ['HVAC', 'Fire Fighting', 'Plumbing', 'Gas System'],
  'Documentation': [],
  'Asbuild': ['Asset Tagging', 'Annotation'],
  'Comments update': [],
  'Rework': [],
  'Others': [],
};

export const ELEC_MAP: Record<string, string[]> = {
  'Low Voltage': [
    'Ceiling Lighting',
    'Floor Lighting',
    'Ground & Lightening Protection',
    'Mechanical Power',
    'Small Power',
    'Exterior Lighting',
    'Containment',
  ],
  'Extra Low Voltage': [
    'Security System',
    'Fire Alarm',
    'Audio - visual & public address',
    'ICT - Information & Communication Technology',
    'BMS - Building Management System',
    'GRMS - Guest Room Management System',
    'Containment',
  ],
  'Modeling': ['Low Voltage', 'Extra Low Voltage'],
  'Coordination': ['Low Voltage', 'Extra Low Voltage'],
  'Shop drawing': ['Low Voltage', 'Extra Low Voltage'],
  'Documentation': [],
  'Asbuild': ['Asset Tagging', 'Annotation'],
  'Comments update': [],
  'Rework': [],
  'Others': [],
};

export const CIRCULAR_EMOJIS = ['👍', '❤️', '🔥', '👏', '🎉', '😮'];

export const EMOJI_STICKER_SET = [
  '👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '😡',
  '🎉', '🥳', '👏', '🙏', '💯', '✅', '❌', '⭐',
  '🚀', '💪', '🤝', '👀', '🤔', '😎', '🤩', '🫡',
  '📌', '📢', '⚠️', '💡', '🏆', '🎯', '⏰', '📅',
  '📎', '📝', '💼', '🏗️', '🔧', '📐', '🖥️', '📊',
];

export type EmploymentStatus = 'Active' | 'Inactive' | 'Left' | 'Terminated';

export const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  'Active',
  'Inactive',
  'Left',
  'Terminated',
];

export const ASSIGNER_ROLES = [
  'Main Handover',
  'Coordinator',
  'Manager',
  'Founder',
  'HR',
  'Management',
] as const;

export const ALL_USER_ROLES = [
  'Founder',
  'HR',
  'Manager',
  'Main Handover',
  'Coordinator',
  'Management',
  'QC',
  'Production',
] as const;

export function isAssignerRole(role?: string): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return [
    'main handover',
    'coordinator',
    'manager',
    'founder',
    'hr',
    'management',
  ].includes(r);
}

export interface JobAssignment {
  id: number | string;
  employee: string;
  project: string;
  task: string;
  subtask: string;
  priority: PriorityLevel | string;
  assignedBy: string;
  assignedByRole: string;
  notes?: string;
  status: 'Assigned' | 'In Progress' | 'Completed' | string;
  updatedAt: string;
}

export interface User {
  username: string;
  role:
    | 'Founder'
    | 'HR'
    | 'Manager'
    | 'Main Handover'
    | 'Coordinator'
    | 'Management'
    | 'QC'
    | 'Production'
    | string;
  empCode?: string;
  department?: string;
  designation?: string;
  shiftIn?: string;
  workingHours?: number;
  shiftOut?: string;
  allSaturdaysOff?: boolean;
  monthlySalary?: number;
  uanNumber?: string;
  workLocation?: string;
  bankName?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  branchName?: string;
  pfNumber?: string;
  esicNumber?: string;
  screenTimeHours?: number;
  joiningDate?: string;
  emergencyContact?: string;
  address?: string;
  weekOff?: string;
  altSatOff?: boolean;
  photo?: string;
  dailyFocus?: string;
  dailyFocusDate?: string;
  dailyFocusProject?: string;
  employmentStatus?: EmploymentStatus | string;
  reportsTo?: string;
  hourlySalary?: number;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  teaBreakStart?: string;
  teaBreakEnd?: string;
  autoBreakEnabled?: boolean;
}

export interface AttendanceRulesConfig {
  graceMinutes: number;
  morningPermissionHours: number;
  lateLimitHours: number;
  eveningPermissionHours: number;
  firstHalfEarliestHours: number;
  firstHalfLatestHours: number;
  secondHalfLatestOutHours: number;
  totalWorkingDaysInMonth: number;
  longAbsentThresholdDays: number;
  firstSaturdayOffNumber: number;
  secondSaturdayOffNumber: number;
  minStayValidDayHours: number;
  totalPermissionAllowedDayHours: number;
  lateWindowAfterGraceMinutes: number;
}

export const DEFAULT_ATTENDANCE_RULES: AttendanceRulesConfig = {
  graceMinutes: 30,
  morningPermissionHours: 2,
  lateLimitHours: 4.5,
  eveningPermissionHours: 2,
  firstHalfEarliestHours: 4.5,
  firstHalfLatestHours: 5.5,
  secondHalfLatestOutHours: 5,
  totalWorkingDaysInMonth: 30,
  longAbsentThresholdDays: 14,
  firstSaturdayOffNumber: 2,
  secondSaturdayOffNumber: 4,
  minStayValidDayHours: 1,
  totalPermissionAllowedDayHours: 2,
  lateWindowAfterGraceMinutes: 60,
};

export interface NotificationItem {
  id: string;
  type:
    | 'session_start'
    | 'session_end'
    | 'break_start'
    | 'break_end'
    | 'qc_error'
    | 'leave_request'
    | 'leave_status'
    | 'permission_request'
    | 'permission_status'
    | 'memo_issued'
    | 'memo_reply'
    | 'circular_posted'
    | 'comment_updated'
    | 'chat_message'
    | string;
  actor: string;
  target: string;
  message: string;
  project?: string;
  task?: string;
  subtask?: string;
  extra?: string;
  timestamp: string;
  dismissed?: boolean;
  readBy?: string[];
}

export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent';

export const PRIORITY_LEVELS: PriorityLevel[] = ['Low', 'Medium', 'High', 'Urgent'];

export const PRIORITY_STYLE_MAP: Record<
  PriorityLevel,
  {
    label: string;
    dot: string;
    pillBorder: string;
    pillBg: string;
    pillText: string;
    badgeBg: string;
    activeBtn: string;
  }
> = {
  Low: {
    label: 'Low',
    dot: 'bg-sky-400',
    pillBorder: 'border-sky-500/50',
    pillBg: 'bg-sky-500/15',
    pillText: 'text-sky-200',
    badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    activeBtn: 'border-sky-400 bg-sky-500/20 text-sky-200 shadow-sm shadow-sky-950',
  },
  Medium: {
    label: 'Medium',
    dot: 'bg-emerald-400',
    pillBorder: 'border-emerald-500/50',
    pillBg: 'bg-emerald-500/15',
    pillText: 'text-emerald-200',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    activeBtn: 'border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow-sm shadow-emerald-950',
  },
  High: {
    label: 'High',
    dot: 'bg-amber-400',
    pillBorder: 'border-amber-500/60',
    pillBg: 'bg-amber-500/15',
    pillText: 'text-amber-200',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    activeBtn: 'border-amber-400 bg-amber-500/20 text-amber-200 shadow-sm shadow-amber-950',
  },
  Urgent: {
    label: 'Urgent',
    dot: 'bg-red-500',
    pillBorder: 'border-red-500/70',
    pillBg: 'bg-red-500/20',
    pillText: 'text-red-200',
    badgeBg: 'bg-red-500/25 text-red-200 border-red-500/50',
    activeBtn: 'border-red-500 bg-red-600/25 text-red-200 shadow-sm shadow-red-950',
  },
};

export interface ActiveSession {
  username: string;
  role: string;
  project: string;
  task: string;
  subtask: string;
  startStatus: string;
  priority?: PriorityLevel | string;
  comment?: string;
  status: 'running' | 'on_break';
  startTimeMs: number;
  startDisplay: string;
  breakTotalSec: number;
  currentBreakStartMs: number | null;
}

export interface PresenceItem {
  username: string;
  online: boolean;
  devices: number;
  dailyFocus?: string;
  dailyFocusDate?: string;
  dailyFocusProject?: string;
  session: {
    status: 'running' | 'on_break';
    project: string;
    task: string;
    subtask: string;
    priority?: PriorityLevel | string;
    startTimeMs: number;
    breakTotalSec: number;
    currentBreakStartMs: number | null;
  } | null;
}

export interface CircularReactionMap {
  [emoji: string]: string[];
}

export interface CircularComment {
  id: string;
  username: string;
  comment: string;
  timestamp: string;
}

export interface CircularItem {
  id: string;
  title: string;
  message: string;
  postedBy: string;
  timestamp: string;
  imageUrl?: string;
  posterUrl?: string;
  likes: string[];
  reactions: CircularReactionMap;
  comments: CircularComment[];
}

export interface PerformanceData {
  punctuality: number;
  productivity: number;
  total: number;
  avgWorkHrs: number;
  totalWorkHrs: number;
  totalBreakMin: number;
  onTimeDays: number;
  lateDays: number;
  totalDays: number;
  qcErrors: number;
  qcReviewed: number;
  qcPoints: number;
}

export interface ProjectMilestone {
  id: string;
  project: string;
  milestoneName: string;
  discipline: 'Mechanical' | 'Electrical' | 'Multi-Discipline' | string;
  dueDate: string;
  status: 'Upcoming' | 'In Progress' | 'QA Review' | 'Completed' | 'At Risk' | string;
  progress: number;
  lead: string;
  deliverable: string;
  priority: 'Critical' | 'High' | 'Medium' | string;
}

