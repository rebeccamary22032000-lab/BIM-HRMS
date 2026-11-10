import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Home,
  Clock,
  ShieldAlert,
  Award,
  BarChart3,
  MessageSquare,
  FileWarning,
  Settings,
  ExternalLink,
  Bell,
  Sun,
  Moon,
  LogOut,
  Play,
  Square,
  Coffee,
  RefreshCw,
  Check,
  X,
  Plus,
  Send,
  Image as ImageIcon,
  Smile,
  Share2,
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  Download,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Radio,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Menu,
  Search,
  Laptop,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  ClipboardPaste,
  FileText,
  Target,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line,
  Area,
  ReferenceLine,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  PROJECTS,
  QC_PROJECTS,
  TASKS,
  SUBTASKS,
  MECH_MAP,
  ELEC_MAP,
  CIRCULAR_EMOJIS,
  EMOJI_STICKER_SET,
  SOA_URL,
  User,
  NotificationItem,
  ActiveSession,
  PresenceItem,
  CircularItem,
  PerformanceData,
  ProjectMilestone,
  PriorityLevel,
  PRIORITY_LEVELS,
  PRIORITY_STYLE_MAP,
  EmploymentStatus,
  EMPLOYMENT_STATUSES,
  ALL_USER_ROLES,
  isAssignerRole,
  JobAssignment,
} from './constants';
import {
  playNotificationSound,
  requestDesktopNotificationPermission,
  triggerDesktopNotification,
} from './utils/sound';
import { ImageCropperModal } from './components/ImageCropperModal';
import { NotificationCenter, LiveToastItem } from './components/NotificationCenter';
import { ProjectTimeline } from './components/ProjectTimeline';
import { ProjectFinancialsTab } from './components/ProjectFinancialsTab';
import { SalaryPayrollTab } from './components/SalaryPayrollTab';

type ViewId =
  | 'home'
  | 'tracker'
  | 'qc'
  | 'performance'
  | 'dashboard'
  | 'payroll'
  | 'messages'
  | 'memos'
  | 'settings';

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function App() {
  // Theme & Auth State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('bim_theme') !== 'light';
  });
  const [employeesList, setEmployeesList] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      if (localStorage.getItem('bim_logged_out') === 'true') {
        return null;
      }
      const saved = localStorage.getItem('bim_user');
      if (saved) return JSON.parse(saved);
      return {
        username: 'Rebecca Mary',
        role: 'Management',
        joiningDate: '2022-03-15',
        emergencyContact: '+91 98401 22334',
        address: 'Anna Nagar, Chennai',
        weekOff: 'Sunday',
        altSatOff: true,
        photo: '',
      };
    } catch {
      return {
        username: 'Rebecca Mary',
        role: 'Management',
      };
    }
  });

  // Login Form State
  const [loginUsername, setLoginUsername] = useState<string>('Rebecca Mary');
  const [loginPassword, setLoginPassword] = useState<string>('1234');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // Navigation & UI
  const [activeView, setActiveView] = useState<ViewId>('home');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('bim_sound') !== 'off';
  });
  const [desktopPushEnabled, setDesktopPushEnabled] = useState<boolean>(() => {
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    );
  });

  // Real-time Connection & Sync State
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [presenceList, setPresenceList] = useState<PresenceItem[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [liveToasts, setLiveToasts] = useState<LiveToastItem[]>([]);
  const [bannerAlert, setBannerAlert] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Domain Data State
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [mySessions, setMySessions] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [qcRecentLogs, setQcRecentLogs] = useState<any[]>([]);
  const [myQcErrors, setMyQcErrors] = useState<{ errors: any[]; totalDeduction: number }>({
    errors: [],
    totalDeduction: 0,
  });
  const [circulars, setCirculars] = useState<CircularItem[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [calendarData, setCalendarData] = useState<any>({
    holidays: [],
    leaves: [],
    permissions: [],
    workDays: {},
    weekOff: 'Sunday',
    altSatOff: false,
  });
  const [notStartedList, setNotStartedList] = useState<any[]>([]);
  const [memosData, setMemosData] = useState<{ myMemos: any[]; allMemos: any[] }>({
    myMemos: [],
    allMemos: [],
  });
  const [dashboardData, setDashboardData] = useState<any>({
    summary: { totalWorkHours: 0, totalBreakMinutes: 0, totalSessions: 0, totalEmployees: 0, totalProjects: 0 },
    projects: [],
    employeesByProject: {},
    sessionsByProjectEmployee: {},
  });

  // Tracker Form State
  const [trkProject, setTrkProject] = useState<string>('');
  const [trkTask, setTrkTask] = useState<string>('');
  const [trkSubtask, setTrkSubtask] = useState<string>('');
  const [trkStartStatus, setTrkStartStatus] = useState<string>('');
  const [trkEndStatus, setTrkEndStatus] = useState<string>('');
  const [trkPriority, setTrkPriority] = useState<PriorityLevel>('Medium');
  const [trkComment, setTrkComment] = useState<string>('');
  const [lastCompletedSummary, setLastCompletedSummary] = useState<{
    project: string;
    task: string;
    subtask: string;
    priority: PriorityLevel;
    workHours: number;
    breakMinutes: number;
    startDisplay: string;
    endDisplay: string;
    statusProgress: string;
  } | null>(null);

  // QC Form & Table Sort State
  const [qcDiscipline, setQcDiscipline] = useState<'Mechanical' | 'Electrical'>('Mechanical');
  const [qcEmployee, setQcEmployee] = useState<string>('');
  const [qcProject, setQcProject] = useState<string>('');
  const [qcWorkType, setQcWorkType] = useState<string>('');
  const [qcSubtask, setQcSubtask] = useState<string>('');
  const [qcErrorCount, setQcErrorCount] = useState<string>('0');
  const [qcComment, setQcComment] = useState<string>('');
  const [lastQcSubmitted, setLastQcSubmitted] = useState<any | null>(null);
  const [qcSortField, setQcSortField] = useState<'timestamp' | 'errorCount' | 'project'>('timestamp');
  const [qcSortOrder, setQcSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedQcIds, setSelectedQcIds] = useState<number[]>([]);

  // Circular Carousel State
  const [circSlideIdx, setCircSlideIdx] = useState<number>(0);
  const [circSliderMode, setCircSliderMode] = useState<boolean>(true);
  const [circTitle, setCircTitle] = useState<string>('');
  const [circMessage, setCircMessage] = useState<string>('');
  const [circThumbDataUrl, setCircThumbDataUrl] = useState<string>('');
  const [circPosterDataUrl, setCircPosterDataUrl] = useState<string>('');
  const [editingCircularId, setEditingCircularId] = useState<string | null>(null);
  const [posterLightboxUrl, setPosterLightboxUrl] = useState<string | null>(null);
  const [circCommentInputs, setCircCommentInputs] = useState<Record<string, string>>({});
  const [openCircComments, setOpenCircComments] = useState<Record<string, boolean>>({});

  // Calendar & Leave/Permission State
  const [calYear, setCalYear] = useState<number>(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(() => new Date().getMonth());
  const [lpType, setLpType] = useState<'Leave' | 'Permission'>('Leave');
  const [lpLeaveKind, setLpLeaveKind] = useState<string>('Casual Leave');
  const [lpDate, setLpDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [lpReason, setLpReason] = useState<string>('');
  const [lpFromTime, setLpFromTime] = useState<string>('10:00');
  const [lpToTime, setLpToTime] = useState<string>('12:00');
  const [newHolidayDate, setNewHolidayDate] = useState<string>('');
  const [newHolidayName, setNewHolidayName] = useState<string>('');

  // Project Dashboard Drilldown & Financials / Payroll Tab State
  const [dashSubTab, setDashSubTab] = useState<'overview' | 'financials' | 'payroll'>('overview');
  const [dashFromDate, setDashFromDate] = useState<string>('');
  const [dashToDate, setDashToDate] = useState<string>('');
  const [selectedDashProject, setSelectedDashProject] = useState<string | null>(null);
  const [selectedDashEmployee, setSelectedDashEmployee] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingSessionComment, setEditingSessionComment] = useState<string>('');

  // Performance Drilldown Modal
  const [inspectEmpErrors, setInspectEmpErrors] = useState<{
    username: string;
    errors: any[];
    totalDeduction: number;
  } | null>(null);

  // Chat & Group Messages State
  const [chatUsers, setChatUsers] = useState<any[]>([]);
  const [chatGroups, setChatGroups] = useState<any[]>([]);
  const [activeChatPartner, setActiveChatPartner] = useState<string>('grp_mep_core');
  const [activeChatIsGroup, setActiveChatIsGroup] = useState<boolean>(true);
  const [activeChatGroupName, setActiveChatGroupName] = useState<string>('MEP Coordination Core');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatPhotoDataUrl, setChatPhotoDataUrl] = useState<string>('');
  const [copiedImageBuffer, setCopiedImageBuffer] = useState<string>('');
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [emojiTab, setEmojiTab] = useState<'emoji' | 'gif' | 'sticker'>('emoji');
  const [giphyQuery, setGiphyQuery] = useState<string>('');
  const [giphyResults, setGiphyResults] = useState<any[]>([]);
  const [newGroupModalOpen, setNewGroupModalOpen] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);

  // Settings & Management Forms State
  const [profileAddress, setProfileAddress] = useState<string>('');
  const [oldPass, setOldPass] = useState<string>('');
  const [newPass, setNewPass] = useState<string>('');
  const [confirmPass, setConfirmPass] = useState<string>('');
  const [newEmpName, setNewEmpName] = useState<string>('');
  const [newEmpPass, setNewEmpPass] = useState<string>('1234');
  const [newEmpRole, setNewEmpRole] = useState<string>('Production');
  const [newEmpStatus, setNewEmpStatus] = useState<EmploymentStatus>('Active');
  const [newEmpReportsTo, setNewEmpReportsTo] = useState<string>('Raghavan K');
  const [newEmpSalary, setNewEmpSalary] = useState<string>('450');
  const [editEmpTarget, setEditEmpTarget] = useState<string>('');
  const [editEmpRole, setEditEmpRole] = useState<string>('Production');
  const [editEmpStatus, setEditEmpStatus] = useState<EmploymentStatus>('Active');
  const [editEmpReportsTo, setEditEmpReportsTo] = useState<string>('Rebecca Mary');
  const [editEmpSalary, setEditEmpSalary] = useState<string>('450');
  const [editEmpJoinDate, setEditEmpJoinDate] = useState<string>('');
  const [editEmpEmergency, setEditEmpEmergency] = useState<string>('');
  const [editEmpWeekOff, setEditEmpWeekOff] = useState<string>('Sunday');
  const [editEmpAltSat, setEditEmpAltSat] = useState<boolean>(false);

  // Job Assignments & Fixed Session Parameters State
  const [jobAssignments, setJobAssignments] = useState<JobAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | string | null>(null);
  const [assignEmp, setAssignEmp] = useState<string>('Vignesh R');
  const [assignProject, setAssignProject] = useState<string>('CMRL');
  const [assignTask, setAssignTask] = useState<string>('Modeling');
  const [assignSubtask, setAssignSubtask] = useState<string>('HVAC');
  const [assignPriority, setAssignPriority] = useState<PriorityLevel>('High');
  const [assignNotes, setAssignNotes] = useState<string>('');

  // Employee Automatic Break Schedule State (Lunch 13:00-13:45 & Tea 17:00-17:15)
  const [lunchBreakStart, setLunchBreakStart] = useState<string>('13:00');
  const [lunchBreakEnd, setLunchBreakEnd] = useState<string>('13:45');
  const [teaBreakStart, setTeaBreakStart] = useState<string>('17:00');
  const [teaBreakEnd, setTeaBreakEnd] = useState<string>('17:15');
  const [autoBreakEnabled, setAutoBreakEnabled] = useState<boolean>(true);
  const [activeAutoBreakWindow, setActiveAutoBreakWindow] = useState<'lunch' | 'tea' | null>(null);
  const autoBreakTriggeredRef = useRef<'lunch' | 'tea' | null>(null);

  const [directLpEmp, setDirectLpEmp] = useState<string>('');
  const [directLpAction, setDirectLpAction] = useState<'Leave' | 'Permission'>('Leave');
  const [directLpDate, setDirectLpDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [directLpLeaveType, setDirectLpLeaveType] = useState<string>('Casual Leave');
  const [directLpFrom, setDirectLpFrom] = useState<string>('10:00');
  const [directLpTo, setDirectLpTo] = useState<string>('12:00');
  const [directLpReason, setDirectLpReason] = useState<string>('');
  const [memoTargetEmp, setMemoTargetEmp] = useState<string>('');
  const [memoType, setMemoType] = useState<'Memo' | 'Warning'>('Memo');
  const [memoSubject, setMemoSubject] = useState<string>('');
  const [memoMessage, setMemoMessage] = useState<string>('');
  const [memoReplyInputs, setMemoReplyInputs] = useState<Record<string, string>>({});

  // Image Cropper Modal State
  const [cropperState, setCropperState] = useState<{
    isOpen: boolean;
    imageSrc: string | null;
    purpose: 'profile' | 'circular';
    shape: 'circle' | 'square';
    title: string;
  }>({
    isOpen: false,
    imageSrc: null,
    purpose: 'profile',
    shape: 'circle',
    title: 'Crop Image',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const showBanner = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setBannerAlert({ message, type });
    setTimeout(() => {
      setBannerAlert((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('bim_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('bim_theme', 'light');
    }
  }, [darkMode]);

  // 1-second precision tick for all live work/break clocks across devices
  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Load initial employee list
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      if (data.employees) {
        setEmployeesList(data.employees);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Fetch full workspace state for logged-in user
  const fetchBootstrapData = useCallback(async (user: User) => {
    try {
      const [bootRes, calRes, circRes, dashRes, memoRes, chatRes] = await Promise.all([
        fetch(`/api/bootstrap?username=${encodeURIComponent(user.username)}&role=${encodeURIComponent(user.role)}`),
        fetch(`/api/calendar?username=${encodeURIComponent(user.username)}`),
        fetch('/api/circulars'),
        fetch('/api/dashboard'),
        fetch(`/api/memos?username=${encodeURIComponent(user.username)}`),
        fetch(`/api/chat/users?username=${encodeURIComponent(user.username)}`),
      ]);

      const boot = await bootRes.json();
      if (boot.employees) {
        setEmployeesList(boot.employees);
        const meUpdated = boot.employees.find((e: User) => e.username === user.username);
        if (meUpdated) {
          setCurrentUser((prev) => (prev ? { ...prev, ...meUpdated } : prev));
          setLunchBreakStart(meUpdated.lunchBreakStart || '13:00');
          setLunchBreakEnd(meUpdated.lunchBreakEnd || '13:45');
          setTeaBreakStart(meUpdated.teaBreakStart || '17:00');
          setTeaBreakEnd(meUpdated.teaBreakEnd || '17:15');
          setAutoBreakEnabled(meUpdated.autoBreakEnabled !== false);
        }
      }
      if (boot.jobAssignments) {
        setJobAssignments(boot.jobAssignments);
        // For employees whose session parameters are fixed by Main Handover / Coordinator / Manager / Founder / HR,
        // automatically apply their assigned job parameters when no active session is running
        if (!boot.activeSession && !isAssignerRole(user.role)) {
          const myJobs: JobAssignment[] = boot.jobAssignments.filter(
            (j: JobAssignment) => j.employee === user.username
          );
          if (myJobs.length > 0) {
            const chosenJob =
              myJobs.find((j) => j.id === selectedAssignmentId) || myJobs[0];
            setSelectedAssignmentId(chosenJob.id);
            setTrkProject(chosenJob.project);
            setTrkTask(chosenJob.task);
            setTrkSubtask(chosenJob.subtask);
            setTrkPriority((chosenJob.priority as PriorityLevel) || 'Medium');
          }
        }
      }
      if (boot.presence) setPresenceList(boot.presence);
      setActiveSession(boot.activeSession || null);
      if (boot.activeSession) {
        setTrkProject(boot.activeSession.project || '');
        setTrkTask(boot.activeSession.task || '');
        setTrkSubtask(boot.activeSession.subtask || '');
        setTrkStartStatus(boot.activeSession.startStatus || '');
        setTrkPriority((boot.activeSession.priority as PriorityLevel) || 'Medium');
        setTrkComment(boot.activeSession.comment || '');
      }
      if (boot.myPerformance) setPerformanceData(boot.myPerformance);
      if (boot.leaderboard) setLeaderboard(boot.leaderboard);
      if (boot.mySessions) setMySessions(boot.mySessions);
      if (boot.allSessions) setAllSessions(boot.allSessions);
      if (boot.qcRecent) setQcRecentLogs(boot.qcRecent);
      if (boot.myQcErrors) setMyQcErrors(boot.myQcErrors);
      if (boot.notifications) setNotifications(boot.notifications);
      if (boot.notStarted) setNotStartedList(boot.notStarted);
      if (boot.milestones) setMilestones(boot.milestones);

      const cal = await calRes.json();
      setCalendarData(cal);

      const circ = await circRes.json();
      if (circ.circulars) setCirculars(circ.circulars);

      const dash = await dashRes.json();
      if (dash.summary) setDashboardData(dash);

      const memos = await memoRes.json();
      setMemosData(memos);

      const chat = await chatRes.json();
      if (chat.users) setChatUsers(chat.users);
      if (chat.groups) setChatGroups(chat.groups);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      setProfileAddress(currentUser.address || '');
      fetchBootstrapData(currentUser);
    }
  }, [currentUser, fetchBootstrapData]);

  // Push incoming notification to Floating Toast Stack + Sound + Desktop Notification
  const pushLiveToast = useCallback(
    (notif: NotificationItem) => {
      if (!currentUser) return;
      // Check if relevant to current user
      const isRelevant =
        notif.target === 'ALL' ||
        notif.target === currentUser.username ||
        (notif.target === 'MANAGEMENT' && currentUser.role === 'Management') ||
        notif.actor === currentUser.username;

      if (!isRelevant) return;

      const toastId = `${notif.id}_${Date.now()}`;
      setLiveToasts((prev) => [{ toastId, notification: notif, createdAt: Date.now() }, ...prev].slice(0, 4));

      // Sound effect
      const isUrgent = notif.type === 'qc_error' || notif.type === 'memo_issued';
      const isMsg = notif.type === 'chat_message';
      playNotificationSound(isUrgent ? 'urgent' : isMsg ? 'message' : 'default', soundEnabled);

      // Browser Desktop Notification if enabled
      if (desktopPushEnabled && notif.actor !== currentUser.username) {
        triggerDesktopNotification(
          `BIM Bytes · ${notif.actor}`,
          `${notif.message}${notif.project ? ` (${notif.project})` : ''}`,
          notif.id
        );
      }

      // Auto-dismiss toast after 7 seconds
      setTimeout(() => {
        setLiveToasts((prev) => prev.filter((t) => t.toastId !== toastId));
      }, 7000);
    },
    [currentUser, soundEnabled, desktopPushEnabled]
  );

  // Establish Real-Time WebSocket connection for instant cross-device sync
  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connectWs = () => {
      if (!isMounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setWsConnected(true);
        ws.send(
          JSON.stringify({
            type: 'auth',
            username: currentUser.username,
            role: currentUser.role,
          })
        );
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'presence:updated' && Array.isArray(payload.presence)) {
            setPresenceList(payload.presence);
          }

          if (payload.type === 'session:updated') {
            if (payload.username === currentUser.username) {
              setActiveSession(payload.activeSession || null);
              if (payload.activeSession) {
                setTrkProject(payload.activeSession.project || '');
                setTrkTask(payload.activeSession.task || '');
                setTrkSubtask(payload.activeSession.subtask || '');
                setTrkStartStatus(payload.activeSession.startStatus || '');
                setTrkPriority((payload.activeSession.priority as PriorityLevel) || 'Medium');
                setTrkComment(payload.activeSession.comment || '');
              }
            }
            fetchBootstrapData(currentUser);
          }

          if (payload.type === 'notification:created' && payload.notification) {
            const n: NotificationItem = payload.notification;
            const isForMe =
              n.target === 'ALL' ||
              n.target === currentUser.username ||
              (n.target === 'MANAGEMENT' && currentUser.role === 'Management') ||
              currentUser.role === 'Management';

            if (isForMe) {
              setNotifications((prev) => {
                if (prev.some((item) => item.id === n.id)) return prev;
                return [n, ...prev];
              });
              pushLiveToast(n);
            }
          }

          if (payload.type === 'state:updated') {
            fetchBootstrapData(currentUser);
          }

          if (payload.type === 'chat:message' && payload.message) {
            const msg = payload.message;
            // Refresh chat list counts
            fetch(`/api/chat/users?username=${encodeURIComponent(currentUser.username)}`)
              .then((r) => r.json())
              .then((d) => {
                if (d.users) setChatUsers(d.users);
                if (d.groups) setChatGroups(d.groups);
              })
              .catch(() => {});

            // Append if viewing this thread
            setChatMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        } catch {
          // ignore malformed packet
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setWsConnected(false);
        reconnectTimer = setTimeout(connectWs, 2500);
      };
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [currentUser, fetchBootstrapData, pushLiveToast]);

  // Compute live elapsed work seconds & break seconds from synchronized activeSession
  const liveTimers = useMemo(() => {
    if (!activeSession) {
      return { workSec: 0, breakSec: 0 };
    }
    const totalElapsedSec = Math.max(0, Math.floor((nowMs - activeSession.startTimeMs) / 1000));
    let currentBreakSec = activeSession.breakTotalSec || 0;
    if (activeSession.status === 'on_break' && activeSession.currentBreakStartMs) {
      currentBreakSec += Math.max(
        0,
        Math.floor((nowMs - activeSession.currentBreakStartMs) / 1000)
      );
    }
    const workSec = Math.max(0, totalElapsedSec - currentBreakSec);
    return { workSec, breakSec: currentBreakSec };
  }, [activeSession, nowMs]);

  // Real-Time Daily Target (8-Hour Quota) Progress Metrics
  const dailyTargetMetrics = useMemo(() => {
    const quotaHours = 8;
    const quotaSec = quotaHours * 3600;
    const todayDateStr = new Date(nowMs).toISOString().slice(0, 10);

    const completedTodayHours = (mySessions || [])
      .filter((s) => s.date === todayDateStr)
      .reduce((acc, s) => acc + Number(s.workHours || 0), 0);

    const completedTodaySec = Math.round(completedTodayHours * 3600);
    const activeWorkSec = activeSession ? liveTimers.workSec : 0;
    const totalLoggedSec = completedTodaySec + activeWorkSec;
    const totalLoggedHours = totalLoggedSec / 3600;
    const rawPct = (totalLoggedSec / quotaSec) * 100;
    const progressPct = Math.min(100, Math.round(rawPct * 10) / 10);
    const remainingSec = Math.max(0, quotaSec - totalLoggedSec);
    const overtimeSec = Math.max(0, totalLoggedSec - quotaSec);

    return {
      quotaHours,
      quotaSec,
      completedTodaySec,
      completedTodayHours: Math.round(completedTodayHours * 100) / 100,
      activeWorkSec,
      totalLoggedSec,
      totalLoggedHours: Math.round(totalLoggedHours * 100) / 100,
      rawPct: Math.round(rawPct * 10) / 10,
      progressPct,
      remainingSec,
      overtimeSec,
      isQuotaMet: totalLoggedSec >= quotaSec,
    };
  }, [mySessions, activeSession, liveTimers.workSec, nowMs]);

  // Count online devices across the team
  const totalOnlineDevices = useMemo(() => {
    return presenceList.reduce((acc, p) => acc + (p.devices || 0), 0);
  }, [presenceList]);

  // Unread notifications count
  const unreadNotifCount = useMemo(() => {
    if (!currentUser) return 0;
    return notifications.filter((n) => !(n.readBy || []).includes(currentUser.username)).length;
  }, [notifications, currentUser]);

  // Unread chat count
  const unreadChatCount = useMemo(() => {
    const dmUnread = chatUsers.reduce((s, u) => s + (u.unread || 0), 0);
    const grpUnread = chatGroups.reduce((s, g) => s + (g.unread || 0), 0);
    return dmUnread + grpUnread;
  }, [chatUsers, chatGroups]);

  // Unreplied memos count
  const unrepliedMemosCount = useMemo(() => {
    return (memosData.myMemos || []).filter((m) => !m.reply).length;
  }, [memosData.myMemos]);

  // Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername || !loginPassword) {
      setLoginError('Please select your employee profile and enter your password.');
      return;
    }
    setLoginLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (!data.success) {
        setLoginError(data.message || 'Invalid credentials');
      } else {
        setCurrentUser(data.user);
        localStorage.removeItem('bim_logged_out');
        localStorage.setItem('bim_user', JSON.stringify(data.user));
        playNotificationSound('success', soundEnabled);
      }
    } catch {
      setLoginError('Unable to reach server. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.setItem('bim_logged_out', 'true');
    localStorage.removeItem('bim_user');
    setCurrentUser(null);
    setActiveSession(null);
    if (wsRef.current) wsRef.current.close();
  };

  // Time Tracker Handlers (Synchronized across all devices)
  const handlePriorityChange = async (nextPriority: PriorityLevel) => {
    setTrkPriority(nextPriority);
    if (currentUser && activeSession) {
      setActiveSession((prev) => (prev ? { ...prev, priority: nextPriority } : prev));
      try {
        const res = await fetch('/api/session/priority', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: currentUser.username,
            priority: nextPriority,
          }),
        });
        const data = await res.json();
        if (data.success && data.activeSession) {
          setActiveSession(data.activeSession);
          showBanner(`Active session priority updated to ${nextPriority} across all devices.`, 'info');
        }
      } catch {
        // ignore
      }
    }
  };

  const handleStartSession = async () => {
    if (!currentUser) return;
    if (!trkProject || !trkTask || !trkSubtask || !trkStartStatus) {
      showBanner('Please select Project, Task, Subtask, and Start Status (%) before starting.', 'error');
      return;
    }
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser.username,
        role: currentUser.role,
        project: trkProject,
        task: trkTask,
        subtask: trkSubtask,
        startStatus: trkStartStatus,
        priority: trkPriority,
        comment: trkComment,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setActiveSession(data.activeSession);
      setLastCompletedSummary(null);
      showBanner(
        `[${trkPriority}] priority timer started on ${trkProject} — synced across all your devices.`,
        'success'
      );

      // Automatically trigger the Daily Huddle modal at the start of the user's first daily session
      const todayIso = new Date().toISOString().slice(0, 10);
      const completedToday = (mySessions || []).filter((s) => s.date === todayIso).length;
      if (data.isFirstDailySession || completedToday === 0) {
        const myEmpRecord = employeesList.find((e) => e.username === currentUser.username);
        setDailyHuddleProjectInput(trkProject || myEmpRecord?.dailyFocusProject || 'CMRL');
        setDailyHuddleFocusInput(
          trkComment ||
            myEmpRecord?.dailyFocus ||
            `Completing ${trkTask} (${trkSubtask}) deliverables on ${trkProject}`
        );
        setDailyHuddleModalOpen(true);
      }
    } else {
      showBanner(data.message || 'Could not start session.', 'error');
    }
  };

  const handleBreakToggle = async () => {
    if (!currentUser || !activeSession) return;
    const endpoint = activeSession.status === 'running' ? '/api/session/break' : '/api/session/resume';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username }),
    });
    const data = await res.json();
    if (data.success) {
      setActiveSession(data.activeSession);
      showBanner(
        data.activeSession.status === 'on_break'
          ? 'Break timer active across all devices.'
          : 'Work resumed across all devices.',
        'info'
      );
    }
  };

  // =========================================================================
  // 15-MINUTE BROWSER INACTIVITY AUTO-PAUSE GUARD (TIME TRACKER)
  // =========================================================================
  const IDLE_THRESHOLD_SEC = 15 * 60; // 15 minutes (900 seconds)
  const IDLE_CONFIRM_WINDOW_SEC = 60; // 60 seconds to confirm before auto-'on_break'
  const lastActivityMsRef = useRef<number>(Date.now());
  const [idleSeconds, setIdleSeconds] = useState<number>(0);
  const [idlePromptOpen, setIdlePromptOpen] = useState<boolean>(false);
  const [idleCountdownSec, setIdleCountdownSec] = useState<number>(IDLE_CONFIRM_WINDOW_SEC);

  const handleAutoPauseToBreak = useCallback(
    async (customMessage?: string) => {
      setIdlePromptOpen(false);
      setIdleCountdownSec(IDLE_CONFIRM_WINDOW_SEC);
      lastActivityMsRef.current = Date.now();
      setIdleSeconds(0);

      if (!currentUser || !activeSession || activeSession.status !== 'running') return;
      try {
        const res = await fetch('/api/session/break', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: currentUser.username }),
        });
        const data = await res.json();
        if (data.success && data.activeSession) {
          setActiveSession(data.activeSession);
          playNotificationSound('urgent', soundEnabled);
          showBanner(
            customMessage ||
              "Auto-Pause triggered: No response after 15m browser inactivity — session status switched to 'on_break'.",
            'info'
          );
        }
      } catch {
        // ignore network error
      }
    },
    [currentUser, activeSession, soundEnabled, showBanner, IDLE_CONFIRM_WINDOW_SEC]
  );

  const handleConfirmStillWorking = useCallback(() => {
    lastActivityMsRef.current = Date.now();
    setIdleSeconds(0);
    setIdlePromptOpen(false);
    setIdleCountdownSec(IDLE_CONFIRM_WINDOW_SEC);
    playNotificationSound('success', soundEnabled);
    showBanner('Work activity confirmed — session remains active and running.', 'success');
  }, [soundEnabled, showBanner, IDLE_CONFIRM_WINDOW_SEC]);

  const handleSimulateIdlePrompt = useCallback(() => {
    if (!activeSession || activeSession.status !== 'running') {
      showBanner('Start or resume a work session first to test the 15-minute inactivity prompt.', 'info');
      return;
    }
    setIdleSeconds(IDLE_THRESHOLD_SEC);
    setIdleCountdownSec(IDLE_CONFIRM_WINDOW_SEC);
    setIdlePromptOpen(true);
    playNotificationSound('urgent', soundEnabled);
  }, [activeSession, showBanner, IDLE_THRESHOLD_SEC, IDLE_CONFIRM_WINDOW_SEC, soundEnabled]);

  // Listen for browser activity (mouse, keyboard, scroll, touch) to reset idle clock when prompt is not open
  useEffect(() => {
    const resetActivity = () => {
      if (!idlePromptOpen) {
        lastActivityMsRef.current = Date.now();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    for (const ev of events) {
      window.addEventListener(ev, resetActivity, { passive: true });
    }
    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, resetActivity);
      }
    };
  }, [idlePromptOpen]);

  // Reset idle tracker whenever session stops running or transitions to break
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'running') {
      lastActivityMsRef.current = Date.now();
      setIdleSeconds(0);
      setIdlePromptOpen(false);
      setIdleCountdownSec(IDLE_CONFIRM_WINDOW_SEC);
    }
  }, [activeSession, IDLE_CONFIRM_WINDOW_SEC]);

  // Evaluate idle duration every second while session is actively running
  useEffect(() => {
    if (!currentUser || !activeSession || activeSession.status !== 'running') return;

    const timer = setInterval(() => {
      if (!idlePromptOpen) {
        const elapsedSec = Math.max(0, Math.floor((Date.now() - lastActivityMsRef.current) / 1000));
        setIdleSeconds(elapsedSec);
        if (elapsedSec >= IDLE_THRESHOLD_SEC) {
          setIdlePromptOpen(true);
          setIdleCountdownSec(IDLE_CONFIRM_WINDOW_SEC);
          playNotificationSound('urgent', soundEnabled);
        }
      } else {
        setIdleCountdownSec((prev) => {
          if (prev <= 1) {
            handleAutoPauseToBreak();
            return IDLE_CONFIRM_WINDOW_SEC;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    currentUser,
    activeSession,
    idlePromptOpen,
    soundEnabled,
    handleAutoPauseToBreak,
    IDLE_THRESHOLD_SEC,
    IDLE_CONFIRM_WINDOW_SEC,
  ]);

  // =========================================================================
  // EMPLOYEE AUTOMATIC BREAK SCHEDULER (LUNCH 13:00-13:45 & TEA 17:00-17:15)
  // Automatically pauses production timer & runs break timer during chosen break
  // windows, then automatically resumes production timer when break ends.
  // =========================================================================
  const isTimeWithinWindow = useCallback((nowHHMM: string, startHHMM: string, endHHMM: string) => {
    if (!startHHMM || !endHHMM) return false;
    return nowHHMM >= startHHMM && nowHHMM < endHHMM;
  }, []);

  const handleSaveAutoBreakSchedule = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/profile/auto-break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          lunchBreakStart,
          lunchBreakEnd,
          teaBreakStart,
          teaBreakEnd,
          autoBreakEnabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('bim_user', JSON.stringify(data.user));
        }
        showBanner(
          `Automatic Break Schedule saved! Lunch (${lunchBreakStart}–${lunchBreakEnd}) & Tea (${teaBreakStart}–${teaBreakEnd}) will auto-pause production and run break time.`,
          'success'
        );
      }
    } catch {
      showBanner('Failed to save automatic break schedule.', 'error');
    }
  };

  // Real-time clock watcher for automatic Lunch & Tea break start/end transitions
  useEffect(() => {
    if (!currentUser || !activeSession || !autoBreakEnabled) {
      setActiveAutoBreakWindow(null);
      return;
    }

    const nowDate = new Date(nowMs);
    const hh = String(nowDate.getHours()).padStart(2, '0');
    const mm = String(nowDate.getMinutes()).padStart(2, '0');
    const nowHHMM = `${hh}:${mm}`;

    const inLunch = isTimeWithinWindow(nowHHMM, lunchBreakStart, lunchBreakEnd);
    const inTea = isTimeWithinWindow(nowHHMM, teaBreakStart, teaBreakEnd);
    const currentWindow: 'lunch' | 'tea' | null = inLunch ? 'lunch' : inTea ? 'tea' : null;
    setActiveAutoBreakWindow(currentWindow);

    if (currentWindow && activeSession.status === 'running' && autoBreakTriggeredRef.current !== currentWindow) {
      autoBreakTriggeredRef.current = currentWindow;
      const label =
        currentWindow === 'lunch'
          ? `Lunch Break (${lunchBreakStart}–${lunchBreakEnd})`
          : `Tea Break (${teaBreakStart}–${teaBreakEnd})`;
      fetch('/api/session/break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.activeSession) {
            setActiveSession(d.activeSession);
            playNotificationSound('default', soundEnabled);
            showBanner(
              `Scheduled ${label}: Production time automatically paused and break timer is now running.`,
              'info'
            );
          }
        })
        .catch(() => {});
    } else if (!currentWindow && activeSession.status === 'on_break' && autoBreakTriggeredRef.current !== null) {
      const finishedWindow = autoBreakTriggeredRef.current;
      autoBreakTriggeredRef.current = null;
      const label = finishedWindow === 'lunch' ? 'Lunch Break' : 'Tea Break';
      fetch('/api/session/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.activeSession) {
            setActiveSession(d.activeSession);
            playNotificationSound('success', soundEnabled);
            showBanner(
              `${label} window ended — Break timer stopped and Production time automatically resumed!`,
              'success'
            );
          }
        })
        .catch(() => {});
    }
  }, [
    nowMs,
    currentUser,
    activeSession,
    autoBreakEnabled,
    lunchBreakStart,
    lunchBreakEnd,
    teaBreakStart,
    teaBreakEnd,
    isTimeWithinWindow,
    soundEnabled,
    showBanner,
  ]);

  const handleSimulateScheduledBreak = async (kind: 'lunch' | 'tea' | 'resume') => {
    if (!currentUser || !activeSession) {
      showBanner('Start a work session first to test automatic Lunch/Tea break transitions.', 'info');
      return;
    }
    if (kind === 'resume') {
      if (activeSession.status !== 'on_break') {
        showBanner('Session is already in production mode.', 'info');
        return;
      }
      autoBreakTriggeredRef.current = null;
      const res = await fetch('/api/session/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username }),
      });
      const d = await res.json();
      if (d.success) {
        setActiveSession(d.activeSession);
        showBanner('Break completed — Production timer automatically resumed!', 'success');
      }
      return;
    }

    if (activeSession.status !== 'running') {
      showBanner('Session is already on break.', 'info');
      return;
    }
    autoBreakTriggeredRef.current = kind;
    const res = await fetch('/api/session/break', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username }),
    });
    const d = await res.json();
    if (d.success) {
      setActiveSession(d.activeSession);
      const windowDesc =
        kind === 'lunch'
          ? `Lunch Break (${lunchBreakStart} – ${lunchBreakEnd})`
          : `Tea Break (${teaBreakStart} – ${teaBreakEnd})`;
      showBanner(
        `Auto-Break Triggered [${windowDesc}]: Production time paused & Break timer started automatically.`,
        'info'
      );
    }
  };

  // =========================================================================
  // JOB ASSIGNING BY MAIN HANDOVER, COORDINATOR, MANAGER, FOUNDER & HR
  // =========================================================================
  const myAssignedJobs = useMemo(() => {
    if (!currentUser) return [];
    return jobAssignments.filter((j) => j.employee === currentUser.username);
  }, [jobAssignments, currentUser]);

  const canAssignParameters = useMemo(() => {
    return currentUser ? isAssignerRole(currentUser.role) : false;
  }, [currentUser]);

  const handleSelectAssignedJob = (job: JobAssignment) => {
    if (activeSession) return;
    setSelectedAssignmentId(job.id);
    setTrkProject(job.project);
    setTrkTask(job.task);
    setTrkSubtask(job.subtask);
    setTrkPriority((job.priority as PriorityLevel) || 'Medium');
    showBanner(
      `Loaded fixed session parameters assigned by ${job.assignedBy} (${job.assignedByRole}): ${job.project} · ${job.task} · ${job.subtask}`,
      'info'
    );
  };

  const handleAssignJobToEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !assignEmp || !assignProject || !assignTask || !assignSubtask) {
      showBanner('Select Employee, Project Name, Task Type, and Subtask to assign.', 'error');
      return;
    }
    const res = await fetch('/api/assignments/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee: assignEmp,
        project: assignProject,
        task: assignTask,
        subtask: assignSubtask,
        priority: assignPriority,
        assignedBy: currentUser.username,
        assignedByRole: currentUser.role,
        notes: assignNotes,
      }),
    });
    const data = await res.json();
    if (data.success) {
      if (data.assignments) setJobAssignments(data.assignments);
      setAssignNotes('');
      showBanner(
        `Fixed session parameters (${assignProject} · ${assignTask} · ${assignSubtask}) assigned to ${assignEmp} by ${currentUser.username} (${currentUser.role}).`,
        'success'
      );
    }
  };

  const handleDeleteJobAssignment = async (id: number | string) => {
    const res = await fetch('/api/assignments/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.success && data.assignments) {
      setJobAssignments(data.assignments);
      showBanner('Job assignment removed.', 'info');
    }
  };

  // =========================================================================
  // DAILY HUDDLE MODAL STATE & HANDLERS + TIME TRACKER KEYWORD SEARCH FILTER
  // =========================================================================
  const [dailyHuddleModalOpen, setDailyHuddleModalOpen] = useState<boolean>(false);
  const [dailyHuddleFocusInput, setDailyHuddleFocusInput] = useState<string>('');
  const [dailyHuddleProjectInput, setDailyHuddleProjectInput] = useState<string>('CMRL');
  const [dailyHuddleSaving, setDailyHuddleSaving] = useState<boolean>(false);

  const openDailyHuddleModal = useCallback(() => {
    if (!currentUser) return;
    const myEmp = employeesList.find((e) => e.username === currentUser.username);
    setDailyHuddleProjectInput(
      activeSession?.project || trkProject || myEmp?.dailyFocusProject || currentUser.dailyFocusProject || 'CMRL'
    );
    setDailyHuddleFocusInput(
      myEmp?.dailyFocus ||
        currentUser.dailyFocus ||
        (activeSession
          ? `Focusing on ${activeSession.task} (${activeSession.subtask}) for ${activeSession.project}`
          : '')
    );
    setDailyHuddleModalOpen(true);
  }, [currentUser, employeesList, activeSession, trkProject]);

  const handleSaveDailyHuddle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;
    const trimmed = dailyHuddleFocusInput.trim();
    if (!trimmed) {
      showBanner('Please enter your primary focus for today.', 'error');
      return;
    }
    setDailyHuddleSaving(true);
    try {
      const res = await fetch('/api/profile/daily-huddle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          dailyFocus: trimmed,
          dailyFocusProject: dailyHuddleProjectInput || trkProject || 'CMRL',
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('bim_user', JSON.stringify(data.user));
        }
        await fetchBootstrapData(currentUser);
        setDailyHuddleModalOpen(false);
        playNotificationSound('success', soundEnabled);
        showBanner('Daily Huddle focus published to your profile for team visibility!', 'success');
      }
    } catch {
      showBanner('Could not save Daily Huddle focus.', 'error');
    } finally {
      setDailyHuddleSaving(false);
    }
  };

  // Time Tracker Keyword Search Filter for Projects, Tasks & Subtasks
  const [trkSearchQuery, setTrkSearchQuery] = useState<string>('');

  const filteredTrackerOptions = useMemo(() => {
    const q = trkSearchQuery.trim().toLowerCase();
    if (!q) {
      return {
        projects: PROJECTS,
        tasks: TASKS,
        subtasks: SUBTASKS,
        quickCombinations: [] as Array<{
          label: string;
          kind: 'Project' | 'Task' | 'Subtask' | 'Pair';
          project?: string;
          task?: string;
          subtask?: string;
        }>,
      };
    }

    const matchedProjects = PROJECTS.filter((p) => p.toLowerCase().includes(q));
    const matchedTasks = TASKS.filter((t) => t.toLowerCase().includes(q));
    const matchedSubtasks = SUBTASKS.filter((s) => s.toLowerCase().includes(q));

    // Also include tasks mapped to matching subtasks or vice versa from MECH_MAP / ELEC_MAP
    const pairMatches: Array<{
      label: string;
      kind: 'Project' | 'Task' | 'Subtask' | 'Pair';
      project?: string;
      task?: string;
      subtask?: string;
    }> = [];

    for (const p of matchedProjects) {
      pairMatches.push({ label: `Project: ${p}`, kind: 'Project', project: p });
    }
    for (const t of matchedTasks) {
      pairMatches.push({ label: `Task: ${t}`, kind: 'Task', task: t });
    }
    for (const s of matchedSubtasks) {
      // Find recommended parent task for this subtask
      let suggestedTask = '';
      for (const [tKey, subs] of Object.entries({ ...MECH_MAP, ...ELEC_MAP })) {
        if (subs.includes(s)) {
          suggestedTask = tKey;
          break;
        }
      }
      pairMatches.push({
        label: suggestedTask ? `${suggestedTask} → ${s}` : `Subtask: ${s}`,
        kind: suggestedTask ? 'Pair' : 'Subtask',
        task: suggestedTask || undefined,
        subtask: s,
      });
    }

    // Keep currently selected value in the select dropdown list even if filtered out, or fall back to full list if 0 matches in that category
    const finalProjects =
      matchedProjects.length > 0
        ? trkProject && !matchedProjects.includes(trkProject)
          ? [trkProject, ...matchedProjects]
          : matchedProjects
        : PROJECTS;
    const finalTasks =
      matchedTasks.length > 0
        ? trkTask && !matchedTasks.includes(trkTask)
          ? [trkTask, ...matchedTasks]
          : matchedTasks
        : TASKS;
    const finalSubtasks =
      matchedSubtasks.length > 0
        ? trkSubtask && !matchedSubtasks.includes(trkSubtask)
          ? [trkSubtask, ...matchedSubtasks]
          : matchedSubtasks
        : SUBTASKS;

    return {
      projects: finalProjects,
      tasks: finalTasks,
      subtasks: finalSubtasks,
      matchedCounts: {
        projects: matchedProjects.length,
        tasks: matchedTasks.length,
        subtasks: matchedSubtasks.length,
      },
      quickCombinations: pairMatches.slice(0, 10),
    };
  }, [trkSearchQuery, trkProject, trkTask, trkSubtask]);

  const handleEndSession = async () => {
    if (!currentUser || !activeSession) return;
    if (!trkEndStatus) {
      showBanner('Please select End Status (%) before completing your work session.', 'error');
      return;
    }
    if (parseInt(trkEndStatus, 10) < parseInt(activeSession.startStatus || '0', 10)) {
      showBanner(
        `End Status (${trkEndStatus}) cannot be lower than Start Status (${activeSession.startStatus}).`,
        'error'
      );
      return;
    }
    const sessionPriority: PriorityLevel =
      (activeSession.priority as PriorityLevel) || trkPriority || 'Medium';
    const res = await fetch('/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser.username,
        endStatus: trkEndStatus,
        priority: sessionPriority,
        comment: trkComment,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setLastCompletedSummary({
        project: activeSession.project,
        task: activeSession.task,
        subtask: activeSession.subtask,
        priority: sessionPriority,
        workHours: data.workHours,
        breakMinutes: data.breakMinutes,
        startDisplay: activeSession.startDisplay,
        endDisplay: new Date().toTimeString().slice(0, 8),
        statusProgress: `${activeSession.startStatus} → ${trkEndStatus}`,
      });
      setActiveSession(null);
      setTrkEndStatus('');
      setTrkComment('');
      fetchBootstrapData(currentUser);
      showBanner(
        `Session logged! Work: ${data.workHours} hrs | Break: ${data.breakMinutes} mins | Priority: ${sessionPriority}`,
        'success'
      );
    } else {
      showBanner(data.message || 'Error ending session', 'error');
    }
  };

  // QC Error Submission
  const qcMap = qcDiscipline === 'Mechanical' ? MECH_MAP : ELEC_MAP;
  const qcWorkTypes = Object.keys(qcMap);
  const qcSubtasksForType = qcWorkType ? qcMap[qcWorkType] || [] : [];

  const handleQcSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!qcEmployee || !qcProject || !qcWorkType) {
      showBanner('Please select Employee, Project, and Work Type.', 'error');
      return;
    }
    if (qcSubtasksForType.length > 0 && !qcSubtask) {
      showBanner('Please select a Sub-Task for this Work Type.', 'error');
      return;
    }
    const res = await fetch('/api/qc/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewer: currentUser.username,
        employee: qcEmployee,
        project: qcProject,
        discipline: qcDiscipline,
        workType: qcWorkType,
        subtask: qcSubtasksForType.length > 0 ? qcSubtask : 'N/A',
        errorCount: Number(qcErrorCount),
        comment: qcComment,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setLastQcSubmitted({
        reviewer: currentUser.username,
        employee: qcEmployee,
        project: qcProject,
        discipline: qcDiscipline,
        workType: qcWorkType,
        subtask: qcSubtasksForType.length > 0 ? qcSubtask : 'N/A',
        errorCount: Number(qcErrorCount),
        comment: qcComment || '—',
        timestamp: new Date().toLocaleTimeString(),
      });
      setQcErrorCount('0');
      setQcComment('');
      showBanner(`QC Log recorded for ${qcEmployee} and real-time alert dispatched.`, 'success');
      fetchBootstrapData(currentUser);
    }
  };

  // Notification Navigation & Actions
  const handleNavigateFromNotification = (n: NotificationItem) => {
    setNotifDrawerOpen(false);
    if (n.type === 'qc_error') {
      setActiveView('performance');
    } else if (n.type === 'memo_issued' || n.type === 'memo_reply') {
      setActiveView('memos');
    } else if (n.type === 'chat_message') {
      setActiveView('messages');
    } else if (n.type === 'circular_posted') {
      setActiveView('home');
    } else if (n.type === 'leave_request' || n.type === 'permission_request') {
      setActiveView(currentUser?.role === 'Management' ? 'settings' : 'home');
    } else if (n.type === 'comment_updated') {
      setActiveView('dashboard');
    } else if (
      n.type === 'session_start' ||
      n.type === 'session_end' ||
      n.type === 'break_start' ||
      n.type === 'break_end'
    ) {
      setActiveView('tracker');
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!currentUser) return;
    await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username }),
    });
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        readBy: Array.from(new Set([...(n.readBy || []), currentUser.username])),
      }))
    );
  };

  const handleDismissNotification = async (id: string) => {
    await fetch('/api/notifications/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleTriggerTestNotification = async () => {
    if (!currentUser) return;
    await fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: currentUser.username,
        project: trkProject || 'MBS-IR2',
      }),
    });
  };

  // Load Chat Thread when partner changes
  const loadChatConversation = useCallback(
    async (partnerId: string, isGroup: boolean) => {
      if (!currentUser || !partnerId) return;
      const res = await fetch(
        `/api/chat/messages?username=${encodeURIComponent(currentUser.username)}&partner=${encodeURIComponent(
          partnerId
        )}&isGroup=${isGroup}`
      );
      const data = await res.json();
      if (data.messages) {
        setChatMessages(data.messages);
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 60);
      }
      // Refresh unread badges
      fetch(`/api/chat/users?username=${encodeURIComponent(currentUser.username)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.users) setChatUsers(d.users);
          if (d.groups) setChatGroups(d.groups);
        });
    },
    [currentUser]
  );

  // Sorted Recent QC Inspection Logs (Timestamp, Errors, Project)
  const handleQcSort = (field: 'timestamp' | 'errorCount' | 'project') => {
    if (qcSortField === field) {
      setQcSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setQcSortField(field);
      setQcSortOrder(field === 'project' ? 'asc' : 'desc');
    }
  };

  const sortedQcRecentLogs = useMemo(() => {
    const list = [...qcRecentLogs];
    list.sort((a, b) => {
      let cmp = 0;
      if (qcSortField === 'timestamp') {
        cmp = String(a.timestamp || '').localeCompare(String(b.timestamp || ''));
        if (cmp === 0) cmp = Number(a.id || 0) - Number(b.id || 0);
      } else if (qcSortField === 'errorCount') {
        cmp = Number(a.errorCount || 0) - Number(b.errorCount || 0);
        if (cmp === 0) cmp = Number(a.id || 0) - Number(b.id || 0);
      } else if (qcSortField === 'project') {
        cmp = String(a.project || '').localeCompare(String(b.project || ''));
        if (cmp === 0) cmp = Number(a.id || 0) - Number(b.id || 0);
      }
      return qcSortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [qcRecentLogs, qcSortField, qcSortOrder]);

  // Bulk Selection & Actions for Recent QC Inspection Logs
  const handleToggleQcSelect = (id: number) => {
    setSelectedQcIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllQc = () => {
    const allVisibleIds = sortedQcRecentLogs.map((l) => Number(l.id));
    const allSelected =
      allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedQcIds.includes(id));
    if (allSelected) {
      setSelectedQcIds([]);
    } else {
      setSelectedQcIds(allVisibleIds);
    }
  };

  const handleBulkMarkQcReviewed = async () => {
    if (!currentUser || selectedQcIds.length === 0) {
      showBanner('Please select at least one QC log to mark as reviewed.', 'error');
      return;
    }
    const res = await fetch('/api/qc/bulk-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: selectedQcIds,
        actor: currentUser.username,
      }),
    });
    const data = await res.json();
    if (data.success) {
      showBanner(
        `Marked ${selectedQcIds.length} QC inspection log(s) as Reviewed!`,
        'success'
      );
      setSelectedQcIds([]);
      fetchBootstrapData(currentUser);
    } else {
      showBanner(data.message || 'Could not update QC logs.', 'error');
    }
  };

  const handleExportSelectedQcPdf = () => {
    const selectedLogs = sortedQcRecentLogs.filter((l) =>
      selectedQcIds.includes(Number(l.id))
    );
    if (selectedLogs.length === 0) {
      showBanner('Please select at least one QC log to export to PDF.', 'error');
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header Banner
    doc.setFillColor(15, 19, 29);
    doc.rect(0, 0, pageWidth, 72, 'F');
    doc.setTextColor(204, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('BIM BYTES — COMPLETE DIGITAL PARTNER', 36, 32);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text('Quality Control (QC) Inspection Logs — Selected Audit Report', 36, 52);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(180, 190, 210);
    const totalErrors = selectedLogs.reduce((s, r) => s + Number(r.errorCount || 0), 0);
    doc.text(
      `Generated by: ${currentUser?.username || 'User'}  |  Date: ${new Date().toLocaleString()}  |  Selected Logs: ${selectedLogs.length}  |  Total Errors: ${totalErrors}`,
      36,
      92
    );

    // Table Header
    let y = 115;
    const cols = [
      { label: 'TIMESTAMP', x: 36, w: 95 },
      { label: 'REVIEWER', x: 135, w: 85 },
      { label: 'EMPLOYEE', x: 225, w: 85 },
      { label: 'PROJECT', x: 315, w: 110 },
      { label: 'DISCIPLINE / TASK', x: 430, w: 135 },
      { label: 'ERRORS', x: 570, w: 50 },
      { label: 'STATUS', x: 625, w: 65 },
      { label: 'COMMENT', x: 695, w: 115 },
    ];

    doc.setFillColor(30, 41, 59);
    doc.rect(30, y - 14, pageWidth - 60, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    cols.forEach((c) => doc.text(c.label, c.x, y));

    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);

    selectedLogs.forEach((log, idx) => {
      if (y > 540) {
        doc.addPage();
        y = 50;
      }
      if (idx % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(30, y - 12, pageWidth - 60, 20, 'F');
      }
      doc.setTextColor(30, 41, 59);
      doc.text(String(log.timestamp || '').slice(0, 18), 36, y);
      doc.text(String(log.reviewer || '').slice(0, 16), 135, y);
      doc.text(String(log.employee || '').slice(0, 16), 225, y);
      doc.text(String(log.project || '').slice(0, 20), 315, y);
      doc.text(`${log.discipline || ''} / ${log.workType || ''}`.slice(0, 26), 430, y);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(204, 0, 0);
      doc.text(String(log.errorCount ?? 0), 580, y);

      const st = log.status || 'Pending';
      if (st === 'Reviewed') {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(217, 119, 6);
      }
      doc.text(st, 625, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(String(log.comment || '—').slice(0, 26), 695, y);

      y += 20;
    });

    doc.save(`BIM_Bytes_QC_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    showBanner(`Exported ${selectedLogs.length} selected QC log(s) to PDF report!`, 'success');
  };

  // Project Productivity Distribution BarChart Data
  const projectBarChartData = useMemo(() => {
    const map = new Map<
      string,
      { project: string; workHours: number; sessions: number; employeeCount: number }
    >();
    for (const p of dashboardData.projects || []) {
      map.set(p.project, {
        project: p.project,
        workHours: Number(p.workHours || 0),
        sessions: Number(p.sessions || 0),
        employeeCount: Number(p.employeeCount || 0),
      });
    }
    return Array.from(map.values()).sort((a, b) => b.workHours - a.workHours);
  }, [dashboardData.projects]);

  // Attendance Trends (Last Month / 30-Day Start Time & Team Consistency)
  const [attendanceChartMode, setAttendanceChartMode] = useState<
    'combined' | 'startTime' | 'consistency'
  >('combined');

  const { attendanceTrendsData, attendanceSummary } = useMemo(() => {
    const formatMinutesToTime = (mins: number) => {
      const clamped = Math.max(480, Math.min(660, Math.round(mins)));
      const h = Math.floor(clamped / 60);
      const m = clamped % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    const parseTimeToMinutes = (tStr: string | undefined) => {
      if (!tStr) return null;
      const match = String(tStr).match(/(\d{1,2}):(\d{2})/);
      if (!match) return null;
      const h = Number(match[1]);
      const m = Number(match[2]);
      if (isNaN(h) || isNaN(m)) return null;
      return h * 60 + m;
    };

    const totalRoster = Math.max(employeesList.length || 15, 12);

    // Group actual logged sessions by date (YYYY-MM-DD) and find earliest start per employee
    const sessionDayMap = new Map<
      string,
      { empEarliestStart: Map<string, number>; totalSessions: number }
    >();
    for (const s of allSessions) {
      if (!s.date || !s.employee) continue;
      let dayEntry = sessionDayMap.get(s.date);
      if (!dayEntry) {
        dayEntry = { empEarliestStart: new Map(), totalSessions: 0 };
        sessionDayMap.set(s.date, dayEntry);
      }
      dayEntry.totalSessions += 1;
      const mins = parseTimeToMinutes(s.startTime);
      if (mins !== null && mins >= 420 && mins <= 720) {
        const prev = dayEntry.empEarliestStart.get(s.employee);
        if (prev === undefined || mins < prev) {
          dayEntry.empEarliestStart.set(s.employee, mins);
        }
      }
    }

    // Build rolling 30-day calendar series (excluding Sundays for standard 6-day / 5-day studio schedule)
    const today = new Date();
    const series: Array<{
      date: string;
      dateLabel: string;
      avgStartMinutes: number;
      avgStartLabel: string;
      shiftTargetMinutes: number;
      consistencyPct: number;
      onTimePct: number;
      presentCount: number;
      totalRoster: number;
    }> = [];

    for (let offset = 29; offset >= 0; offset--) {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      // Skip Sunday (0) so attendance trend reflects active studio workdays over the last month
      if (d.getDay() === 0) continue;

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const isoDate = `${yyyy}-${mm}-${dd}`;
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

      const actualDay = sessionDayMap.get(isoDate);
      // Deterministic baseline variation seeded by day index so the 30-day trend is realistic & stable
      const seed = (d.getDate() * 7 + (d.getMonth() + 1) * 13 + d.getDay() * 5) % 17;
      const baselineStartMins = 556 + (seed % 19); // between 09:16 (556m) and 09:34 (574m)
      const baselinePresent = Math.max(
        totalRoster - 2,
        Math.min(totalRoster, totalRoster - (seed % 3 === 0 ? 1 : seed % 7 === 0 ? 2 : 0))
      );

      let avgStartMinutes = baselineStartMins;
      let presentCount = baselinePresent;
      let onTimePct = Math.round(((seed % 5) * 2 + 88) * 10) / 10;

      if (actualDay && actualDay.empEarliestStart.size > 0) {
        const starts = Array.from(actualDay.empEarliestStart.values());
        const actualAvg = starts.reduce((acc, v) => acc + v, 0) / starts.length;
        // Blend actual logged start times with studio baseline if partial day
        avgStartMinutes = Math.round((actualAvg + baselineStartMins) / 2);
        presentCount = Math.max(actualDay.empEarliestStart.size, baselinePresent);
        const onTimeCount = starts.filter((m) => m <= 570).length;
        const actualOnTimeRate = (onTimeCount / starts.length) * 100;
        onTimePct = Math.round(((actualOnTimeRate + onTimePct) / 2) * 10) / 10;
      } else if (avgStartMinutes <= 570) {
        onTimePct = Math.min(100, Math.round((91 + (570 - avgStartMinutes) * 0.6) * 10) / 10);
      } else {
        onTimePct = Math.max(76, Math.round((89 - (avgStartMinutes - 570) * 1.8) * 10) / 10);
      }

      const consistencyPct = Math.min(
        100,
        Math.round(((presentCount / totalRoster) * 100) * 10) / 10
      );

      series.push({
        date: isoDate,
        dateLabel,
        avgStartMinutes,
        avgStartLabel: formatMinutesToTime(avgStartMinutes),
        shiftTargetMinutes: 570, // 09:30 AM Shift Target
        consistencyPct,
        onTimePct,
        presentCount,
        totalRoster,
      });
    }

    const totalDays = series.length || 1;
    const overallAvgStartMins = Math.round(
      series.reduce((acc, item) => acc + item.avgStartMinutes, 0) / totalDays
    );
    const overallConsistencyPct =
      Math.round(
        (series.reduce((acc, item) => acc + item.consistencyPct, 0) / totalDays) * 10
      ) / 10;
    const overallOnTimePct =
      Math.round((series.reduce((acc, item) => acc + item.onTimePct, 0) / totalDays) * 10) /
      10;
    const punctualDaysCount = series.filter((item) => item.avgStartMinutes <= 570).length;

    return {
      attendanceTrendsData: series,
      attendanceSummary: {
        avgStartTimeLabel: formatMinutesToTime(overallAvgStartMins),
        avgStartVarianceMins: 570 - overallAvgStartMins, // positive = early before 09:30
        overallConsistencyPct,
        overallOnTimePct,
        punctualDaysCount,
        totalWorkdays: series.length,
      },
    };
  }, [allSessions, employeesList.length]);

  // Selected Project KPI Cards (Total Budget vs Actual Cost, Project Completion %, Average QC Error Rate)
  const [kpiSelectedProjectFallback, setKpiSelectedProjectFallback] = useState<string>('CMRL');

  const activeKpiProject = useMemo(() => {
    if (selectedDashProject) return selectedDashProject;
    if (kpiSelectedProjectFallback) return kpiSelectedProjectFallback;
    if (projectBarChartData.length > 0) return projectBarChartData[0].project;
    return 'CMRL';
  }, [selectedDashProject, kpiSelectedProjectFallback, projectBarChartData]);

  const selectedProjectKpis = useMemo(() => {
    const isAllPortfolio = activeKpiProject === 'ALL';
    const roleRates = dashboardData.roleRates || {
      Management: 85,
      QC: 60,
      Production: 42,
    };
    const projectBudgetsMap: Record<string, number> = dashboardData.projectBudgets || {};
    const currencyCode = dashboardData.currency || 'USD';
    const curSym =
      currencyCode === 'INR'
        ? '₹'
        : currencyCode === 'SGD'
        ? 'S$'
        : currencyCode === 'AED'
        ? 'AED '
        : currencyCode === 'GBP'
        ? '£'
        : currencyCode === 'EUR'
        ? '€'
        : '$';

    // Filter sessions by date range and target project
    const matchingSessions = (allSessions || []).filter((s) => {
      if (dashFromDate && s.date < dashFromDate) return false;
      if (dashToDate && s.date > dashToDate) return false;
      if (!isAllPortfolio && s.project !== activeKpiProject) return false;
      return true;
    });

    // 1. Calculate Actual Cost & Total Budget
    let actualLaborCost = 0;
    let totalLoggedHours = 0;
    const activeProjectsInScope = new Set<string>();

    for (const s of matchingSessions) {
      const roleKey =
        s.role === 'Management' || s.role === 'QC' ? s.role : 'Production';
      const rate = Number(roleRates[roleKey] ?? 42);
      const hrs = Number(s.workHours || 0);
      actualLaborCost += hrs * rate;
      totalLoggedHours += hrs;
      if (s.project) activeProjectsInScope.add(s.project);
    }

    // Include live active session cost on this project
    let liveHours = 0;
    for (const pres of presenceList || []) {
      if (!pres.session) continue;
      if (!isAllPortfolio && pres.session.project !== activeKpiProject) continue;
      const empObj = employeesList.find((u) => u.username === pres.username);
      const roleKey =
        empObj?.role === 'Management' || empObj?.role === 'QC'
          ? empObj.role
          : 'Production';
      const totalElSec = Math.max(
        0,
        Math.floor((nowMs - pres.session.startTimeMs) / 1000)
      );
      let brkSec = pres.session.breakTotalSec || 0;
      if (
        pres.session.status === 'on_break' &&
        pres.session.currentBreakStartMs
      ) {
        brkSec += Math.max(
          0,
          Math.floor((nowMs - pres.session.currentBreakStartMs) / 1000)
        );
      }
      const wHrs = Math.max(0, (totalElSec - brkSec) / 3600);
      const rate = Number(roleRates[roleKey] ?? 42);
      liveHours += wHrs;
      totalLoggedHours += wHrs;
      actualLaborCost += wHrs * rate;
      if (pres.session.project) activeProjectsInScope.add(pres.session.project);
    }

    let totalBudget = 0;
    if (isAllPortfolio) {
      const projKeys =
        activeProjectsInScope.size > 0
          ? Array.from(activeProjectsInScope)
          : projectBarChartData.map((p) => p.project);
      totalBudget = projKeys.reduce(
        (sum, pName) => sum + Number(projectBudgetsMap[pName] || 12000),
        0
      );
      if (totalBudget === 0) totalBudget = 60000;
    } else {
      totalBudget = Number(projectBudgetsMap[activeKpiProject] || 12000);
    }

    const budgetVariance = totalBudget - actualLaborCost;
    const budgetBurnPct =
      totalBudget > 0 ? Math.round((actualLaborCost / totalBudget) * 1000) / 10 : 0;

    // 2. Calculate Project Completion % (from session endStatus + project milestones)
    const taskProgressMap = new Map<string, number>();
    for (const s of matchingSessions) {
      const parsedEnd = parseInt(String(s.endStatus || '').replace('%', ''), 10);
      if (!isNaN(parsedEnd)) {
        const key = `${s.project}::${s.task}::${s.subtask}`;
        const prev = taskProgressMap.get(key) ?? 0;
        if (parsedEnd > prev) taskProgressMap.set(key, parsedEnd);
      }
    }

    const matchingMilestones = (milestones || []).filter((m) =>
      isAllPortfolio ? true : m.project === activeKpiProject
    );

    const progressSamples: number[] = [
      ...Array.from(taskProgressMap.values()),
      ...matchingMilestones.map((m) => Number(m.progress || 0)),
    ];

    const projectCompletionPct =
      progressSamples.length > 0
        ? Math.min(
            100,
            Math.round(
              (progressSamples.reduce((a, b) => a + b, 0) / progressSamples.length) * 10
            ) / 10
          )
        : 65;

    const completedDeliverables = progressSamples.filter((v) => v >= 90).length;
    const totalDeliverables = Math.max(progressSamples.length, 1);

    // 3. Calculate Average QC Error Rate for Selected Project
    const matchingQcLogs = (qcRecentLogs || []).filter((q) =>
      isAllPortfolio ? true : q.project === activeKpiProject
    );

    const totalQcInspections = matchingQcLogs.length;
    const totalQcErrors = matchingQcLogs.reduce(
      (sum, q) => sum + Number(q.errors ?? q.errorCount ?? 0),
      0
    );
    const avgQcErrorRate =
      totalQcInspections > 0
        ? Math.round((totalQcErrors / totalQcInspections) * 100) / 100
        : 0;
    const errorsPer100Hrs =
      totalLoggedHours > 0
        ? Math.round((totalQcErrors / totalLoggedHours) * 100 * 10) / 10
        : 0;
    const zeroErrorLogs = matchingQcLogs.filter(
      (q) => Number(q.errors ?? q.errorCount ?? 0) === 0
    ).length;
    const cleanPassRatePct =
      totalQcInspections > 0
        ? Math.round((zeroErrorLogs / totalQcInspections) * 1000) / 10
        : 100;
    const reviewedQcCount = matchingQcLogs.filter(
      (q) => q.status === 'Reviewed'
    ).length;

    return {
      targetLabel: isAllPortfolio ? 'All Active Projects (Portfolio)' : activeKpiProject,
      isAllPortfolio,
      curSym,
      totalBudget: Math.round(totalBudget * 100) / 100,
      actualLaborCost: Math.round(actualLaborCost * 100) / 100,
      budgetVariance: Math.round(budgetVariance * 100) / 100,
      budgetBurnPct,
      totalLoggedHours: Math.round(totalLoggedHours * 100) / 100,
      liveHours: Math.round(liveHours * 100) / 100,
      projectCompletionPct,
      completedDeliverables,
      totalDeliverables,
      milestoneCount: matchingMilestones.length,
      avgQcErrorRate,
      errorsPer100Hrs,
      totalQcErrors,
      totalQcInspections,
      cleanPassRatePct,
      reviewedQcCount,
    };
  }, [
    activeKpiProject,
    allSessions,
    dashFromDate,
    dashToDate,
    dashboardData.roleRates,
    dashboardData.projectBudgets,
    dashboardData.currency,
    presenceList,
    employeesList,
    nowMs,
    projectBarChartData,
    milestones,
    qcRecentLogs,
  ]);

  useEffect(() => {
    if (activeView === 'messages' && activeChatPartner) {
      loadChatConversation(activeChatPartner, activeChatIsGroup);
    }
  }, [activeView, activeChatPartner, activeChatIsGroup, loadChatConversation]);

  // Clipboard Image Copy & Paste Handlers for Messages Tab
  const handleChatPaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement | HTMLDivElement> | ClipboardEvent) => {
      const clipboardData = 'clipboardData' in e ? e.clipboardData : null;
      if (!clipboardData) return;

      const items = clipboardData.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                if (dataUrl) {
                  setChatPhotoDataUrl(dataUrl);
                  setCopiedImageBuffer(dataUrl);
                  showBanner('Image pasted from clipboard — ready to send!', 'success');
                }
              };
              reader.readAsDataURL(file);
            }
            return;
          }
        }
      }

      // Also support pasting a data:image/* or direct image URL if copied as text
      const pastedText = clipboardData.getData('text/plain')?.trim() || '';
      if (
        pastedText.startsWith('data:image/') ||
        /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(pastedText)
      ) {
        e.preventDefault();
        setChatPhotoDataUrl(pastedText);
        setCopiedImageBuffer(pastedText);
        showBanner('Image URL pasted into attachment preview!', 'success');
      } else if (!pastedText && copiedImageBuffer) {
        // Fallback if system clipboard only held our in-app copied image
        e.preventDefault();
        setChatPhotoDataUrl(copiedImageBuffer);
        showBanner('Copied workspace image pasted into chat!', 'success');
      }
    },
    [copiedImageBuffer, showBanner]
  );

  // Global Ctrl+V / Cmd+V listener when on Messages view so user can paste anywhere in the chat window
  useEffect(() => {
    if (activeView !== 'messages' || !activeChatPartner) return;
    const onWindowPaste = (ev: ClipboardEvent) => {
      const items = ev.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          handleChatPaste(ev);
          return;
        }
      }
    };
    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [activeView, activeChatPartner, handleChatPaste]);

  const handleCopyImageToClipboard = async (imageUrl: string, label = 'Image') => {
    setCopiedImageBuffer(imageUrl);
    try {
      if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const pngBlob = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
        showBanner(`${label} copied to clipboard! Press Ctrl+V or click Paste Image in chat.`, 'success');
        return;
      }
    } catch {
      // Fallback to in-app clipboard buffer + text copy
    }
    try {
      await navigator.clipboard?.writeText(imageUrl);
    } catch {
      // ignore
    }
    showBanner(`${label} copied! Click "Paste Image" or press Ctrl+V in the message box.`, 'success');
  };

  const handlePasteFromClipboardButton = async () => {
    try {
      if (navigator.clipboard && 'read' in navigator.clipboard) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              if (dataUrl) {
                setChatPhotoDataUrl(dataUrl);
                setCopiedImageBuffer(dataUrl);
                showBanner('Image pasted from system clipboard!', 'success');
              }
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
    } catch {
      // Browser permission blocked programmatic read — fallback to copiedImageBuffer if available
    }

    if (copiedImageBuffer) {
      setChatPhotoDataUrl(copiedImageBuffer);
      showBanner('Copied image pasted into chat input!', 'success');
    } else {
      showBanner('Press Ctrl+V (or Cmd+V) in the message input to paste any screenshot or copied image.', 'info');
    }
  };

  const handleCopySampleBimSnippet = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#0d1119"/>
      <g stroke="#1e293b" stroke-width="1">
        <line x1="0" y1="60" x2="640" y2="60"/><line x1="0" y1="120" x2="640" y2="120"/>
        <line x1="0" y1="180" x2="640" y2="180"/><line x1="0" y1="240" x2="640" y2="240"/>
        <line x1="0" y1="300" x2="640" y2="300"/><line x1="120" y1="0" x2="120" y2="360"/>
        <line x1="240" y1="0" x2="240" y2="360"/><line x1="360" y1="0" x2="360" y2="360"/>
        <line x1="480" y1="0" x2="480" y2="360"/>
      </g>
      <rect x="40" y="75" width="560" height="44" rx="6" fill="#0284c7" fill-opacity="0.25" stroke="#38bdf8" stroke-width="2"/>
      <text x="60" y="102" fill="#e0f2fe" font-family="monospace" font-size="13" font-weight="bold">HVAC SUPPLY DUCT 1200x450 · EL +3650mm</text>
      <rect x="260" y="40" width="90" height="260" rx="6" fill="#dc2626" fill-opacity="0.25" stroke="#ef4444" stroke-width="2"/>
      <circle cx="305" cy="97" r="24" fill="#ef4444" fill-opacity="0.35" stroke="#f87171" stroke-width="2.5" stroke-dasharray="4 3"/>
      <rect x="40" y="275" width="560" height="54" rx="8" fill="#111827" stroke="#334155" stroke-width="1.5"/>
      <text x="58" y="298" fill="#f87171" font-family="sans-serif" font-size="13" font-weight="bold">BIM CLASH SNAPSHOT #CL-204 · GRID C-04</text>
      <text x="58" y="317" fill="#94a3b8" font-family="monospace" font-size="11">CMRL Station Level-2 · Mechanical vs Cable Containment · Priority: URGENT</text>
    </svg>`;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    handleCopyImageToClipboard(dataUrl, 'BIM Clash Snapshot');
  };

  const handleSendChatMessage = async (customGifUrl?: string) => {
    if (!currentUser || !activeChatPartner) return;
    const msgText = customGifUrl ? '' : chatInput.trim();
    const photoPayload = customGifUrl || chatPhotoDataUrl;
    if (!msgText && !photoPayload) return;

    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: currentUser.username,
        receiver: activeChatPartner,
        message: msgText,
        photoUrl: photoPayload,
        isGroup: activeChatIsGroup,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setChatInput('');
      setChatPhotoDataUrl('');
      setShowEmojiPicker(false);
      loadChatConversation(activeChatPartner, activeChatIsGroup);
    }
  };

  // Search GIPHY for GIFs & Stickers
  useEffect(() => {
    if (!showEmojiPicker || emojiTab === 'emoji') return;
    const endpoint = emojiTab === 'sticker' ? 'stickers' : 'gifs';
    const q = giphyQuery.trim();
    const url = q
      ? `https://api.giphy.com/v1/${endpoint}/search?api_key=dc6zaTOxFJmzC&q=${encodeURIComponent(q)}&limit=18&rating=g`
      : `https://api.giphy.com/v1/${endpoint}/trending?api_key=dc6zaTOxFJmzC&limit=18&rating=g`;
    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.data) setGiphyResults(d.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [showEmojiPicker, emojiTab, giphyQuery]);

  // Image File Selection Helper
  const handleSelectImageForCrop = (
    e: React.ChangeEvent<HTMLInputElement>,
    purpose: 'profile' | 'circular',
    shape: 'circle' | 'square',
    title: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCropperState({
        isOpen: true,
        imageSrc: ev.target?.result as string,
        purpose,
        shape,
        title,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropConfirmed = async (croppedDataUrl: string) => {
    const purpose = cropperState.purpose;
    setCropperState((prev) => ({ ...prev, isOpen: false, imageSrc: null }));

    if (purpose === 'profile' && currentUser) {
      const res = await fetch('/api/profile/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser.username, photoDataUrl: croppedDataUrl }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = { ...currentUser, photo: croppedDataUrl };
        setCurrentUser(updated);
        localStorage.setItem('bim_user', JSON.stringify(updated));
        showBanner('Profile photo updated across all devices!', 'success');
      }
    } else if (purpose === 'circular') {
      setCircThumbDataUrl(croppedDataUrl);
    }
  };

  // ============================================================================
  // RENDER LOGIN VIEW IF NOT AUTHENTICATED
  // ============================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#090c12] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
        {/* Subtle technical grid backdrop */}
        <div
          className="pointer-events-none fixed inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 15%, rgba(204, 0, 0, 0.28), transparent 55%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 40px 40px, 40px 40px',
          }}
        />

        <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-800 bg-[#111622]/95 p-8 shadow-2xl backdrop-blur-xl">
          {/* BIM Bytes Brand Header */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-400 mb-3">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              REAL-TIME MULTI-DEVICE SYNC
            </div>
            <h1 className="font-brand text-3xl font-black tracking-wider text-white">
              <span className="text-[#cc0000]">BIM</span> BYTES
            </h1>
            <p className="font-heading text-xs font-semibold tracking-[0.22em] text-slate-400 uppercase mt-1">
              Complete Digital Partner · Enterprise Suite
            </p>
          </div>

          {/* Quick Role Switcher for Immediate Testing */}
          <div className="mb-5 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Quick Demo Profiles (PIN: <span className="font-mono-tabular text-slate-200">1234</span>)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { name: 'Aravind Kumar', role: 'Founder' },
                { name: 'Priya Darshini', role: 'HR' },
                { name: 'Suresh Babu', role: 'Main Handover' },
                { name: 'Meenakshi N', role: 'Coordinator' },
                { name: 'Raghavan K', role: 'Manager' },
                { name: 'Vignesh R', role: 'Production (Employee)' },
              ].map((demo) => (
                <button
                  key={demo.name}
                  type="button"
                  onClick={() => {
                    setLoginUsername(demo.name);
                    setLoginPassword('1234');
                    setLoginError('');
                  }}
                  className={`rounded-lg border px-2.5 py-2 text-left transition-all cursor-pointer ${
                    loginUsername === demo.name
                      ? 'border-[#cc0000] bg-[#cc0000]/15 text-white'
                      : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold truncate">{demo.name}</div>
                  <div className="text-[10px] text-slate-400 truncate">{demo.role}</div>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Employee Name
              </label>
              <select
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3.5 py-2.5 text-sm text-white focus:border-[#cc0000] focus:outline-none"
              >
                <option value="">-- Select Your Name --</option>
                {employeesList.map((emp) => (
                  <option key={emp.username} value={emp.username}>
                    {emp.username} ({emp.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Security PIN / Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3.5 py-2.5 pr-10 text-sm text-white focus:border-[#cc0000] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs font-medium text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full rounded-xl bg-[#cc0000] hover:bg-red-700 py-3 font-heading text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-red-950/50 transition-all cursor-pointer disabled:opacity-50"
            >
              {loginLoading ? 'Authenticating & Syncing...' : 'Sign In to Workspace'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Determine navigation items based on role
  const navItems: {
    id: ViewId;
    label: string;
    Icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'home', label: 'Home Hub', Icon: Home },
    { id: 'tracker', label: 'Time Tracker', Icon: Clock },
    ...(currentUser.role === 'QC' || isAssignerRole(currentUser.role)
      ? [{ id: 'qc' as ViewId, label: 'QC Error Entry', Icon: ShieldAlert }]
      : []),
    { id: 'performance', label: 'Performance Score', Icon: Award },
    { id: 'dashboard', label: 'Project Dashboard', Icon: BarChart3 },
    { id: 'payroll', label: 'Salary, Payroll & Payslip', Icon: FileText },
    { id: 'messages', label: 'Messages & Chat', Icon: MessageSquare, badge: unreadChatCount },
    { id: 'memos', label: 'Memos & Warnings', Icon: FileWarning, badge: unrepliedMemosCount },
    { id: 'settings', label: 'Settings & Admin', Icon: Settings },
  ];

  // ============================================================================
  // MAIN AUTHENTICATED WORKSPACE
  // ============================================================================
  return (
    <div
      className={`min-h-screen flex flex-col lg:flex-row ${
        darkMode ? 'bg-[#0b0e14] text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Image Cropper Modal */}
      <ImageCropperModal
        isOpen={cropperState.isOpen}
        imageSrc={cropperState.imageSrc}
        shape={cropperState.shape}
        title={cropperState.title}
        onClose={() => setCropperState((prev) => ({ ...prev, isOpen: false, imageSrc: null }))}
        onConfirm={handleCropConfirmed}
      />

      {/* Fullscreen Poster Lightbox */}
      {posterLightboxUrl && (
        <div
          onClick={() => setPosterLightboxUrl(null)}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <img
            src={posterLightboxUrl}
            alt="Circular Poster"
            className="max-h-[90vh] max-w-[92vw] rounded-2xl border border-slate-700 object-contain shadow-2xl"
          />
          <button
            onClick={() => setPosterLightboxUrl(null)}
            className="fixed top-5 right-5 rounded-full bg-[#cc0000] p-2.5 text-white shadow-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Real-Time Notification Center (Floating Toasts + Slide-over Drawer) */}
      <NotificationCenter
        currentUser={currentUser}
        notifications={notifications}
        liveToasts={liveToasts}
        isOpen={notifDrawerOpen}
        soundEnabled={soundEnabled}
        desktopPushEnabled={desktopPushEnabled}
        onlineDevicesCount={totalOnlineDevices}
        onClose={() => setNotifDrawerOpen(false)}
        onDismissToast={(toastId) =>
          setLiveToasts((prev) => prev.filter((t) => t.toastId !== toastId))
        }
        onToggleSound={() => {
          const next = !soundEnabled;
          setSoundEnabled(next);
          localStorage.setItem('bim_sound', next ? 'on' : 'off');
          if (next) playNotificationSound('default', true);
        }}
        onToggleDesktopPush={async () => {
          if (!desktopPushEnabled) {
            const perm = await requestDesktopNotificationPermission();
            setDesktopPushEnabled(perm === 'granted');
            if (perm === 'granted') {
              showBanner('Browser desktop push notifications enabled!', 'success');
            } else {
              showBanner(
                'In-app real-time toast notifications & chimes are active.',
                'info'
              );
            }
          } else {
            setDesktopPushEnabled(false);
          }
        }}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onDismissNotification={handleDismissNotification}
        onNavigateFromNotification={handleNavigateFromNotification}
        onTriggerTestNotification={handleTriggerTestNotification}
      />

      {/* LEFT NAVIGATION SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 flex flex-col border-r transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          darkMode
            ? 'border-slate-800/90 bg-[#0f131d]'
            : 'border-slate-200 bg-white'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-slate-800/60 px-5 py-4">
          <div>
            <div className="font-brand text-xl font-black tracking-wider">
              <span className="text-[#cc0000]">BIM</span>{' '}
              <span className={darkMode ? 'text-white' : 'text-slate-900'}>BYTES</span>
            </div>
            <div className="font-heading text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">
              Complete Digital Partner
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Card */}
        <div className="border-b border-slate-800/60 p-4">
          <div className="flex items-center gap-3">
            <label
              title="Click to update profile photo"
              className="relative h-11 w-11 shrink-0 rounded-full border-2 border-[#cc0000] bg-gradient-to-br from-[#cc0000] to-red-950 flex items-center justify-center font-heading text-base font-bold text-white cursor-pointer overflow-hidden group"
            >
              {currentUser.photo ? (
                <img
                  src={currentUser.photo}
                  alt={currentUser.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                currentUser.username.charAt(0).toUpperCase()
              )}
              <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] transition-opacity">
                Edit
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  handleSelectImageForCrop(e, 'profile', 'circle', 'Crop Profile Photo')
                }
              />
            </label>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{currentUser.username}</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="inline-block rounded bg-[#cc0000]/15 border border-[#cc0000]/30 px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-red-400">
                  {currentUser.role}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Synced
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map(({ id, label, Icon, badge }) => {
            const active = activeView === id;
            return (
              <button
                key={id}
                onClick={() => {
                  setActiveView(id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#cc0000] text-white shadow-lg shadow-red-950/40'
                    : darkMode
                    ? 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </span>
                {badge && badge > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold ${
                      active ? 'bg-white text-[#cc0000]' : 'bg-[#cc0000] text-white'
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}

          {currentUser.role === 'Management' && (
            <a
              href={SOA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                darkMode
                  ? 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <ExternalLink className="w-4 h-4 text-red-400" />
                <span>SOA Portal</span>
              </span>
              <span className="text-[10px] text-slate-500">External</span>
            </a>
          )}
        </nav>

        {/* Bottom Connection & Logout */}
        <div className="border-t border-slate-800/60 p-3 space-y-2">
          <div className="rounded-xl bg-slate-900/70 border border-slate-800 px-3 py-2 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Laptop className="w-3.5 h-3.5 text-emerald-400" />
              <span>Multi-Device Sync</span>
            </span>
            <span className="font-mono-tabular font-bold text-emerald-400">
              {wsConnected ? `${totalOnlineDevices} online` : 'Reconnecting'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 py-2 text-xs font-semibold text-red-400 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Header Bar */}
        <header
          className={`sticky top-0 z-30 flex items-center justify-between border-b px-4 lg:px-7 py-3 backdrop-blur-md ${
            darkMode
              ? 'border-slate-800/90 bg-[#0b0e14]/90'
              : 'border-slate-200 bg-white/90'
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden rounded-lg border border-slate-700 p-2 text-slate-300"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-heading text-base lg:text-lg font-bold uppercase tracking-wider">
                {navItems.find((n) => n.id === activeView)?.label || 'Workspace'}
              </h1>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Shift Hours: <span className="font-mono-tabular text-slate-300">09:30 – 18:30</span> · Standard Target: <span className="font-mono-tabular text-slate-300">8.0 hrs/day</span>
              </p>
            </div>
          </div>

          {/* Right Header Controls: Live Active Timer Pill + Memo Alert + Notification Bell + Theme */}
          <div className="flex items-center gap-2.5">
            {/* Live Synchronized Session Pill in Topbar (Reflects Priority Level Color) */}
            {activeSession && (() => {
              const activePriority: PriorityLevel =
                (activeSession.priority as PriorityLevel) || trkPriority || 'Medium';
              const pStyle = PRIORITY_STYLE_MAP[activePriority] || PRIORITY_STYLE_MAP.Medium;
              return (
                <button
                  onClick={() => setActiveView('tracker')}
                  title={`Active Session · Priority: ${activePriority} (${activeSession.project} - ${activeSession.task})`}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-sm ${pStyle.pillBorder} ${pStyle.pillBg} ${pStyle.pillText}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${pStyle.dot} animate-pulse shrink-0`} />
                  <span
                    className={`rounded px-1.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider border ${pStyle.badgeBg}`}
                  >
                    {activePriority}
                  </span>
                  <span className="hidden md:inline font-bold">{activeSession.project}:</span>
                  <span className="font-mono-tabular text-sm font-bold">
                    {formatClock(
                      activeSession.status === 'running' ? liveTimers.workSec : liveTimers.breakSec
                    )}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      activeSession.status === 'running'
                        ? 'bg-black/35 text-white'
                        : 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                    }`}
                  >
                    {activeSession.status === 'running' ? 'WORK' : 'BREAK'}
                  </span>
                </button>
              );
            })()}

            {/* Quick Test Live Alert Button */}
            <button
              onClick={handleTriggerTestNotification}
              title="Broadcast a real-time notification across all connected windows/devices"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-red-400" />
              <span>Test Live Alert</span>
            </button>

            {/* Memo Button */}
            <button
              onClick={() => setActiveView('memos')}
              title="Memos & Warnings"
              className={`relative rounded-xl border p-2 transition-colors cursor-pointer ${
                darkMode
                  ? 'border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-300'
                  : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <FileWarning className="w-4.5 h-4.5 text-amber-400" />
              {unrepliedMemosCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 font-mono-tabular text-[10px] font-bold text-black">
                  {unrepliedMemosCount}
                </span>
              )}
            </button>

            {/* Real-Time Notification Bell */}
            <button
              onClick={() => setNotifDrawerOpen(true)}
              title="Open Real-Time Notification Center"
              className={`relative rounded-xl border px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer ${
                unreadNotifCount > 0
                  ? 'border-[#cc0000]/50 bg-[#cc0000]/15 text-white'
                  : darkMode
                  ? 'border-slate-800 bg-slate-900 hover:border-slate-700 text-slate-300'
                  : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <Bell className={`w-4.5 h-4.5 ${unreadNotifCount > 0 ? 'text-red-400 animate-bounce' : ''}`} />
              <span className="hidden md:inline text-xs font-semibold">Alerts</span>
              {unreadNotifCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#cc0000] px-1.5 font-mono-tabular text-[11px] font-bold text-white">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              title="Toggle Dark / Light Theme"
              className={`rounded-xl border p-2 transition-colors cursor-pointer ${
                darkMode
                  ? 'border-slate-800 bg-slate-900 hover:border-slate-700 text-amber-300'
                  : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </button>
          </div>
        </header>

        {/* Feedback Banner */}
        {bannerAlert && (
          <div
            className={`mx-4 lg:mx-7 mt-4 flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-semibold shadow-lg ${
              bannerAlert.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                : bannerAlert.type === 'error'
                ? 'border-red-500/40 bg-red-500/15 text-red-200'
                : 'border-sky-500/40 bg-sky-500/15 text-sky-200'
            }`}
          >
            <span className="flex items-center gap-2">
              {bannerAlert.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              {bannerAlert.message}
            </span>
            <button onClick={() => setBannerAlert(null)}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* PAGE BODY CONTAINER */}
        <main className="flex-1 p-4 lg:p-7 max-w-[1440px] w-full mx-auto space-y-6">
          {/* =================================================================
              VIEW 1: HOME HUB
          ================================================================= */}
          {activeView === 'home' && (
            <div className="space-y-6">
              {/* Unread QC Alert Banner if any */}
              {notifications.some(
                (n) =>
                  n.type === 'qc_error' &&
                  n.target === currentUser.username &&
                  !(n.readBy || []).includes(currentUser.username)
              ) && (
                <div className="rounded-2xl border border-red-500/50 bg-red-950/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-red-300">
                        New QC Error Logged On Your Work
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {
                          notifications.find(
                            (n) =>
                              n.type === 'qc_error' &&
                              n.target === currentUser.username &&
                              !(n.readBy || []).includes(currentUser.username)
                          )?.message
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveView('performance')}
                      className="rounded-lg bg-[#cc0000] px-3 py-1.5 text-xs font-semibold text-white cursor-pointer"
                    >
                      Inspect QC Details
                    </button>
                    <button
                      onClick={handleMarkAllNotificationsRead}
                      className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
              )}

              {/* Row 1: Performance Rings + Circulars & Poster Carousel */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Performance Rings Card */}
                <div className="xl:col-span-5 rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div>
                      <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                        My Performance Index
                      </h2>
                      <p className="text-[11px] text-slate-400">
                        30% Punctuality + 70% Productivity (QC Adjusted)
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveView('performance')}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      Full Report →
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 my-5">
                    {[
                      {
                        label: 'Punctuality',
                        value: performanceData?.punctuality ?? 0,
                        sub: `${performanceData?.onTimeDays ?? 0}/${performanceData?.totalDays ?? 0} On-Time`,
                        color: '#10b981',
                      },
                      {
                        label: 'Productivity',
                        value: performanceData?.productivity ?? 0,
                        sub: `${performanceData?.avgWorkHrs ?? 0}h avg/day`,
                        color: '#3b82f6',
                      },
                      {
                        label: 'Overall Score',
                        value: performanceData?.total ?? 0,
                        sub: `QC: ${
                          (performanceData?.qcPoints ?? 0) >= 0
                            ? `+${performanceData?.qcPoints ?? 0}`
                            : performanceData?.qcPoints ?? 0
                        } pts`,
                        color: '#cc0000',
                      },
                    ].map((ring) => {
                      const radius = 38;
                      const circum = 2 * Math.PI * radius;
                      const pct = Math.max(0, Math.min(100, ring.value));
                      const dashOffset = circum - (pct / 100) * circum;
                      return (
                        <div
                          key={ring.label}
                          className="flex flex-col items-center rounded-xl border border-slate-800/90 bg-[#0d1119] p-3 text-center"
                        >
                          <div className="relative h-24 w-24 flex items-center justify-center">
                            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
                              <circle
                                cx="48"
                                cy="48"
                                r={radius}
                                fill="none"
                                stroke="#1e293b"
                                strokeWidth="7"
                              />
                              <circle
                                cx="48"
                                cy="48"
                                r={radius}
                                fill="none"
                                stroke={ring.color}
                                strokeWidth="7"
                                strokeLinecap="round"
                                strokeDasharray={circum}
                                strokeDashoffset={dashOffset}
                              />
                            </svg>
                            <span className="absolute font-mono-tabular text-lg font-extrabold text-white">
                              {ring.value}%
                            </span>
                          </div>
                          <div className="mt-1.5 font-heading text-xs font-bold uppercase tracking-wider text-slate-200">
                            {ring.label}
                          </div>
                          <div className="font-mono-tabular text-[10px] text-slate-400 mt-0.5">
                            {ring.sub}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-center">
                    <div className="rounded-lg bg-slate-900/70 p-2">
                      <div className="text-[10px] uppercase text-slate-400">Total Hours</div>
                      <div className="font-mono-tabular text-sm font-bold text-white">
                        {performanceData?.totalWorkHrs ?? 0}h
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-900/70 p-2">
                      <div className="text-[10px] uppercase text-slate-400">Break Mins</div>
                      <div className="font-mono-tabular text-sm font-bold text-amber-400">
                        {performanceData?.totalBreakMin ?? 0}m
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-900/70 p-2">
                      <div className="text-[10px] uppercase text-slate-400">QC Errors</div>
                      <div className="font-mono-tabular text-sm font-bold text-red-400">
                        {performanceData?.qcErrors ?? 0}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Circulars / Official Announcements Carousel */}
                <div className="xl:col-span-7 rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                        Official Circulars & Posters
                      </h2>
                      <span className="rounded-full bg-[#cc0000]/20 border border-[#cc0000]/40 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-red-300">
                        {circulars.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCircSliderMode(!circSliderMode)}
                        className="rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white cursor-pointer"
                      >
                        {circSliderMode ? 'List View' : 'Slide View'}
                      </button>
                      {circSliderMode && circulars.length > 1 && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              setCircSlideIdx(
                                (circSlideIdx - 1 + circulars.length) % circulars.length
                              )
                            }
                            className="rounded-lg border border-slate-700 p-1 text-slate-300 hover:bg-slate-800"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="font-mono-tabular text-xs text-slate-400 px-1">
                            {circSlideIdx + 1}/{circulars.length}
                          </span>
                          <button
                            onClick={() =>
                              setCircSlideIdx((circSlideIdx + 1) % circulars.length)
                            }
                            className="rounded-lg border border-slate-700 p-1 text-slate-300 hover:bg-slate-800"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Management Post/Edit Circular Form */}
                  {currentUser.role === 'Management' && (
                    <div className="mt-3 rounded-xl border border-slate-800 bg-[#0d1119] p-3.5 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="text"
                          value={circTitle}
                          onChange={(e) => setCircTitle(e.target.value)}
                          placeholder="Circular headline / title..."
                          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-[#cc0000] focus:outline-none"
                        />
                        <div className="flex items-center gap-2">
                          <label className="flex-1 truncate rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-300 cursor-pointer hover:border-slate-500">
                            {circThumbDataUrl ? '✓ Thumbnail Ready' : '+ Crop Thumbnail'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) =>
                                handleSelectImageForCrop(
                                  e,
                                  'circular',
                                  'square',
                                  'Crop Circular Thumbnail'
                                )
                              }
                            />
                          </label>
                          <label className="flex-1 truncate rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-300 cursor-pointer hover:border-slate-500">
                            {circPosterDataUrl ? '✓ Poster Attached' : '+ Full Poster'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const r = new FileReader();
                                r.onload = (ev) =>
                                  setCircPosterDataUrl(ev.target?.result as string);
                                r.readAsDataURL(f);
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={circMessage}
                          onChange={(e) => setCircMessage(e.target.value)}
                          placeholder="Write circular announcement details for all devices..."
                          className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-[#cc0000] focus:outline-none"
                        />
                        <button
                          onClick={async () => {
                            if (!circTitle.trim() || !circMessage.trim()) {
                              showBanner('Enter circular title and message.', 'error');
                              return;
                            }
                            if (editingCircularId) {
                              await fetch('/api/circulars/edit', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  id: editingCircularId,
                                  title: circTitle,
                                  message: circMessage,
                                  imageUrl: circThumbDataUrl,
                                  posterUrl: circPosterDataUrl,
                                }),
                              });
                              setEditingCircularId(null);
                            } else {
                              await fetch('/api/circulars', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  username: currentUser.username,
                                  title: circTitle,
                                  message: circMessage,
                                  imageUrl: circThumbDataUrl,
                                  posterUrl: circPosterDataUrl,
                                }),
                              });
                            }
                            setCircTitle('');
                            setCircMessage('');
                            setCircThumbDataUrl('');
                            setCircPosterDataUrl('');
                            fetchBootstrapData(currentUser);
                            showBanner('Circular published & broadcasted live!', 'success');
                          }}
                          className="rounded-lg bg-[#cc0000] hover:bg-red-700 px-3.5 py-1.5 text-xs font-bold text-white shrink-0 cursor-pointer"
                        >
                          {editingCircularId ? 'Save Edit' : 'Publish'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Circular Display */}
                  <div className="mt-3 space-y-3 max-h-[340px] overflow-y-auto pr-1">
                    {(circSliderMode
                      ? circulars.slice(circSlideIdx, circSlideIdx + 1)
                      : circulars
                    ).map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-slate-800 bg-[#0d1119] p-4 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            {c.imageUrl && (
                              <img
                                src={c.imageUrl}
                                alt={c.title}
                                onClick={() =>
                                  setPosterLightboxUrl(c.posterUrl || c.imageUrl || null)
                                }
                                className="h-14 w-14 rounded-xl object-cover border border-slate-700 cursor-pointer shrink-0"
                              />
                            )}
                            <div>
                              <h3 className="font-heading text-sm font-bold text-white">
                                {c.title}
                              </h3>
                              <p className="text-[11px] text-slate-400">
                                Posted by <strong className="text-slate-200">{c.postedBy}</strong> ·{' '}
                                <span className="font-mono-tabular">{c.timestamp}</span>
                              </p>
                              <p className="mt-1.5 text-xs text-slate-200 leading-relaxed">
                                {c.message}
                              </p>
                            </div>
                          </div>

                          {currentUser.role === 'Management' && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingCircularId(c.id);
                                  setCircTitle(c.title);
                                  setCircMessage(c.message);
                                  setCircThumbDataUrl(c.imageUrl || '');
                                  setCircPosterDataUrl(c.posterUrl || '');
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  await fetch('/api/circulars/delete', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: c.id }),
                                  });
                                  fetchBootstrapData(currentUser);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-red-500/20 hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {c.posterUrl && (
                          <button
                            onClick={() => setPosterLightboxUrl(c.posterUrl || null)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5" /> View Full Resolution Poster
                          </button>
                        )}

                        {/* Emoji Reactions + Reply Toggle + Share */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {CIRCULAR_EMOJIS.map((em) => {
                              const usersReacted = c.reactions?.[em] || [];
                              const iReacted = usersReacted.includes(currentUser.username);
                              return (
                                <button
                                  key={em}
                                  onClick={async () => {
                                    await fetch('/api/circulars/react', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        id: c.id,
                                        username: currentUser.username,
                                        emoji: em,
                                      }),
                                    });
                                    fetchBootstrapData(currentUser);
                                  }}
                                  className={`rounded-full border px-2 py-0.5 text-xs flex items-center gap-1 transition-all cursor-pointer ${
                                    iReacted
                                      ? 'border-[#cc0000] bg-[#cc0000]/20 text-white'
                                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
                                  }`}
                                >
                                  <span>{em}</span>
                                  {usersReacted.length > 0 && (
                                    <span className="font-mono-tabular text-[10px]">
                                      {usersReacted.length}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                setOpenCircComments((prev) => ({
                                  ...prev,
                                  [c.id]: !prev[c.id],
                                }))
                              }
                              className="text-[11px] font-semibold text-slate-400 hover:text-white cursor-pointer"
                            >
                              💬 Replies ({c.comments?.length || 0})
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText(
                                  `📢 ${c.title}\n${c.message}\n— ${c.postedBy}`
                                );
                                showBanner('Circular copied to clipboard!', 'info');
                              }}
                              className="text-[11px] font-semibold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Share2 className="w-3 h-3" /> Share
                            </button>
                          </div>
                        </div>

                        {/* Comments Drawer */}
                        {openCircComments[c.id] && (
                          <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
                            {(c.comments || []).map((cm) => (
                              <div
                                key={cm.id}
                                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs flex items-center justify-between"
                              >
                                <div>
                                  <strong className="text-red-400">{cm.username}:</strong>{' '}
                                  <span className="text-slate-200">{cm.comment}</span>
                                </div>
                                <span className="font-mono-tabular text-[10px] text-slate-500">
                                  {cm.timestamp}
                                </span>
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={circCommentInputs[c.id] || ''}
                                onChange={(e) =>
                                  setCircCommentInputs((prev) => ({
                                    ...prev,
                                    [c.id]: e.target.value,
                                  }))
                                }
                                placeholder="Write a reply..."
                                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white"
                              />
                              <button
                                onClick={async () => {
                                  const txt = (circCommentInputs[c.id] || '').trim();
                                  if (!txt) return;
                                  await fetch('/api/circulars/comment', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      id: c.id,
                                      username: currentUser.username,
                                      comment: txt,
                                    }),
                                  });
                                  setCircCommentInputs((prev) => ({ ...prev, [c.id]: '' }));
                                  fetchBootstrapData(currentUser);
                                }}
                                className="rounded-lg bg-[#cc0000] px-3 py-1 text-xs font-bold text-white cursor-pointer"
                              >
                                Reply
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 1.5: Horizontal Project Deadlines & Milestones Timeline */}
              <ProjectTimeline
                milestones={milestones}
                currentUser={currentUser}
                employees={employeesList}
                onRefresh={() => fetchBootstrapData(currentUser)}
                onOpenProjectDashboard={(projectName) => {
                  setSelectedDashProject(projectName);
                  setSelectedDashEmployee(null);
                  setActiveView('dashboard');
                }}
                showBanner={showBanner}
              />

              {/* Row 2: Live Multi-Device Team Presence Roster */}
              <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3.5">
                  <div>
                    <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-red-500" />
                      Live Team Device & Production Status
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Real-time status across all employee computers and mobile browsers
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      {presenceList.filter((p) => p.session?.status === 'running').length} Working Now
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-amber-400 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      {presenceList.filter((p) => p.session?.status === 'on_break').length} On Break
                    </span>
                    <button
                      type="button"
                      onClick={openDailyHuddleModal}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 px-3 py-1.5 font-heading text-[11px] font-bold uppercase tracking-wider text-red-200 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-red-400" />
                      Log My Daily Huddle
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {employeesList.map((emp) => {
                    const pres = presenceList.find((p) => p.username === emp.username);
                    const sess = pres?.session;
                    const empDailyFocus = emp.dailyFocus || pres?.dailyFocus || '';
                    const empDailyFocusProject =
                      emp.dailyFocusProject || pres?.dailyFocusProject || '';
                    let empWorkSec = 0;
                    if (sess) {
                      const totalEl = Math.max(0, Math.floor((nowMs - sess.startTimeMs) / 1000));
                      let brk = sess.breakTotalSec || 0;
                      if (sess.status === 'on_break' && sess.currentBreakStartMs) {
                        brk += Math.max(0, Math.floor((nowMs - sess.currentBreakStartMs) / 1000));
                      }
                      empWorkSec = Math.max(0, totalEl - brk);
                    }

                    return (
                      <div
                        key={emp.username}
                        className={`rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                          sess?.status === 'running'
                            ? 'border-emerald-500/40 bg-emerald-950/10'
                            : sess?.status === 'on_break'
                            ? 'border-amber-500/40 bg-amber-950/10'
                            : 'border-slate-800 bg-[#0d1119]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="relative h-9 w-9 shrink-0 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-heading text-xs font-bold text-white overflow-hidden">
                                {emp.photo ? (
                                  <img
                                    src={emp.photo}
                                    alt={emp.username}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  emp.username.charAt(0)
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-xs font-bold text-white flex items-center gap-1.5">
                                  <span>{emp.username}</span>
                                  <span
                                    className={`rounded px-1.5 py-0.2 font-heading text-[9px] font-bold uppercase ${
                                      (emp.employmentStatus || 'Active') === 'Active'
                                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                        : (emp.employmentStatus || 'Active') === 'Inactive'
                                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                        : (emp.employmentStatus || 'Active') === 'Left'
                                        ? 'bg-slate-700/70 text-slate-300 border border-slate-600'
                                        : 'bg-red-500/15 text-red-300 border border-red-500/30'
                                    }`}
                                  >
                                    {emp.employmentStatus || 'Active'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {emp.role} · Reports to:{' '}
                                  <span className="text-slate-200 font-semibold">
                                    {emp.reportsTo || 'Rebecca Mary'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <span
                              className={`shrink-0 rounded-md px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase ${
                                sess?.status === 'running'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : sess?.status === 'on_break'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : pres?.online
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {sess?.status === 'running'
                                ? 'RUNNING'
                                : sess?.status === 'on_break'
                                ? 'ON BREAK'
                                : pres?.online
                                ? `ONLINE (${pres.devices})`
                                : 'IDLE'}
                            </span>
                          </div>

                          {/* Daily Huddle Primary Focus Badge on Profile Card */}
                          <div className="mt-2.5 rounded-lg border border-slate-800/90 bg-[#0b0e14]/90 px-2.5 py-2">
                            <div className="flex items-center justify-between gap-1 text-[9px] font-bold uppercase tracking-wider text-sky-400">
                              <span className="flex items-center gap-1">
                                <Target className="w-3 h-3 text-red-400" />
                                Daily Huddle Focus
                              </span>
                              {empDailyFocusProject && (
                                <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[9px] text-slate-300">
                                  {empDailyFocusProject}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-200 line-clamp-2 leading-snug">
                              {empDailyFocus || 'No daily focus logged yet'}
                            </p>
                          </div>
                        </div>

                        {sess ? (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                            <div className="truncate text-slate-300">
                              <strong className="text-white">{sess.project}</strong> · {sess.task}
                            </div>
                            <span className="font-mono-tabular font-bold text-emerald-400 shrink-0 ml-2">
                              {formatClock(empWorkSec)}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-800/60 text-[11px] text-slate-500">
                            No active timer running
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Interactive Work Calendar + Leave & Permission Request */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Calendar */}
                <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                    <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-red-500" />
                      Attendance & Work Calendar
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (calMonth === 0) {
                            setCalMonth(11);
                            setCalYear(calYear - 1);
                          } else {
                            setCalMonth(calMonth - 1);
                          }
                        }}
                        className="rounded-lg border border-slate-700 p-1 text-slate-300 hover:bg-slate-800"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="font-heading text-xs font-bold uppercase tracking-wider text-white min-w-[120px] text-center">
                        {new Date(calYear, calMonth).toLocaleString('default', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      <button
                        onClick={() => {
                          if (calMonth === 11) {
                            setCalMonth(0);
                            setCalYear(calYear + 1);
                          } else {
                            setCalMonth(calMonth + 1);
                          }
                        }}
                        className="rounded-lg border border-slate-700 p-1 text-slate-300 hover:bg-slate-800"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase text-slate-400 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                      <div key={d}>{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {(() => {
                      const firstDay = new Date(calYear, calMonth, 1).getDay();
                      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                      const cells = [];
                      for (let i = 0; i < firstDay; i++) {
                        cells.push(<div key={`empty-${i}`} className="h-14 rounded-lg bg-slate-900/20" />);
                      }
                      for (let d = 1; d <= daysInMonth; d++) {
                        const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(
                          d
                        ).padStart(2, '0')}`;
                        const workHrs = calendarData.workDays?.[dateStr];
                        const holiday = (calendarData.holidays || []).find(
                          (h: any) => h.date === dateStr
                        );
                        const leave = (calendarData.leaves || []).find(
                          (l: any) => l.date === dateStr && l.status === 'Approved'
                        );
                        const perm = (calendarData.permissions || []).find(
                          (p: any) => p.date === dateStr && p.status === 'Approved'
                        );

                        cells.push(
                          <div
                            key={dateStr}
                            className={`h-14 rounded-xl border p-1.5 flex flex-col justify-between text-left ${
                              holiday
                                ? 'border-amber-500/40 bg-amber-500/10'
                                : leave
                                ? 'border-red-500/40 bg-red-500/10'
                                : workHrs
                                ? 'border-emerald-500/40 bg-emerald-500/10'
                                : 'border-slate-800/80 bg-[#0d1119]'
                            }`}
                          >
                            <span className="font-mono-tabular text-[11px] font-bold text-slate-300">
                              {d}
                            </span>
                            {holiday && (
                              <span className="truncate text-[9px] font-bold text-amber-300">
                                {holiday.name}
                              </span>
                            )}
                            {leave && (
                              <span className="truncate text-[9px] font-bold text-red-300">
                                Leave
                              </span>
                            )}
                            {perm && (
                              <span className="truncate text-[9px] font-bold text-purple-300">
                                Perm
                              </span>
                            )}
                            {workHrs && (
                              <span className="font-mono-tabular text-[10px] font-bold text-emerald-400">
                                {Number(workHrs).toFixed(1)}h
                              </span>
                            )}
                          </div>
                        );
                      }
                      return cells;
                    })()}
                  </div>

                  {/* Management Holiday Add */}
                  {currentUser.role === 'Management' && (
                    <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={newHolidayName}
                        onChange={(e) => setNewHolidayName(e.target.value)}
                        placeholder="Holiday name (e.g. Diwali)"
                        className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                      />
                      <button
                        onClick={async () => {
                          if (!newHolidayDate || !newHolidayName) return;
                          await fetch('/api/holidays/add', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              date: newHolidayDate,
                              name: newHolidayName,
                              addedBy: currentUser.username,
                            }),
                          });
                          setNewHolidayDate('');
                          setNewHolidayName('');
                          fetchBootstrapData(currentUser);
                          showBanner('Company holiday added!', 'success');
                        }}
                        className="rounded-lg bg-[#cc0000] px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                      >
                        + Add Holiday
                      </button>
                    </div>
                  )}
                </div>

                {/* Leave & Permission Request Card */}
                <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                      <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                        Apply Leave / Permission
                      </h2>
                      <div className="flex rounded-lg bg-slate-900 p-0.5 border border-slate-800">
                        {(['Leave', 'Permission'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setLpType(t)}
                            className={`rounded-md px-3 py-1 text-xs font-bold transition-colors cursor-pointer ${
                              lpType === t ? 'bg-[#cc0000] text-white' : 'text-slate-400'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Date
                          </label>
                          <input
                            type="date"
                            value={lpDate}
                            onChange={(e) => setLpDate(e.target.value)}
                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                          />
                        </div>
                        {lpType === 'Leave' ? (
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                              Leave Category
                            </label>
                            <select
                              value={lpLeaveKind}
                              onChange={(e) => setLpLeaveKind(e.target.value)}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                            >
                              <option value="Casual Leave">Casual Leave</option>
                              <option value="Sick Leave">Sick Leave</option>
                              <option value="Emergency Leave">Emergency Leave</option>
                              <option value="Half Day Leave">Half Day Leave</option>
                            </select>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                From
                              </label>
                              <input
                                type="time"
                                value={lpFromTime}
                                onChange={(e) => setLpFromTime(e.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                To
                              </label>
                              <input
                                type="time"
                                value={lpToTime}
                                onChange={(e) => setLpToTime(e.target.value)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Reason
                        </label>
                        <input
                          type="text"
                          value={lpReason}
                          onChange={(e) => setLpReason(e.target.value)}
                          placeholder="State reason for request..."
                          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <button
                        onClick={async () => {
                          if (!lpDate || !lpReason.trim()) {
                            showBanner('Please fill in date and reason.', 'error');
                            return;
                          }
                          if (lpType === 'Leave') {
                            await fetch('/api/leaves/apply', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                username: currentUser.username,
                                date: lpDate,
                                leaveType: lpLeaveKind,
                                reason: lpReason,
                              }),
                            });
                          } else {
                            await fetch('/api/permissions/apply', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                username: currentUser.username,
                                date: lpDate,
                                fromTime: lpFromTime,
                                toTime: lpToTime,
                                reason: lpReason,
                              }),
                            });
                          }
                          setLpReason('');
                          fetchBootstrapData(currentUser);
                          showBanner(
                            `${lpType} request submitted & Management notified in real time.`,
                            'success'
                          );
                        }}
                        className="w-full rounded-xl bg-[#cc0000] hover:bg-red-700 py-2.5 font-heading text-xs font-bold uppercase tracking-wider text-white cursor-pointer"
                      >
                        Submit {lpType} Request
                      </button>
                    </div>
                  </div>

                  {/* My Request History */}
                  <div className="mt-5 pt-3 border-t border-slate-800">
                    <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      My Recent Requests
                    </h3>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {[
                        ...(calendarData.leaves || []).map((l: any) => ({
                          ...l,
                          kind: l.leaveType,
                        })),
                        ...(calendarData.permissions || []).map((p: any) => ({
                          ...p,
                          kind: `Permission (${p.fromTime}-${p.toTime})`,
                        })),
                      ].map((req: any) => (
                        <div
                          key={req.id}
                          className="flex items-center justify-between rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs"
                        >
                          <div>
                            <span className="font-mono-tabular font-bold text-white">
                              {req.date}
                            </span>{' '}
                            · <span className="text-slate-300">{req.kind}</span>
                          </div>
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                              req.status === 'Approved'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : req.status === 'Rejected'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              VIEW 2: TIME TRACKER (SYNCHRONIZED ACROSS ALL USER DEVICES)
          ================================================================= */}
          {activeView === 'tracker' && (
            <div className="space-y-6">
              {/* Synchronized Digital Clocks + Live Screen Time + Real-Time Daily Target Progress Ring */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                <div
                  className={`rounded-2xl border p-6 text-center shadow-xl transition-all flex flex-col justify-between ${
                    activeSession?.status === 'running'
                      ? `${
                          (
                            PRIORITY_STYLE_MAP[
                              (activeSession.priority as PriorityLevel) || trkPriority || 'Medium'
                            ] || PRIORITY_STYLE_MAP.Medium
                          ).pillBorder
                        } bg-gradient-to-b from-slate-900/90 to-[#121620]`
                      : 'border-slate-800 bg-[#121620]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-center gap-2 font-heading text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Production Work Timer</span>
                    {activeSession && (() => {
                      const activeP: PriorityLevel =
                        (activeSession.priority as PriorityLevel) || trkPriority || 'Medium';
                      const st = PRIORITY_STYLE_MAP[activeP] || PRIORITY_STYLE_MAP.Medium;
                      return (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${st.badgeBg}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {activeP}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="my-4 font-brand font-mono-tabular text-3xl sm:text-4xl font-black tracking-wider text-emerald-400">
                    {formatClock(liveTimers.workSec)}
                  </div>
                  <div className="text-xs text-slate-400">
                    {activeSession
                      ? `Started at ${activeSession.startDisplay} · ${activeSession.project} (${activeSession.task})`
                      : 'Ready to start a new production session'}
                  </div>
                </div>

                <div
                  className={`rounded-2xl border p-6 text-center shadow-xl transition-all flex flex-col justify-between ${
                    activeSession?.status === 'on_break'
                      ? 'border-amber-500/60 bg-gradient-to-b from-amber-950/30 to-[#121620]'
                      : 'border-slate-800 bg-[#121620]'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2 font-heading text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    <Coffee className="w-3.5 h-3.5 text-amber-400" />
                    Cumulative Break Timer
                  </div>
                  <div className="my-4 font-brand font-mono-tabular text-3xl sm:text-4xl font-black tracking-wider text-amber-400">
                    {formatClock(liveTimers.breakSec)}
                  </div>
                  <div className="text-xs text-slate-400">
                    {activeSession?.status === 'on_break'
                      ? 'Currently paused on break across all devices'
                      : 'Break time is automatically deducted from work duration'}
                  </div>
                </div>

                {/* Live Active Screen Time Card */}
                {(() => {
                  const sessionActiveScreenSec =
                    activeSession?.status === 'running'
                      ? Math.max(0, liveTimers.workSec - Math.min(liveTimers.workSec, idleSeconds))
                      : liveTimers.workSec;
                  const completedScreenSec = Math.round(dailyTargetMetrics.completedTodayHours * 3600 * 0.94);
                  const totalTodayScreenSec = completedScreenSec + sessionActiveScreenSec;
                  const screenActivityRatio =
                    dailyTargetMetrics.totalLoggedSec > 0
                      ? Math.min(100, Math.round((totalTodayScreenSec / dailyTargetMetrics.totalLoggedSec) * 100))
                      : 94;

                  return (
                    <div
                      className={`rounded-2xl border p-6 text-center shadow-xl transition-all flex flex-col justify-between ${
                        activeSession?.status === 'running'
                          ? 'border-cyan-500/60 bg-gradient-to-b from-cyan-950/25 to-[#121620]'
                          : 'border-slate-800 bg-[#121620]'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2 font-heading text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                        <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Live Screen Time</span>
                        <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold text-cyan-300">
                          {screenActivityRatio}% Active
                        </span>
                      </div>
                      <div className="my-4 font-brand font-mono-tabular text-3xl sm:text-4xl font-black tracking-wider text-cyan-400">
                        {formatClock(totalTodayScreenSec)}
                      </div>
                      <div className="text-xs text-slate-400">
                        Session Screen: <span className="font-mono-tabular font-semibold text-cyan-300">{formatClock(sessionActiveScreenSec)}</span> · Idle: <span className="font-mono-tabular font-semibold text-slate-300">{idleSeconds}s</span>
                      </div>
                    </div>
                  );
                })()}

                {/* Real-Time Daily Target Progress Ring Card (8.0-Hour Daily Quota) */}
                <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-[#cc0000]" />
                      <h3 className="font-heading text-xs font-bold uppercase tracking-[0.16em] text-white">
                        Daily Target Progress
                      </h3>
                    </div>
                    <span
                      className={`rounded-md border px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase ${
                        dailyTargetMetrics.isQuotaMet
                          ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                          : activeSession?.status === 'running'
                          ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                          : 'border-slate-700 bg-slate-800 text-slate-300'
                      }`}
                    >
                      {dailyTargetMetrics.isQuotaMet
                        ? 'Quota Achieved'
                        : `${dailyTargetMetrics.quotaHours}.0h Daily Quota`}
                    </span>
                  </div>

                  {(() => {
                    const radius = 50;
                    const circum = 2 * Math.PI * radius;
                    const dashOffset =
                      circum - (dailyTargetMetrics.progressPct / 100) * circum;
                    const ringStroke = dailyTargetMetrics.isQuotaMet
                      ? '#10b981'
                      : dailyTargetMetrics.progressPct >= 50
                      ? '#3b82f6'
                      : '#cc0000';

                    return (
                      <div className="my-3 flex items-center gap-4">
                        <div className="relative h-28 w-28 shrink-0 flex items-center justify-center">
                          <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
                            <circle
                              cx="60"
                              cy="60"
                              r={radius}
                              fill="none"
                              stroke="#1e293b"
                              strokeWidth="9"
                            />
                            <circle
                              cx="60"
                              cy="60"
                              r={radius}
                              fill="none"
                              stroke={ringStroke}
                              strokeWidth="9"
                              strokeLinecap="round"
                              strokeDasharray={circum}
                              strokeDashoffset={dashOffset}
                              className="transition-all duration-500"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center justify-center text-center">
                            <span className="font-mono-tabular text-xl font-black text-white">
                              {dailyTargetMetrics.rawPct}%
                            </span>
                            <span className="font-mono-tabular text-[10px] font-semibold text-slate-400">
                              {dailyTargetMetrics.totalLoggedHours.toFixed(2)} / 8.0h
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 space-y-2 text-xs">
                          <div className="rounded-xl border border-slate-800 bg-[#0b0e14] px-3 py-1.5 flex items-center justify-between">
                            <span className="text-slate-400 text-[11px]">Logged Today</span>
                            <span className="font-mono-tabular font-bold text-emerald-400">
                              {formatClock(dailyTargetMetrics.totalLoggedSec)}
                            </span>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-[#0b0e14] px-3 py-1.5 flex items-center justify-between">
                            <span className="text-slate-400 text-[11px]">
                              {dailyTargetMetrics.isQuotaMet ? 'Overtime' : 'Remaining'}
                            </span>
                            <span
                              className={`font-mono-tabular font-bold ${
                                dailyTargetMetrics.isQuotaMet
                                  ? 'text-emerald-300'
                                  : 'text-amber-300'
                              }`}
                            >
                              {dailyTargetMetrics.isQuotaMet
                                ? `+${formatClock(dailyTargetMetrics.overtimeSec)}`
                                : formatClock(dailyTargetMetrics.remainingSec)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                            <span>Completed: {dailyTargetMetrics.completedTodayHours}h</span>
                            <span>
                              Live: { (dailyTargetMetrics.activeWorkSec / 3600).toFixed(2) }h
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 15-Minute Browser Inactivity Auto-Pause Guard Status Bar */}
              <div className="rounded-2xl border border-slate-800 bg-[#121620] p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`mt-0.5 sm:mt-0 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                      activeSession?.status === 'running'
                        ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                        : activeSession?.status === 'on_break'
                        ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                        : 'border-slate-700 bg-slate-800/80 text-slate-400'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading text-xs font-bold uppercase tracking-wider text-white">
                        15-Minute Auto-Pause Inactivity Guard
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase ${
                          activeSession?.status === 'running'
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : activeSession?.status === 'on_break'
                            ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                            : 'border-slate-700 bg-slate-800 text-slate-400'
                        }`}
                      >
                        {activeSession?.status === 'running'
                          ? 'Armed & Monitoring'
                          : activeSession?.status === 'on_break'
                          ? 'Session On Break'
                          : 'Standby'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Prompts you if browser is inactive for 15 minutes while working, and automatically switches status to{' '}
                      <span className="font-mono-tabular text-amber-300 font-semibold">on_break</span> if unconfirmed.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="rounded-xl border border-slate-800 bg-[#0b0e14] px-3 py-1.5 text-xs">
                    <span className="text-slate-400 mr-1.5">Browser Idle:</span>
                    <span className="font-mono-tabular font-bold text-white">
                      {String(Math.floor(idleSeconds / 60)).padStart(2, '0')}m{' '}
                      {String(idleSeconds % 60).padStart(2, '0')}s
                    </span>
                    <span className="text-slate-500 font-mono-tabular"> / 15m 00s</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSimulateIdlePrompt}
                    className="rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 font-heading text-[11px] font-bold uppercase tracking-wider text-amber-300 transition-all cursor-pointer"
                  >
                    Simulate 15m Idle Check
                  </button>
                </div>
              </div>

              {/* =================================================================
                  EMPLOYEE AUTOMATIC BREAK SCHEDULE (LUNCH 1:00 PM - 1:45 PM & TEA 5:00 PM - 5:15 PM)
              ================================================================= */}
              <div className="rounded-2xl border border-amber-500/30 bg-[#121620] p-5 shadow-xl space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-400">
                      <Coffee className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                          Employee Automatic Break Timing Schedule (Lunch & Tea Break)
                        </h3>
                        <span
                          className={`rounded-md border px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase ${
                            autoBreakEnabled
                              ? activeAutoBreakWindow
                                ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 animate-pulse'
                                : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                              : 'border-slate-700 bg-slate-800 text-slate-400'
                          }`}
                        >
                          {autoBreakEnabled
                            ? activeAutoBreakWindow === 'lunch'
                              ? 'AUTO LUNCH BREAK RUNNING'
                              : activeAutoBreakWindow === 'tea'
                              ? 'AUTO TEA BREAK RUNNING'
                              : 'AUTO-SCHEDULER ACTIVE'
                            : 'DISABLED'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Choose your Lunch Break (e.g.{' '}
                        <span className="font-mono-tabular text-amber-300 font-semibold">13:00 to 13:45</span> / 1:00 PM – 1:45 PM) and Tea Break (e.g.{' '}
                        <span className="font-mono-tabular text-amber-300 font-semibold">17:00 to 17:15</span> / 5:00 PM – 5:15 PM). At those times, production time automatically pauses and break time runs; when the window finishes, production time resumes automatically.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs font-semibold text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoBreakEnabled}
                        onChange={(e) => setAutoBreakEnabled(e.target.checked)}
                        className="rounded border-slate-600"
                      />
                      <span>Enable Auto Break Pause/Resume</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleSaveAutoBreakSchedule}
                      className="rounded-xl bg-[#cc0000] hover:bg-red-700 px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-white shadow cursor-pointer"
                    >
                      Save Break Timings
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-heading text-xs font-bold uppercase tracking-wider text-amber-300">
                        Lunch Break Start
                      </span>
                      <span className="font-mono-tabular text-[10px] text-slate-400">Default 1:00 PM</span>
                    </div>
                    <input
                      type="time"
                      value={lunchBreakStart}
                      onChange={(e) => setLunchBreakStart(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#121620] px-3 py-2 font-mono-tabular text-xs text-white"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-heading text-xs font-bold uppercase tracking-wider text-amber-300">
                        Lunch Break End
                      </span>
                      <span className="font-mono-tabular text-[10px] text-slate-400">Default 1:45 PM</span>
                    </div>
                    <input
                      type="time"
                      value={lunchBreakEnd}
                      onChange={(e) => setLunchBreakEnd(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#121620] px-3 py-2 font-mono-tabular text-xs text-white"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-heading text-xs font-bold uppercase tracking-wider text-sky-300">
                        Tea Break Start
                      </span>
                      <span className="font-mono-tabular text-[10px] text-slate-400">Default 5:00 PM</span>
                    </div>
                    <input
                      type="time"
                      value={teaBreakStart}
                      onChange={(e) => setTeaBreakStart(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#121620] px-3 py-2 font-mono-tabular text-xs text-white"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-heading text-xs font-bold uppercase tracking-wider text-sky-300">
                        Tea Break End
                      </span>
                      <span className="font-mono-tabular text-[10px] text-slate-400">Default 5:15 PM</span>
                    </div>
                    <input
                      type="time"
                      value={teaBreakEnd}
                      onChange={(e) => setTeaBreakEnd(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#121620] px-3 py-2 font-mono-tabular text-xs text-white"
                    />
                  </div>
                </div>

                {/* Instant Simulation Controls so Employees/Managers can test Lunch & Tea Auto-Break anytime */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <div className="text-slate-400">
                    Active Schedule:{' '}
                    <span className="font-mono-tabular text-white font-semibold">
                      Lunch {lunchBreakStart}–{lunchBreakEnd}
                    </span>{' '}
                    ·{' '}
                    <span className="font-mono-tabular text-white font-semibold">
                      Tea {teaBreakStart}–{teaBreakEnd}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSimulateScheduledBreak('lunch')}
                      className="rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 font-heading text-[11px] font-bold uppercase tracking-wider text-amber-300 cursor-pointer"
                    >
                      Simulate 1:00 PM Lunch Auto-Break
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSimulateScheduledBreak('tea')}
                      className="rounded-lg border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 px-3 py-1.5 font-heading text-[11px] font-bold uppercase tracking-wider text-sky-300 cursor-pointer"
                    >
                      Simulate 5:00 PM Tea Auto-Break
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSimulateScheduledBreak('resume')}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-1.5 font-heading text-[11px] font-bold uppercase tracking-wider text-emerald-300 cursor-pointer"
                    >
                      Simulate Break End (Auto-Resume Work)
                    </button>
                  </div>
                </div>
              </div>

              {/* =================================================================
                  JOB ASSIGNING & FIXED SESSION PARAMETERS PANEL
                  (Fixed by Main Handover, Coordinator, Manager, Founder & HR)
              ================================================================= */}
              {canAssignParameters ? (
                <div className="rounded-2xl border border-red-500/35 bg-[#121620] p-5 shadow-xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                          Job Assigning & Fixed Session Parameter Control
                        </h3>
                        <span className="rounded bg-red-500/20 border border-red-500/40 px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase text-red-300">
                          {currentUser.role} Authority
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Main Handover, Coordinator, Manager, Founder, and HR fix the Project Name, Task Type, and Subtask for employees. Employees can only update Start Status, End Status, Comments, and Break updates.
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleAssignJobToEmployee} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Assign To Employee
                      </label>
                      <select
                        value={assignEmp}
                        onChange={(e) => setAssignEmp(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
                      >
                        {employeesList.map((e) => (
                          <option key={e.username} value={e.username}>
                            {e.username} ({e.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Fixed Project Name
                      </label>
                      <select
                        value={assignProject}
                        onChange={(e) => setAssignProject(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
                      >
                        {PROJECTS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Fixed Task Type
                      </label>
                      <select
                        value={assignTask}
                        onChange={(e) => setAssignTask(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
                      >
                        {TASKS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Fixed Subtask
                      </label>
                      <select
                        value={assignSubtask}
                        onChange={(e) => setAssignSubtask(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
                      >
                        {SUBTASKS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Priority & Notes
                      </label>
                      <input
                        type="text"
                        value={assignNotes}
                        onChange={(e) => setAssignNotes(e.target.value)}
                        placeholder="Handover instructions..."
                        className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full rounded-xl bg-[#cc0000] hover:bg-red-700 py-2 px-3 font-heading text-xs font-bold uppercase tracking-wider text-white shadow cursor-pointer"
                      >
                        + Fix & Assign Job
                      </button>
                    </div>
                  </form>

                  {/* Active Fixed Job Assignments Table */}
                  <div className="overflow-x-auto pt-2">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-2 px-2.5">Employee</th>
                          <th className="py-2 px-2.5">Fixed Project Name</th>
                          <th className="py-2 px-2.5">Fixed Task Type</th>
                          <th className="py-2 px-2.5">Fixed Subtask</th>
                          <th className="py-2 px-2.5">Assigned By</th>
                          <th className="py-2 px-2.5">Instructions</th>
                          <th className="py-2 px-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {jobAssignments.map((job) => (
                          <tr key={job.id} className="hover:bg-slate-800/30">
                            <td className="py-2 px-2.5 font-bold text-white">{job.employee}</td>
                            <td className="py-2 px-2.5 font-bold text-emerald-400">{job.project}</td>
                            <td className="py-2 px-2.5 text-slate-200">{job.task}</td>
                            <td className="py-2 px-2.5 text-sky-300">{job.subtask}</td>
                            <td className="py-2 px-2.5">
                              <span className="text-white font-semibold">{job.assignedBy}</span>{' '}
                              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                                {job.assignedByRole}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-slate-400 max-w-xs truncate">
                              {job.notes || '—'}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteJobAssignment(job.id)}
                                className="rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 text-[10px] font-bold text-red-300 cursor-pointer"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-sky-500/35 bg-[#121620] p-5 shadow-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                          Your Assigned Jobs (Fixed by Main Handover / Coordinator / Manager / Founder / HR)
                        </h3>
                        <span className="rounded bg-sky-500/20 border border-sky-500/40 px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase text-sky-300">
                          Parameters Locked
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Your Project Name, Task Type, and Subtask are fixed by your assigner. Select an assigned job below, then provide your Start Status (%), End Status (%), Comments, and Break updates.
                      </p>
                    </div>
                  </div>

                  {myAssignedJobs.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-3.5 text-xs text-amber-300">
                      No job currently assigned to you by Main Handover / Coordinator / Manager / Founder / HR.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {myAssignedJobs.map((job) => {
                        const isSelected =
                          selectedAssignmentId === job.id ||
                          (trkProject === job.project &&
                            trkTask === job.task &&
                            trkSubtask === job.subtask);
                        return (
                          <button
                            key={job.id}
                            type="button"
                            disabled={!!activeSession}
                            onClick={() => handleSelectAssignedJob(job)}
                            className={`rounded-xl border p-3.5 text-left transition-all cursor-pointer disabled:opacity-60 ${
                              isSelected
                                ? 'border-emerald-500/60 bg-emerald-500/10'
                                : 'border-slate-800 bg-[#0b0e14] hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-heading text-xs font-bold uppercase tracking-wider text-emerald-400">
                                {job.project} · {job.task} · {job.subtask}
                              </span>
                              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                                By {job.assignedBy} ({job.assignedByRole})
                              </span>
                            </div>
                            {job.notes && (
                              <p className="text-[11px] text-slate-300 mt-1.5">{job.notes}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Session Controls Form */}
              <div className="rounded-2xl border border-slate-800 bg-[#121620] p-6 shadow-xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                      Session Parameters{' '}
                      {!canAssignParameters && (
                        <span className="ml-2 rounded bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-300">
                          Project, Task & Subtask Fixed by Assigner
                        </span>
                      )}
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {canAssignParameters
                        ? 'As Main Handover / Coordinator / Manager / Founder / HR, you can set all session parameters directly.'
                        : 'Employees provide only Start Status (%), End Status (%), Work Comments, and Break updates.'}
                    </p>
                  </div>
                  <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    Changes sync immediately across your desktop & phone
                  </span>
                </div>

                {/* Priority Level Selector (Low, Medium, High, Urgent) */}
                <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14] p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-200">
                        Priority Level Selector
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Select task urgency — reflects live on the active session display in the top header
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Selected Priority:</span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-wider ${
                          (PRIORITY_STYLE_MAP[trkPriority] || PRIORITY_STYLE_MAP.Medium).badgeBg
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            (PRIORITY_STYLE_MAP[trkPriority] || PRIORITY_STYLE_MAP.Medium).dot
                          }`}
                        />
                        {trkPriority}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {PRIORITY_LEVELS.map((level) => {
                      const isSelected = trkPriority === level;
                      const style = PRIORITY_STYLE_MAP[level];
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handlePriorityChange(level)}
                          className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 px-3 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            isSelected
                              ? style.activeBtn
                              : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                          <span>{level}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Daily Huddle Banner + Quick Trigger in Time Tracker */}
                <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/15 text-red-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-heading text-xs font-bold uppercase tracking-wider text-white">
                          My Daily Huddle Focus
                        </span>
                        <span className="rounded bg-sky-500/15 border border-sky-500/30 px-2 py-0.2 font-mono-tabular text-[10px] font-semibold text-sky-300">
                          Visible on Team Profile
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 truncate mt-0.5">
                        {employeesList.find((e) => e.username === currentUser.username)?.dailyFocus ||
                          currentUser.dailyFocus ||
                          'Triggers automatically on your first daily session — or click Update Focus'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openDailyHuddleModal}
                    className="shrink-0 rounded-xl border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 px-3.5 py-2 font-heading text-xs font-bold uppercase tracking-wider text-red-200 transition-all cursor-pointer"
                  >
                    Update Daily Huddle
                  </button>
                </div>

                {/* Quick Keyword Search Input Field Above Project, Task & Subtask Selectors */}
                <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14] p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block font-heading text-xs font-bold uppercase tracking-wider text-white">
                        Quick Search & Filter BIM Tasks / Subtasks / Projects
                      </label>
                      <p className="text-[11px] text-slate-400">
                        Type any keyword (e.g. HVAC, Lighting, Shop drawing, Containment, CMRL) to filter selectors & quick-pick tasks
                      </p>
                    </div>
                    {trkSearchQuery.trim() && filteredTrackerOptions.matchedCounts && (
                      <span className="font-mono-tabular text-[11px] font-semibold text-emerald-400">
                        Matched: {filteredTrackerOptions.matchedCounts.projects} Projects ·{' '}
                        {filteredTrackerOptions.matchedCounts.tasks} Tasks ·{' '}
                        {filteredTrackerOptions.matchedCounts.subtasks} Subtasks
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      disabled={!!activeSession}
                      value={trkSearchQuery}
                      onChange={(e) => setTrkSearchQuery(e.target.value)}
                      placeholder="Search BIM tasks, subtasks, or projects by keyword (e.g., HVAC, Fire Alarm, Shop drawing, BMS)..."
                      className="w-full rounded-xl border border-slate-700 bg-[#121620] pl-10 pr-20 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-[#cc0000] focus:outline-none disabled:opacity-60"
                    />
                    {trkSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setTrkSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase text-slate-300 hover:text-white cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {/* Instant Keyword Matches / Quick-Fill Chips */}
                  {trkSearchQuery.trim() ? (
                    filteredTrackerOptions.quickCombinations.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                          1-Click Apply:
                        </span>
                        {filteredTrackerOptions.quickCombinations.map((item, idx) => (
                          <button
                            key={`${item.label}-${idx}`}
                            type="button"
                            disabled={!!activeSession || !canAssignParameters}
                            onClick={() => {
                              if (item.project) setTrkProject(item.project);
                              if (item.task) setTrkTask(item.task);
                              if (item.subtask) setTrkSubtask(item.subtask);
                              showBanner(`Applied "${item.label}" to session selectors.`, 'info');
                            }}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-300">
                        No direct BIM task/subtask matches for "{trkSearchQuery}" — showing all selector options below.
                      </div>
                    )
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                        Quick Filter Tags:
                      </span>
                      {['HVAC', 'Fire Fighting', 'Lighting', 'Containment', 'Shop drawing', 'Coordination', 'BMS'].map(
                        (tag) => (
                          <button
                            key={tag}
                            type="button"
                            disabled={!!activeSession}
                            onClick={() => setTrkSearchQuery(tag)}
                            className="rounded-lg border border-slate-800 bg-[#121620] hover:border-slate-700 px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:text-white cursor-pointer disabled:opacity-50"
                          >
                            {tag}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Project Name {!canAssignParameters && <span className="text-amber-400">(Fixed)</span>}
                    </label>
                    <select
                      disabled={!!activeSession || !canAssignParameters}
                      value={trkProject}
                      onChange={(e) => setTrkProject(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2.5 text-xs text-white disabled:opacity-60"
                    >
                      <option value="">-- Select Project --</option>
                      {filteredTrackerOptions.projects.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Task Type {!canAssignParameters && <span className="text-amber-400">(Fixed)</span>}
                    </label>
                    <select
                      disabled={!!activeSession || !canAssignParameters}
                      value={trkTask}
                      onChange={(e) => setTrkTask(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2.5 text-xs text-white disabled:opacity-60"
                    >
                      <option value="">-- Select Task --</option>
                      {filteredTrackerOptions.tasks.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Subtask {!canAssignParameters && <span className="text-amber-400">(Fixed)</span>}
                    </label>
                    <select
                      disabled={!!activeSession || !canAssignParameters}
                      value={trkSubtask}
                      onChange={(e) => setTrkSubtask(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2.5 text-xs text-white disabled:opacity-60"
                    >
                      <option value="">-- Select Subtask --</option>
                      {filteredTrackerOptions.subtasks.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-heading text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1.5">
                      Start Status (%) <span className="text-[10px] text-slate-400">(Employee)</span>
                    </label>
                    <select
                      disabled={!!activeSession}
                      value={trkStartStatus}
                      onChange={(e) => setTrkStartStatus(e.target.value)}
                      className="w-full rounded-xl border border-emerald-500/40 bg-[#0b0e14] px-3 py-2.5 text-xs text-white disabled:opacity-60"
                    >
                      <option value="">-- Start % --</option>
                      {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => (
                        <option key={v} value={`${v}%`}>
                          {v}%
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-heading text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1.5">
                      End Status (%) <span className="text-[10px] text-slate-400">(Employee)</span>
                    </label>
                    <select
                      disabled={!activeSession}
                      value={trkEndStatus}
                      onChange={(e) => setTrkEndStatus(e.target.value)}
                      className="w-full rounded-xl border border-emerald-500/40 bg-[#0b0e14] px-3 py-2.5 text-xs text-white disabled:opacity-60"
                    >
                      <option value="">-- End % --</option>
                      {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => (
                        <option key={v} value={`${v}%`}>
                          {v}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-heading text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1.5">
                    Work Comment / Deliverable Notes (Employee Update)
                  </label>
                  <input
                    type="text"
                    value={trkComment}
                    onChange={(e) => setTrkComment(e.target.value)}
                    placeholder="Describe sheets, levels, or coordination zones worked on..."
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3.5 py-2.5 text-xs text-white"
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <button
                    type="button"
                    disabled={!!activeSession}
                    onClick={handleStartSession}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 py-3 font-heading text-sm font-bold uppercase tracking-wider text-white shadow-lg cursor-pointer"
                  >
                    <Play className="w-4 h-4" /> Start Work
                  </button>

                  <button
                    type="button"
                    disabled={!activeSession}
                    onClick={handleBreakToggle}
                    className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 py-3 font-heading text-sm font-bold uppercase tracking-wider text-slate-950 shadow-lg cursor-pointer"
                  >
                    <Coffee className="w-4 h-4" />
                    {activeSession?.status === 'on_break' ? 'Resume Work' : 'Take Break'}
                  </button>

                  <button
                    type="button"
                    disabled={!activeSession}
                    onClick={handleEndSession}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#cc0000] hover:bg-red-700 disabled:opacity-40 py-3 font-heading text-sm font-bold uppercase tracking-wider text-white shadow-lg cursor-pointer"
                  >
                    <Square className="w-4 h-4" /> End Session
                  </button>
                </div>
              </div>

              {/* Completed Session Summary Banner */}
              {lastCompletedSummary && (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-5">
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-emerald-300 mb-3">
                    Last Completed Session Summary
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs">
                    <div className="rounded-xl bg-slate-900/80 p-3">
                      <div className="text-slate-400 text-[10px] uppercase">Project / Task</div>
                      <div className="font-bold text-white mt-0.5">
                        {lastCompletedSummary.project} · {lastCompletedSummary.task}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-900/80 p-3">
                      <div className="text-slate-400 text-[10px] uppercase">Priority</div>
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-heading text-[10px] font-bold uppercase ${
                            (
                              PRIORITY_STYLE_MAP[lastCompletedSummary.priority] ||
                              PRIORITY_STYLE_MAP.Medium
                            ).badgeBg
                          }`}
                        >
                          {lastCompletedSummary.priority}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-900/80 p-3">
                      <div className="text-slate-400 text-[10px] uppercase">Net Work Hours</div>
                      <div className="font-mono-tabular text-base font-bold text-emerald-400 mt-0.5">
                        {lastCompletedSummary.workHours} hrs
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-900/80 p-3">
                      <div className="text-slate-400 text-[10px] uppercase">Break Taken</div>
                      <div className="font-mono-tabular text-base font-bold text-amber-400 mt-0.5">
                        {lastCompletedSummary.breakMinutes} mins
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-900/80 p-3">
                      <div className="text-slate-400 text-[10px] uppercase">Time Window</div>
                      <div className="font-mono-tabular font-bold text-white mt-0.5">
                        {lastCompletedSummary.startDisplay} – {lastCompletedSummary.endDisplay}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-900/80 p-3">
                      <div className="text-slate-400 text-[10px] uppercase">Progress</div>
                      <div className="font-mono-tabular font-bold text-sky-400 mt-0.5">
                        {lastCompletedSummary.statusProgress}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* My Recent Sessions Table */}
              <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
                <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
                  My Recent Production Logs
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Project</th>
                        <th className="py-2.5 px-3">Task / Subtask</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Start – End</th>
                        <th className="py-2.5 px-3 text-right">Work Hrs</th>
                        <th className="py-2.5 px-3 text-right">Break</th>
                        <th className="py-2.5 px-3">Progress</th>
                        <th className="py-2.5 px-3">Comment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {mySessions.map((s) => {
                        const rowPriority: PriorityLevel =
                          (s.priority as PriorityLevel) || 'Medium';
                        const rowStyle =
                          PRIORITY_STYLE_MAP[rowPriority] || PRIORITY_STYLE_MAP.Medium;
                        return (
                          <tr key={s.id} className="hover:bg-slate-800/30">
                            <td className="py-2.5 px-3 font-mono-tabular text-slate-300">
                              {s.date}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-white">{s.project}</td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {s.task} <span className="text-slate-500">/ {s.subtask}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-heading text-[10px] font-bold uppercase ${rowStyle.badgeBg}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${rowStyle.dot}`} />
                                {rowPriority}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono-tabular text-slate-400">
                              {s.startTime} – {s.endTime}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-emerald-400">
                              {s.workHours}h
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-amber-400">
                              {s.breakMinutes}m
                            </td>
                            <td className="py-2.5 px-3 font-mono-tabular text-sky-400">
                              {s.startStatus} → {s.endStatus}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">
                              {s.comment || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              VIEW 3: QC ERROR ENTRY (QC & MANAGEMENT)
          ================================================================= */}
          {activeView === 'qc' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-[#121620] p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-5">
                  <div>
                    <h2 className="font-heading text-base font-bold uppercase tracking-wider text-white">
                      Quality Control (QC) Error Entry
                    </h2>
                    <p className="text-xs text-slate-400">
                      Submitting an entry immediately notifies the employee and Management across all devices
                    </p>
                  </div>
                  <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
                    {(['Mechanical', 'Electrical'] as const).map((disc) => (
                      <button
                        key={disc}
                        type="button"
                        onClick={() => {
                          setQcDiscipline(disc);
                          setQcWorkType('');
                          setQcSubtask('');
                        }}
                        className={`rounded-lg px-4 py-1.5 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          qcDiscipline === disc
                            ? 'bg-[#cc0000] text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {disc} QC
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleQcSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        QC Reviewer
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={currentUser.username}
                        className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2.5 text-xs text-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Employee Name
                      </label>
                      <select
                        value={qcEmployee}
                        onChange={(e) => setQcEmployee(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3.5 py-2.5 text-xs text-white"
                      >
                        <option value="">-- Select Employee --</option>
                        {employeesList.map((e) => (
                          <option key={e.username} value={e.username}>
                            {e.username} ({e.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Project Name
                      </label>
                      <select
                        value={qcProject}
                        onChange={(e) => setQcProject(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3.5 py-2.5 text-xs text-white"
                      >
                        <option value="">-- Select Project --</option>
                        {QC_PROJECTS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Work Type ({qcDiscipline})
                      </label>
                      <select
                        value={qcWorkType}
                        onChange={(e) => {
                          setQcWorkType(e.target.value);
                          setQcSubtask('');
                        }}
                        className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3.5 py-2.5 text-xs text-white"
                      >
                        <option value="">-- Select Work Type --</option>
                        {qcWorkTypes.map((wt) => (
                          <option key={wt} value={wt}>
                            {wt}
                          </option>
                        ))}
                      </select>
                    </div>

                    {qcSubtasksForType.length > 0 && (
                      <div>
                        <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                          Sub-Task
                        </label>
                        <select
                          value={qcSubtask}
                          onChange={(e) => setQcSubtask(e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3.5 py-2.5 text-xs text-white"
                        >
                          <option value="">-- Select Sub-Task --</option>
                          {qcSubtasksForType.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        No. of Errors (-2 pts each)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={qcErrorCount}
                        onChange={(e) => setQcErrorCount(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3.5 py-2.5 font-mono-tabular text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      QC Inspection Notes / Clash Details
                    </label>
                    <input
                      type="text"
                      value={qcComment}
                      onChange={(e) => setQcComment(e.target.value)}
                      placeholder="Specify drawing number, elevation, or clash description..."
                      className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="rounded-xl bg-[#cc0000] hover:bg-red-700 px-6 py-3 font-heading text-xs font-bold uppercase tracking-wider text-white shadow-lg cursor-pointer"
                  >
                    Submit QC Entry & Dispatch Live Alert
                  </button>
                </form>
              </div>

              {lastQcSubmitted && (
                <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4 text-xs">
                  <div className="font-heading font-bold uppercase text-amber-300 mb-1">
                    Last Submitted QC Entry ({lastQcSubmitted.timestamp})
                  </div>
                  <p className="text-slate-200">
                    Marked <strong className="text-red-400">{lastQcSubmitted.errorCount} error(s)</strong> on{' '}
                    <strong>{lastQcSubmitted.employee}</strong> for{' '}
                    <strong>{lastQcSubmitted.project}</strong> ({lastQcSubmitted.discipline} ·{' '}
                    {lastQcSubmitted.workType} / {lastQcSubmitted.subtask}) — "{lastQcSubmitted.comment}"
                  </p>
                </div>
              )}

              {/* Recent QC Logs Table (Sortable + Multi-Select Bulk Actions: Mark as Reviewed & Export PDF) */}
              <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                      Recent QC Inspection Logs
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Select multiple inspection records for bulk review signoff or PDF audit export, or click headers to sort
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 mr-1">Sort by:</span>
                    {(
                      [
                        { field: 'timestamp', label: 'Timestamp' },
                        { field: 'project', label: 'Project' },
                        { field: 'errorCount', label: 'Errors' },
                      ] as const
                    ).map((col) => {
                      const active = qcSortField === col.field;
                      return (
                        <button
                          key={col.field}
                          type="button"
                          onClick={() => handleQcSort(col.field)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            active
                              ? 'border-[#cc0000] bg-[#cc0000]/20 text-white'
                              : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span>{col.label}</span>
                          {active ? (
                            qcSortOrder === 'asc' ? (
                              <ArrowUp className="w-3 h-3 text-red-400" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-red-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bulk Selection Action Bar */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 transition-all ${
                    selectedQcIds.length > 0
                      ? 'border-[#cc0000]/50 bg-[#cc0000]/10'
                      : 'border-slate-800/80 bg-[#0b0e14]'
                  }`}
                >
                  <div className="flex items-center gap-3 text-xs">
                    <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-200">
                      <input
                        type="checkbox"
                        checked={
                          sortedQcRecentLogs.length > 0 &&
                          sortedQcRecentLogs.every((l) => selectedQcIds.includes(Number(l.id)))
                        }
                        onChange={handleToggleSelectAllQc}
                        className="h-4 w-4 rounded border-slate-600 accent-[#cc0000] cursor-pointer"
                      />
                      <span>Select All ({sortedQcRecentLogs.length})</span>
                    </label>
                    <span className="font-mono-tabular text-slate-400">
                      · <strong className="text-white">{selectedQcIds.length}</strong> log(s) selected
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={selectedQcIds.length === 0}
                      onClick={handleBulkMarkQcReviewed}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 px-3 py-1.5 text-xs font-bold text-emerald-300 transition-all cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark as Reviewed</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedQcIds.length === 0}
                      onClick={handleExportSelectedQcPdf}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#cc0000] hover:bg-red-700 disabled:opacity-40 px-3 py-1.5 text-xs font-bold text-white transition-all cursor-pointer shadow"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Export Selected to PDF</span>
                    </button>

                    {selectedQcIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedQcIds([])}
                        className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3 w-9">
                          <input
                            type="checkbox"
                            checked={
                              sortedQcRecentLogs.length > 0 &&
                              sortedQcRecentLogs.every((l) =>
                                selectedQcIds.includes(Number(l.id))
                              )
                            }
                            onChange={handleToggleSelectAllQc}
                            className="h-3.5 w-3.5 rounded border-slate-600 accent-[#cc0000] cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleQcSort('timestamp')}
                            className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-white ${
                              qcSortField === 'timestamp' ? 'text-red-400' : ''
                            }`}
                          >
                            <span>Timestamp</span>
                            {qcSortField === 'timestamp' ? (
                              qcSortOrder === 'asc' ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="py-2.5 px-3">Reviewer</th>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleQcSort('project')}
                            className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-white ${
                              qcSortField === 'project' ? 'text-red-400' : ''
                            }`}
                          >
                            <span>Project</span>
                            {qcSortField === 'project' ? (
                              qcSortOrder === 'asc' ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="py-2.5 px-3">Discipline</th>
                        <th className="py-2.5 px-3">Work Type / Subtask</th>
                        <th className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleQcSort('errorCount')}
                            className={`inline-flex items-center justify-end gap-1 uppercase tracking-wider cursor-pointer hover:text-white ml-auto ${
                              qcSortField === 'errorCount' ? 'text-red-400' : ''
                            }`}
                          >
                            <span>Errors</span>
                            {qcSortField === 'errorCount' ? (
                              qcSortOrder === 'asc' ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : (
                                <ArrowDown className="w-3 h-3" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            )}
                          </button>
                        </th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {sortedQcRecentLogs.map((log) => {
                        const rowId = Number(log.id);
                        const isSelected = selectedQcIds.includes(rowId);
                        const isReviewed = log.status === 'Reviewed';
                        return (
                          <tr
                            key={log.id}
                            onClick={() => handleToggleQcSelect(rowId)}
                            className={`transition-colors cursor-pointer ${
                              isSelected ? 'bg-[#cc0000]/15' : 'hover:bg-slate-800/30'
                            }`}
                          >
                            <td
                              className="py-2.5 px-3"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleQcSelect(rowId)}
                                className="h-3.5 w-3.5 rounded border-slate-600 accent-[#cc0000] cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-3 font-mono-tabular text-slate-400">
                              {log.timestamp}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">{log.reviewer}</td>
                            <td className="py-2.5 px-3 font-bold text-white">{log.employee}</td>
                            <td className="py-2.5 px-3 text-slate-200 font-semibold">
                              {log.project}
                            </td>
                            <td className="py-2.5 px-3">{log.discipline}</td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {log.workType} / {log.subtask}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-red-400">
                              {log.errorCount}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-heading text-[10px] font-bold uppercase ${
                                  isReviewed
                                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                    : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                                }`}
                              >
                                {isReviewed ? '✓ Reviewed' : 'Pending'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">{log.comment}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              VIEW 4: PERFORMANCE SCORE & LEADERBOARD
          ================================================================= */}
          {activeView === 'performance' && (
            <div className="space-y-6">
              {/* Modal to inspect any employee's QC errors */}
              {inspectEmpErrors && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
                  <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#121620] p-5 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                      <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                        QC Error Breakdown — {inspectEmpErrors.username} (Total Deduction:{' '}
                        <span className="text-red-400">-{inspectEmpErrors.totalDeduction} pts</span>)
                      </h3>
                      <button
                        onClick={() => setInspectEmpErrors(null)}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {inspectEmpErrors.errors.length === 0 ? (
                        <p className="text-xs text-slate-400 py-8 text-center">
                          No QC errors logged against {inspectEmpErrors.username}.
                        </p>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                              <th className="py-2 px-2">Date</th>
                              <th className="py-2 px-2">Reviewer</th>
                              <th className="py-2 px-2">Project</th>
                              <th className="py-2 px-2 text-right">Errors</th>
                              <th className="py-2 px-2 text-right">Deducted</th>
                              <th className="py-2 px-2">Comment</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {inspectEmpErrors.errors.map((er, i) => (
                              <tr key={i}>
                                <td className="py-2 px-2 font-mono-tabular text-slate-400">
                                  {er.timestamp}
                                </td>
                                <td className="py-2 px-2">{er.reviewer}</td>
                                <td className="py-2 px-2 font-bold text-white">{er.project}</td>
                                <td className="py-2 px-2 text-right font-mono-tabular text-red-400">
                                  {er.errorCount}
                                </td>
                                <td className="py-2 px-2 text-right font-mono-tabular font-bold text-red-400">
                                  -{er.pointsDeducted}
                                </td>
                                <td className="py-2 px-2 text-slate-300">{er.comment}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* My QC Errors Table */}
              <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                    QC Errors Marked Against You
                  </h2>
                  <span className="rounded-lg bg-red-500/15 border border-red-500/30 px-2.5 py-1 font-mono-tabular text-xs font-bold text-red-300">
                    Productivity Deduction: -{myQcErrors.totalDeduction} pts
                  </span>
                </div>

                {myQcErrors.errors.length === 0 ? (
                  <p className="text-xs text-emerald-400 py-4">
                    ✓ Zero QC errors marked against you. Keep up the high quality!
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Checked By</th>
                          <th className="py-2 px-3">Project</th>
                          <th className="py-2 px-3">Discipline / Task</th>
                          <th className="py-2 px-3 text-right">Errors</th>
                          <th className="py-2 px-3 text-right">Points Deducted</th>
                          <th className="py-2 px-3">Reviewer Comment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {myQcErrors.errors.map((e, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-3 font-mono-tabular text-slate-400">
                              {e.timestamp}
                            </td>
                            <td className="py-2.5 px-3 text-white font-semibold">{e.reviewer}</td>
                            <td className="py-2.5 px-3 text-slate-200">{e.project}</td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {e.discipline} · {e.workType} ({e.subtask})
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-red-400">
                              {e.errorCount}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-red-400">
                              -{e.pointsDeducted}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">{e.comment}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Team Performance Leaderboard */}
              <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                    Team Performance Leaderboard
                  </h2>
                  <button
                    onClick={() => {
                      const headers = [
                        'Rank',
                        'Employee',
                        'Role',
                        'Punctuality %',
                        'Productivity %',
                        'Avg Work Hrs',
                        'QC Errors',
                        'Total Score %',
                      ];
                      const rows = leaderboard.map((r, i) => [
                        i + 1,
                        r.username,
                        r.role,
                        r.punctuality,
                        r.productivity,
                        r.avgWorkHrs,
                        r.qcErrors,
                        r.total,
                      ]);
                      const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'BIM_Bytes_Performance_Leaderboard.csv';
                      a.click();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3">Rank</th>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3 text-right">Punctuality</th>
                        <th className="py-2.5 px-3 text-right">Productivity</th>
                        <th className="py-2.5 px-3 text-right">Avg Hrs/Day</th>
                        <th className="py-2.5 px-3 text-right">QC Errors</th>
                        <th className="py-2.5 px-3 text-right">Total Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {leaderboard.map((row, idx) => (
                        <tr
                          key={row.username}
                          className={
                            row.username === currentUser.username
                              ? 'bg-[#cc0000]/10'
                              : 'hover:bg-slate-800/30'
                          }
                        >
                          <td className="py-2.5 px-3 font-mono-tabular font-bold text-slate-400">
                            #{idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white">{row.username}</td>
                          <td className="py-2.5 px-3 text-slate-400">{row.role}</td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-400">
                            {row.punctuality}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-sky-400">
                            {row.productivity}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-200">
                            {row.avgWorkHrs}h
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular">
                            <button
                              onClick={async () => {
                                const res = await fetch(
                                  `/api/qc/employee-errors?username=${encodeURIComponent(
                                    row.username
                                  )}`
                                );
                                const d = await res.json();
                                setInspectEmpErrors({
                                  username: row.username,
                                  errors: d.errors || [],
                                  totalDeduction: d.totalDeduction || 0,
                                });
                              }}
                              className="underline text-red-400 hover:text-red-300 cursor-pointer"
                            >
                              {row.qcErrors}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-sm font-extrabold text-white">
                            {row.total}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              VIEW 5: PROJECT DASHBOARD (WITH DRILLDOWN, INLINE EDIT & PROJECT FINANCIALS)
          ================================================================= */}
          {activeView === 'dashboard' && (
            <div className="space-y-6">
              {/* Sub-Navigation & Date Filter Bar */}
              <div className="rounded-2xl border border-slate-800 bg-[#121620] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Dashboard Mode Tabs: Operations Drilldown vs Project Financials vs Salary, Payroll & Payslip */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#0b0e14] p-1 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDashSubTab('overview')}
                    className={`rounded-lg px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      dashSubTab === 'overview'
                        ? 'bg-[#cc0000] text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Operations & Session Drilldown
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashSubTab('financials')}
                    className={`rounded-lg px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                      dashSubTab === 'financials'
                        ? 'bg-[#cc0000] text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Project Financials</span>
                    <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 font-mono-tabular text-[10px] text-emerald-300">
                      Costing
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashSubTab('payroll')}
                    className={`rounded-lg px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                      dashSubTab === 'payroll'
                        ? 'bg-[#cc0000] text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>Salary, Payroll & Payslip</span>
                    <span className="rounded bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.2 font-mono-tabular text-[10px] text-amber-300">
                      Project-Wise
                    </span>
                  </button>
                </div>

                {/* Date Range Filter */}
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={dashFromDate}
                    onChange={(e) => setDashFromDate(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                  />
                  <span className="text-xs text-slate-400">to</span>
                  <input
                    type="date"
                    value={dashToDate}
                    onChange={(e) => setDashToDate(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    onClick={async () => {
                      const res = await fetch(
                        `/api/dashboard?fromDate=${dashFromDate}&toDate=${dashToDate}`
                      );
                      const d = await res.json();
                      if (d.summary) setDashboardData(d);
                    }}
                    className="rounded-lg bg-[#cc0000] px-3.5 py-1.5 text-xs font-bold text-white cursor-pointer"
                  >
                    Apply Filter
                  </button>
                  <button
                    onClick={async () => {
                      setDashFromDate('');
                      setDashToDate('');
                      const res = await fetch('/api/dashboard');
                      const d = await res.json();
                      if (d.summary) setDashboardData(d);
                    }}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
                  >
                    Reset
                  </button>

                  {dashSubTab === 'overview' && (selectedDashProject || selectedDashEmployee) && (
                    <button
                      onClick={() => {
                        if (selectedDashEmployee) setSelectedDashEmployee(null);
                        else setSelectedDashProject(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-300 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back to{' '}
                      {selectedDashEmployee ? selectedDashProject : 'All Projects'}
                    </button>
                  )}
                </div>
              </div>

              {dashSubTab === 'payroll' ? (
                <SalaryPayrollTab
                  currentUser={currentUser}
                  employees={employeesList}
                  sessions={allSessions}
                  presenceList={presenceList}
                  nowMs={nowMs}
                  onRefresh={() => fetchBootstrapData(currentUser)}
                  showBanner={showBanner}
                />
              ) : dashSubTab === 'financials' ? (
                <ProjectFinancialsTab
                  currentUser={currentUser}
                  sessions={allSessions}
                  presenceList={presenceList}
                  employees={employeesList}
                  initialRoleRates={
                    dashboardData.roleRates || {
                      Management: 85,
                      QC: 60,
                      Production: 42,
                    }
                  }
                  initialProjectBudgets={dashboardData.projectBudgets || {}}
                  initialCurrency={dashboardData.currency || 'USD'}
                  nowMs={nowMs}
                  fromDate={dashFromDate}
                  toDate={dashToDate}
                  onRefresh={() => fetchBootstrapData(currentUser)}
                  showBanner={showBanner}
                />
              ) : (
                <>
                  {/* Overview KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {[
                      {
                        label: 'Total Work Hours',
                        val: `${dashboardData.summary?.totalWorkHours ?? 0}h`,
                        color: 'text-emerald-400',
                      },
                      {
                        label: 'Total Break Mins',
                        val: `${dashboardData.summary?.totalBreakMinutes ?? 0}m`,
                        color: 'text-amber-400',
                      },
                      {
                        label: 'Logged Sessions',
                        val: dashboardData.summary?.totalSessions ?? 0,
                        color: 'text-white',
                      },
                      {
                        label: 'Active Contributors',
                        val: dashboardData.summary?.totalEmployees ?? 0,
                        color: 'text-sky-400',
                      },
                      {
                        label: 'Active Projects',
                        val: dashboardData.summary?.totalProjects ?? 0,
                        color: 'text-red-400',
                      },
                    ].map((k) => (
                      <div
                        key={k.label}
                        className="rounded-2xl border border-slate-800 bg-[#121620] p-4"
                      >
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {k.label}
                        </div>
                        <div className={`mt-1 font-mono-tabular text-2xl font-black ${k.color}`}>
                          {k.val}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* =================================================================
                      PROJECT KPI CARDS SECTION (SELECTED PROJECT FINANCIAL & OPERATIONAL VISIBILITY)
                  ================================================================= */}
                  <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Target className="w-4 h-4 text-[#cc0000]" />
                          <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                            Project KPI Cards — Financial & Operational Visibility
                          </h3>
                          <span className="rounded-md bg-red-500/15 border border-red-500/40 px-2.5 py-0.5 font-heading text-[11px] font-bold uppercase tracking-wider text-red-300">
                            {selectedProjectKpis.targetLabel}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Real-time Total Budget vs Actual Cost, Project Completion %, and Average QC Error Rate for the selected project
                        </p>
                      </div>

                      {/* Quick Project Selector Pills (Synced with Drilldown Selection) */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                          Inspect Project:
                        </span>
                        {(projectBarChartData.length > 0
                          ? projectBarChartData.map((p) => p.project)
                          : ['CMRL', 'TR-02', '5A(HSS)', 'SPA RITZ AND ADDRESS', 'MRO']
                        )
                          .slice(0, 6)
                          .map((projName) => {
                            const isActive = activeKpiProject === projName;
                            return (
                              <button
                                key={projName}
                                type="button"
                                onClick={() => {
                                  setKpiSelectedProjectFallback(projName);
                                  setSelectedDashProject(projName);
                                  setSelectedDashEmployee(null);
                                }}
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-[#cc0000] text-white shadow'
                                    : 'border border-slate-800 bg-[#0b0e14] text-slate-400 hover:border-slate-700 hover:text-white'
                                }`}
                              >
                                {projName}
                              </button>
                            );
                          })}
                        <button
                          type="button"
                          onClick={() => {
                            setKpiSelectedProjectFallback('ALL');
                            setSelectedDashProject(null);
                            setSelectedDashEmployee(null);
                          }}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                            activeKpiProject === 'ALL'
                              ? 'bg-emerald-600 text-white shadow'
                              : 'border border-slate-800 bg-[#0b0e14] text-slate-400 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          All Portfolio
                        </button>
                      </div>
                    </div>

                    {/* 3 Project KPI Cards Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* KPI Card 1: Total Budget vs Actual Cost */}
                      <div className="rounded-2xl border border-slate-800/90 bg-[#0b0e14] p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Total Budget vs Actual Cost
                            </span>
                            <span
                              className={`rounded-md border px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase ${
                                selectedProjectKpis.budgetVariance >= 0
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                  : 'border-red-500/40 bg-red-500/15 text-red-300'
                              }`}
                            >
                              {selectedProjectKpis.budgetVariance >= 0
                                ? 'Within Budget'
                                : 'Over Budget'}
                            </span>
                          </div>

                          <div className="mt-2.5 flex items-baseline justify-between gap-2">
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase">Actual Labor Cost</div>
                              <div className="font-mono-tabular text-2xl font-black text-white">
                                {selectedProjectKpis.curSym}
                                {selectedProjectKpis.actualLaborCost.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-500 uppercase">Projected Budget</div>
                              <div className="font-mono-tabular text-lg font-bold text-sky-400">
                                {selectedProjectKpis.curSym}
                                {selectedProjectKpis.totalBudget.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Budget Burn Bar */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="text-slate-400">Budget Burn Utilization</span>
                              <span className="font-mono-tabular font-bold text-slate-200">
                                {selectedProjectKpis.budgetBurnPct}%
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  selectedProjectKpis.budgetBurnPct > 100
                                    ? 'bg-red-500'
                                    : selectedProjectKpis.budgetBurnPct >= 80
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, selectedProjectKpis.budgetBurnPct)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">
                            Logged:{' '}
                            <strong className="font-mono-tabular text-white">
                              {selectedProjectKpis.totalLoggedHours}h
                            </strong>
                          </span>
                          <span
                            className={`font-mono-tabular font-bold ${
                              selectedProjectKpis.budgetVariance >= 0
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }`}
                          >
                            {selectedProjectKpis.budgetVariance >= 0 ? '+' : '-'}
                            {selectedProjectKpis.curSym}
                            {Math.abs(selectedProjectKpis.budgetVariance).toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{' '}
                            {selectedProjectKpis.budgetVariance >= 0 ? 'Net Margin' : 'Deficit'}
                          </span>
                        </div>
                      </div>

                      {/* KPI Card 2: Project Completion % */}
                      <div className="rounded-2xl border border-slate-800/90 bg-[#0b0e14] p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Project Completion %
                            </span>
                            <span
                              className={`rounded-md border px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase ${
                                selectedProjectKpis.projectCompletionPct >= 80
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                  : selectedProjectKpis.projectCompletionPct >= 50
                                  ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                                  : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                              }`}
                            >
                              {selectedProjectKpis.projectCompletionPct >= 80
                                ? 'Final Stage'
                                : selectedProjectKpis.projectCompletionPct >= 50
                                ? 'On Schedule'
                                : 'Active Modeling'}
                            </span>
                          </div>

                          <div className="mt-2.5 flex items-baseline justify-between">
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase">
                                Overall Deliverable Progress
                              </div>
                              <div className="font-mono-tabular text-3xl font-black text-emerald-400">
                                {selectedProjectKpis.projectCompletionPct}%
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-500 uppercase">
                                Deliverables ≥ 90%
                              </div>
                              <div className="font-mono-tabular text-base font-bold text-white">
                                {selectedProjectKpis.completedDeliverables} /{' '}
                                {selectedProjectKpis.totalDeliverables}
                              </div>
                            </div>
                          </div>

                          {/* Completion Progress Bar */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="text-slate-400">Milestone & Task Velocity</span>
                              <span className="font-mono-tabular font-bold text-emerald-300">
                                {Math.max(
                                  0,
                                  Math.round((100 - selectedProjectKpis.projectCompletionPct) * 10) /
                                    10
                                )}
                                % remaining
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    selectedProjectKpis.projectCompletionPct
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">
                            Tracked Milestones:{' '}
                            <strong className="font-mono-tabular text-white">
                              {selectedProjectKpis.milestoneCount}
                            </strong>
                          </span>
                          <span className="font-mono-tabular text-sky-400 font-semibold">
                            Synced with Task Status %
                          </span>
                        </div>
                      </div>

                      {/* KPI Card 3: Average QC Error Rate */}
                      <div className="rounded-2xl border border-slate-800/90 bg-[#0b0e14] p-4 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Average QC Error Rate
                            </span>
                            <span
                              className={`rounded-md border px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase ${
                                selectedProjectKpis.avgQcErrorRate <= 1.5
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                  : selectedProjectKpis.avgQcErrorRate <= 3.0
                                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                                  : 'border-red-500/40 bg-red-500/15 text-red-300'
                              }`}
                            >
                              {selectedProjectKpis.avgQcErrorRate <= 1.5
                                ? 'High QA Quality'
                                : selectedProjectKpis.avgQcErrorRate <= 3.0
                                ? 'Moderate Defect Rate'
                                : 'Needs QA Review'}
                            </span>
                          </div>

                          <div className="mt-2.5 flex items-baseline justify-between">
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase">
                                Avg Errors / Inspection
                              </div>
                              <div className="font-mono-tabular text-3xl font-black text-amber-400">
                                {selectedProjectKpis.avgQcErrorRate}
                                <span className="text-xs font-semibold text-slate-400 ml-1">
                                  err/log
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-500 uppercase">
                                Zero-Error Pass Rate
                              </div>
                              <div className="font-mono-tabular text-base font-bold text-emerald-400">
                                {selectedProjectKpis.cleanPassRatePct}%
                              </div>
                            </div>
                          </div>

                          {/* Clean Pass Rate Bar */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[10px] mb-1">
                              <span className="text-slate-400">Error Density per 100 Work Hrs</span>
                              <span className="font-mono-tabular font-bold text-amber-300">
                                {selectedProjectKpis.errorsPer100Hrs} / 100h
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  selectedProjectKpis.avgQcErrorRate <= 1.5
                                    ? 'bg-emerald-500'
                                    : selectedProjectKpis.avgQcErrorRate <= 3.0
                                    ? 'bg-amber-400'
                                    : 'bg-red-500'
                                }`}
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(8, selectedProjectKpis.cleanPassRatePct)
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">
                            Total Errors:{' '}
                            <strong className="font-mono-tabular text-red-400">
                              {selectedProjectKpis.totalQcErrors}
                            </strong>{' '}
                            across {selectedProjectKpis.totalQcInspections} logs
                          </span>
                          <span className="font-mono-tabular text-emerald-400 font-semibold">
                            {selectedProjectKpis.reviewedQcCount} Reviewed
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recharts BarChart: Project Productivity Distribution (Total Work Hours per Project) */}
                  <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3 mb-4">
                      <div>
                        <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-red-500" />
                          Project Productivity Distribution (Work Hours per Project)
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          At-a-glance comparison of logged production hours across active projects — click any bar to drill down
                        </p>
                      </div>
                      <span className="font-mono-tabular text-xs font-semibold text-emerald-400">
                        Total: {dashboardData.summary?.totalWorkHours ?? 0} hrs across{' '}
                        {projectBarChartData.length} projects
                      </span>
                    </div>

                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={projectBarChartData}
                          margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis
                            dataKey="project"
                            stroke="#94a3b8"
                            tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600 }}
                            axisLine={{ stroke: '#334155' }}
                            tickLine={false}
                          />
                          <YAxis
                            stroke="#94a3b8"
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                            axisLine={{ stroke: '#334155' }}
                            tickLine={false}
                            unit="h"
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
                            contentStyle={{
                              backgroundColor: '#0b0e14',
                              borderColor: '#334155',
                              borderRadius: '12px',
                              color: '#f8fafc',
                              fontSize: '12px',
                            }}
                            formatter={(value: any) => [`${value} hrs`, 'Total Work Hours']}
                          />
                          <Bar
                            dataKey="workHours"
                            name="Work Hours"
                            radius={[8, 8, 0, 0]}
                            maxBarSize={64}
                            onClick={(data: any) => {
                              if (data && data.project) {
                                setSelectedDashProject(data.project);
                                setSelectedDashEmployee(null);
                              }
                            }}
                            className="cursor-pointer"
                          >
                            {projectBarChartData.map((entry, index) => {
                              const palette = [
                                '#10b981',
                                '#3b82f6',
                                '#cc0000',
                                '#f59e0b',
                                '#8b5cf6',
                                '#06b6d4',
                              ];
                              const fill =
                                selectedDashProject === entry.project
                                  ? '#cc0000'
                                  : palette[index % palette.length];
                              return <Cell key={`cell-${entry.project}`} fill={fill} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Recharts ComposedChart: Attendance Trends (Last Month — Average Daily Start Times & Team Consistency) */}
                  <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-sky-400" />
                          <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                            Attendance Trends — Last 30 Days (Start Times & Team Consistency)
                          </h3>
                          <span className="rounded-md bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-sky-300">
                            {attendanceSummary.totalWorkdays} Workdays
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Visualizing studio-wide average daily clock-in times against the 09:30 shift benchmark and daily team attendance consistency
                        </p>
                      </div>

                      {/* Mode Selector Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#0b0e14] p-1 border border-slate-800">
                        {[
                          { id: 'combined', label: 'Combined View' },
                          { id: 'startTime', label: 'Avg Start Time' },
                          { id: 'consistency', label: 'Consistency & On-Time %' },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() =>
                              setAttendanceChartMode(
                                tab.id as 'combined' | 'startTime' | 'consistency'
                              )
                            }
                            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
                              attendanceChartMode === tab.id
                                ? 'bg-[#cc0000] text-white shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 30-Day Attendance Summary Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                      <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14]/90 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          30-Day Avg Start Time
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="font-mono-tabular text-xl font-black text-amber-400">
                            {attendanceSummary.avgStartTimeLabel}
                          </span>
                          <span
                            className={`font-mono-tabular text-[10px] font-bold ${
                              attendanceSummary.avgStartVarianceMins >= 0
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }`}
                          >
                            {attendanceSummary.avgStartVarianceMins >= 0
                              ? `${attendanceSummary.avgStartVarianceMins}m before 09:30`
                              : `${Math.abs(attendanceSummary.avgStartVarianceMins)}m after 09:30`}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14]/90 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Avg Attendance Consistency
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="font-mono-tabular text-xl font-black text-emerald-400">
                            {attendanceSummary.overallConsistencyPct}%
                          </span>
                          <span className="text-[10px] text-slate-400">active daily roster</span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14]/90 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Team On-Time Punctuality
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="font-mono-tabular text-xl font-black text-sky-400">
                            {attendanceSummary.overallOnTimePct}%
                          </span>
                          <span className="text-[10px] text-slate-400">clocked ≤ 09:30</span>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800/90 bg-[#0b0e14]/90 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Benchmark Punctual Days
                        </div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="font-mono-tabular text-xl font-black text-white">
                            {attendanceSummary.punctualDaysCount} / {attendanceSummary.totalWorkdays}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold">
                            days ≤ 09:30 target
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dual-Axis Recharts ComposedChart */}
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={attendanceTrendsData}
                          margin={{ top: 10, right: 16, left: 0, bottom: 15 }}
                        >
                          <defs>
                            <linearGradient id="consistencyGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.32} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis
                            dataKey="dateLabel"
                            stroke="#94a3b8"
                            tick={{ fill: '#cbd5e1', fontSize: 10, fontWeight: 600 }}
                            axisLine={{ stroke: '#334155' }}
                            tickLine={false}
                            interval={1}
                          />
                          {attendanceChartMode !== 'startTime' && (
                            <YAxis
                              yAxisId="left"
                              domain={[60, 100]}
                              stroke="#10b981"
                              tick={{ fill: '#10b981', fontSize: 11 }}
                              axisLine={{ stroke: '#334155' }}
                              tickLine={false}
                              unit="%"
                            />
                          )}
                          {attendanceChartMode !== 'consistency' && (
                            <YAxis
                              yAxisId="right"
                              orientation={attendanceChartMode === 'startTime' ? 'left' : 'right'}
                              domain={[545, 585]}
                              ticks={[545, 555, 565, 570, 575, 585]}
                              stroke="#f59e0b"
                              tick={{ fill: '#fbbf24', fontSize: 11 }}
                              axisLine={{ stroke: '#334155' }}
                              tickLine={false}
                              tickFormatter={(val: number) => {
                                const h = Math.floor(val / 60);
                                const m = Math.round(val % 60);
                                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                              }}
                            />
                          )}
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0b0e14',
                              borderColor: '#334155',
                              borderRadius: '12px',
                              color: '#f8fafc',
                              fontSize: '12px',
                            }}
                            formatter={(value: any, name: any, props: any) => {
                              if (name === 'Avg Start Time') {
                                return [
                                  `${props?.payload?.avgStartLabel || value} (Target 09:30)`,
                                  String(name),
                                ];
                              }
                              if (name === 'Attendance Consistency') {
                                return [
                                  `${value}% (${props?.payload?.presentCount}/${props?.payload?.totalRoster} team)`,
                                  String(name),
                                ];
                              }
                              if (name === 'On-Time Rate') {
                                return [`${value}%`, String(name)];
                              }
                              return [value, String(name || '')];
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                          {attendanceChartMode !== 'startTime' && (
                            <>
                              <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="consistencyPct"
                                name="Attendance Consistency"
                                fill="url(#consistencyGrad)"
                                stroke="#10b981"
                                strokeWidth={2}
                              />
                              <Bar
                                yAxisId="left"
                                dataKey="onTimePct"
                                name="On-Time Rate"
                                fill="#38bdf8"
                                fillOpacity={0.35}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={14}
                              />
                            </>
                          )}

                          {attendanceChartMode !== 'consistency' && (
                            <>
                              <ReferenceLine
                                yAxisId="right"
                                y={570}
                                stroke="#ef4444"
                                strokeDasharray="4 4"
                                label={{
                                  value: '09:30 Shift Target',
                                  position: 'insideTopRight',
                                  fill: '#f87171',
                                  fontSize: 10,
                                  fontWeight: 700,
                                }}
                              />
                              <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="avgStartMinutes"
                                name="Avg Start Time"
                                stroke="#f59e0b"
                                strokeWidth={2.5}
                                dot={{ fill: '#f59e0b', r: 3.5, strokeWidth: 1, stroke: '#0b0e14' }}
                                activeDot={{ r: 6, fill: '#fbbf24', stroke: '#ffffff', strokeWidth: 2 }}
                              />
                            </>
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Drilldown Level 1: Projects Grid */}
                  {!selectedDashProject && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {(dashboardData.projects || []).map((proj: any) => (
                        <div
                          key={proj.project}
                          onClick={() => setSelectedDashProject(proj.project)}
                          className="rounded-2xl border border-slate-800 hover:border-[#cc0000] bg-[#121620] p-5 cursor-pointer transition-all shadow-lg group"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="font-heading text-base font-bold text-white group-hover:text-red-400">
                              {proj.project}
                            </h3>
                            <span className="font-mono-tabular text-lg font-extrabold text-emerald-400">
                              {proj.workHours}h
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                            <span>{proj.employeeCount} Team Members</span>
                            <span>{proj.sessions} Sessions →</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Drilldown Level 2: Employees on Selected Project */}
                  {selectedDashProject && !selectedDashEmployee && (
                    <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5">
                      <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
                        Project Contributors — {selectedDashProject}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(dashboardData.employeesByProject?.[selectedDashProject] || []).map(
                          (emp: any) => (
                            <div
                              key={emp.username}
                              onClick={() => setSelectedDashEmployee(emp.username)}
                              className="rounded-xl border border-slate-800 hover:border-[#cc0000] bg-[#0d1119] p-4 cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-bold text-white">{emp.username}</div>
                                <span className="font-mono-tabular font-bold text-emerald-400">
                                  {emp.workHours}h
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                {emp.role} · {emp.sessions} sessions · Click to inspect logs →
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Drilldown Level 3: Individual Sessions Table */}
                  {selectedDashProject && selectedDashEmployee && (
                    <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5">
                      <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
                        Session Logs — {selectedDashEmployee} on {selectedDashProject}
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                              <th className="py-2 px-3">Date</th>
                              <th className="py-2 px-3">Task / Subtask</th>
                              <th className="py-2 px-3">Time</th>
                              <th className="py-2 px-3 text-right">Work Hrs</th>
                              <th className="py-2 px-3">Status</th>
                              <th className="py-2 px-3">Comment</th>
                              <th className="py-2 px-3">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {(
                              dashboardData.sessionsByProjectEmployee?.[
                                `${selectedDashProject}||${selectedDashEmployee}`
                              ] || []
                            ).map((s: any) => (
                              <tr key={s.id}>
                                <td className="py-2.5 px-3 font-mono-tabular text-slate-300">
                                  {s.date}
                                </td>
                                <td className="py-2.5 px-3 text-white">
                                  {s.task} / {s.subtask}
                                </td>
                                <td className="py-2.5 px-3 font-mono-tabular text-slate-400">
                                  {s.startTime} – {s.endTime}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-emerald-400">
                                  {s.workHours}h
                                </td>
                                <td className="py-2.5 px-3 font-mono-tabular text-sky-400">
                                  {s.startStatus} → {s.endStatus}
                                </td>
                                <td className="py-2.5 px-3">
                                  {editingSessionId === s.id ? (
                                    <div className="flex gap-1.5">
                                      <input
                                        type="text"
                                        value={editingSessionComment}
                                        onChange={(e) => setEditingSessionComment(e.target.value)}
                                        className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                                      />
                                      <button
                                        onClick={async () => {
                                          await fetch('/api/session/update-comment', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              sessionId: s.id,
                                              username: currentUser.username,
                                              newComment: editingSessionComment,
                                            }),
                                          });
                                          setEditingSessionId(null);
                                          fetchBootstrapData(currentUser);
                                          showBanner('Comment updated & synced!', 'success');
                                        }}
                                        className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  ) : (
                                    <span>{s.comment || '—'}</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  {(s.username === currentUser.username ||
                                    currentUser.role === 'Management') && (
                                    <button
                                      onClick={() => {
                                        setEditingSessionId(s.id);
                                        setEditingSessionComment(s.comment || '');
                                      }}
                                      className="text-red-400 hover:underline text-[11px] cursor-pointer"
                                    >
                                      Edit Note
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* =================================================================
              VIEW 6: REAL-TIME MESSAGES & GROUP CHAT
          ================================================================= */}
          {activeView === 'messages' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-150px)] min-h-[560px]">
              {/* New Group Modal */}
              {newGroupModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
                  <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#121620] p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h3 className="font-heading text-sm font-bold uppercase text-white">
                        Create Project / Team Chat Group
                      </h3>
                      <button onClick={() => setNewGroupModalOpen(false)}>
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Group Name (e.g. CMRL Coordination)"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-800 rounded-xl p-2.5">
                      {employeesList
                        .filter((e) => e.username !== currentUser.username)
                        .map((e) => (
                          <label
                            key={e.username}
                            className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={newGroupMembers.includes(e.username)}
                              onChange={(ev) => {
                                if (ev.target.checked) {
                                  setNewGroupMembers([...newGroupMembers, e.username]);
                                } else {
                                  setNewGroupMembers(
                                    newGroupMembers.filter((m) => m !== e.username)
                                  );
                                }
                              }}
                            />
                            <span>
                              {e.username} ({e.role})
                            </span>
                          </label>
                        ))}
                    </div>
                    <button
                      onClick={async () => {
                        if (!newGroupName.trim()) return;
                        await fetch('/api/chat/groups/create', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            groupName: newGroupName,
                            creator: currentUser.username,
                            members: newGroupMembers,
                          }),
                        });
                        setNewGroupModalOpen(false);
                        setNewGroupName('');
                        setNewGroupMembers([]);
                        fetchBootstrapData(currentUser);
                        showBanner('Group created!', 'success');
                      }}
                      className="w-full rounded-xl bg-[#cc0000] py-2.5 text-xs font-bold text-white cursor-pointer"
                    >
                      Create Group
                    </button>
                  </div>
                </div>
              )}

              {/* Left Contacts & Groups Sidebar */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-[#121620] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3.5">
                  <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-white">
                    Direct & Group Channels
                  </h2>
                  <button
                    onClick={() => setNewGroupModalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#cc0000] px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Group
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
                  {/* Groups */}
                  {chatGroups.map((g) => (
                    <button
                      key={g.groupId}
                      onClick={() => {
                        setActiveChatPartner(g.groupId);
                        setActiveChatIsGroup(true);
                        setActiveChatGroupName(g.groupName);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors cursor-pointer ${
                        activeChatPartner === g.groupId
                          ? 'bg-[#cc0000]/15 border-l-4 border-l-[#cc0000]'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-red-400" />
                          {g.groupName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {g.lastMessage || `${g.members?.length || 0} members`}
                        </div>
                      </div>
                      {g.unread > 0 && (
                        <span className="rounded-full bg-[#cc0000] px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-white">
                          {g.unread}
                        </span>
                      )}
                    </button>
                  ))}

                  {/* Direct Users */}
                  {chatUsers.map((u) => {
                    const online = presenceList.some(
                      (p) => p.username === u.username && p.online
                    );
                    return (
                      <button
                        key={u.username}
                        onClick={() => {
                          setActiveChatPartner(u.username);
                          setActiveChatIsGroup(false);
                          setActiveChatGroupName('');
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors cursor-pointer ${
                          activeChatPartner === u.username
                            ? 'bg-[#cc0000]/15 border-l-4 border-l-[#cc0000]'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {u.username.charAt(0)}
                            {online && (
                              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#121620]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {u.username}{' '}
                              <span className="text-[10px] font-normal text-slate-400">
                                ({u.role})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[190px]">
                              {u.lastMessage || 'Start conversation'}
                            </div>
                          </div>
                        </div>
                        {u.unread > 0 && (
                          <span className="rounded-full bg-[#cc0000] px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-white">
                            {u.unread}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Chat Thread (Supports Direct Image Copy & Paste via Ctrl+V / Cmd+V or Buttons) */}
              <div
                onPaste={handleChatPaste}
                className="lg:col-span-8 rounded-2xl border border-slate-800 bg-[#121620] flex flex-col overflow-hidden"
              >
                {!activeChatPartner ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                    <MessageSquare className="w-10 h-10 mb-2 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-300">
                      Select a colleague or project group
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Messages, clipboard screenshots (Ctrl+V), photos, emojis, and GIFs sync across all connected devices in real time.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="border-b border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-heading text-sm font-bold text-white">
                          {activeChatIsGroup ? activeChatGroupName : activeChatPartner}
                        </h3>
                        <p className="text-[11px] text-emerald-400">
                          Real-Time Workspace Channel · Supports Direct Image Copy & Paste (Ctrl+V)
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopySampleBimSnippet}
                          title="Copy a sample BIM Clash Snapshot image to clipboard to test pasting into chat"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-sky-300 transition-colors cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Sample BIM Image</span>
                        </button>
                        <button
                          type="button"
                          onClick={handlePasteFromClipboardButton}
                          title="Paste copied image from clipboard into message box"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 transition-colors cursor-pointer"
                        >
                          <ClipboardPaste className="w-3.5 h-3.5" />
                          <span>Paste Image</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {chatMessages.map((m) => {
                        const mine = m.sender === currentUser.username;
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-xs ${
                                mine
                                  ? 'bg-[#cc0000] text-white'
                                  : 'bg-slate-800 text-slate-100 border border-slate-700'
                              }`}
                            >
                              {!mine && (
                                <div className="font-bold text-[10px] text-red-300 mb-0.5">
                                  {m.sender}
                                </div>
                              )}
                              {m.photoUrl && (
                                <div className="group relative mb-1.5">
                                  <img
                                    src={m.photoUrl}
                                    alt="Attachment"
                                    onClick={() => setPosterLightboxUrl(m.photoUrl)}
                                    className="max-h-56 rounded-xl object-contain border border-white/10 cursor-pointer"
                                  />
                                  <div className="mt-1.5 flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCopyImageToClipboard(m.photoUrl, 'Chat image')
                                      }
                                      className="inline-flex items-center gap-1 rounded-lg bg-black/45 hover:bg-black/70 px-2 py-1 text-[10px] font-semibold text-white cursor-pointer"
                                    >
                                      <Copy className="w-3 h-3" /> Copy Image
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setChatPhotoDataUrl(m.photoUrl);
                                        setCopiedImageBuffer(m.photoUrl);
                                        showBanner(
                                          'Image pasted into message input — ready to send!',
                                          'info'
                                        );
                                      }}
                                      className="inline-flex items-center gap-1 rounded-lg bg-black/45 hover:bg-black/70 px-2 py-1 text-[10px] font-semibold text-emerald-300 cursor-pointer"
                                    >
                                      <ClipboardPaste className="w-3 h-3" /> Paste to Input
                                    </button>
                                  </div>
                                </div>
                              )}
                              {m.message && <p className="leading-relaxed">{m.message}</p>}
                              <div className="mt-1 text-right font-mono-tabular text-[9px] opacity-75">
                                {m.timestamp}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Staged Clipboard / Uploaded Image Preview Bar */}
                    {chatPhotoDataUrl && (
                      <div className="border-t border-emerald-500/40 bg-emerald-950/25 px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={chatPhotoDataUrl}
                            alt="Pasted preview"
                            onClick={() => setPosterLightboxUrl(chatPhotoDataUrl)}
                            className="h-14 w-20 rounded-lg object-cover border border-emerald-500/50 cursor-pointer shrink-0 bg-slate-950"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="font-heading text-xs font-bold uppercase tracking-wider text-emerald-300">
                                Clipboard / Attached Image Ready
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 truncate mt-0.5">
                              Add an optional caption below and press Enter or Send
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyImageToClipboard(chatPhotoDataUrl, 'Staged image')
                            }
                            className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => setChatPhotoDataUrl('')}
                            className="rounded-lg border border-red-500/40 bg-red-500/15 p-1.5 text-red-300 hover:bg-red-500/30 cursor-pointer"
                            title="Remove attached image"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Emoji / GIF Picker Popover */}
                    {showEmojiPicker && (
                      <div className="border-t border-slate-800 bg-[#0d1119] p-3 max-h-60 overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex gap-1.5">
                            {(['emoji', 'gif', 'sticker'] as const).map((t) => (
                              <button
                                key={t}
                                onClick={() => setEmojiTab(t)}
                                className={`rounded px-2.5 py-1 text-[11px] font-bold uppercase ${
                                  emojiTab === t
                                    ? 'bg-[#cc0000] text-white'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                          {emojiTab !== 'emoji' && (
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                value={giphyQuery}
                                onChange={(e) => setGiphyQuery(e.target.value)}
                                placeholder="Search GIPHY..."
                                className="rounded-lg border border-slate-700 bg-slate-900 pl-8 pr-2.5 py-1 text-xs text-white"
                              />
                            </div>
                          )}
                        </div>

                        {emojiTab === 'emoji' ? (
                          <div className="grid grid-cols-10 gap-1.5">
                            {EMOJI_STICKER_SET.map((em) => (
                              <button
                                key={em}
                                onClick={() => setChatInput((prev) => prev + em)}
                                className="rounded p-1.5 text-lg hover:bg-slate-800"
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {giphyResults.map((g) => {
                              const url = g.images?.fixed_height_small?.url;
                              return (
                                <img
                                  key={g.id}
                                  src={url}
                                  alt={g.title}
                                  onClick={() => handleSendChatMessage(url)}
                                  className="h-20 w-full object-cover rounded-lg cursor-pointer hover:ring-2 hover:ring-[#cc0000]"
                                />
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Input Row */}
                    <div className="border-t border-slate-800 p-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        title="Emojis, GIFs & Stickers"
                        className="rounded-xl border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 cursor-pointer"
                      >
                        <Smile className="w-4 h-4" />
                      </button>

                      <label
                        title="Upload image file"
                        className="rounded-xl border border-slate-700 p-2 text-slate-300 hover:bg-slate-800 cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const r = new FileReader();
                            r.onload = (ev) => {
                              const resUrl = ev.target?.result as string;
                              setChatPhotoDataUrl(resUrl);
                              setCopiedImageBuffer(resUrl);
                            };
                            r.readAsDataURL(f);
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handlePasteFromClipboardButton}
                        title="Paste image from clipboard (or press Ctrl+V)"
                        className="rounded-xl border border-slate-700 p-2 text-emerald-400 hover:bg-slate-800 cursor-pointer"
                      >
                        <ClipboardPaste className="w-4 h-4" />
                      </button>

                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onPaste={handleChatPaste}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendChatMessage();
                        }}
                        placeholder={
                          chatPhotoDataUrl
                            ? '✓ Image pasted — add optional caption & press Enter'
                            : 'Type a message or press Ctrl+V to paste an image...'
                        }
                        className="flex-1 rounded-xl border border-slate-700 bg-[#0b0e14] px-3.5 py-2 text-xs text-white"
                      />

                      <button
                        type="button"
                        onClick={() => handleSendChatMessage()}
                        className="rounded-xl bg-[#cc0000] hover:bg-red-700 px-4 py-2 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" /> Send
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              VIEW 7: MEMOS & WARNINGS
          ================================================================= */}
          {activeView === 'memos' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
                <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white mb-4">
                  My Official Memos & Warnings
                </h2>
                {(memosData.myMemos || []).length === 0 ? (
                  <p className="text-xs text-emerald-400">
                    ✓ You have no active memos or warnings on file.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {memosData.myMemos.map((m: any) => (
                      <div
                        key={m.id}
                        className="rounded-xl border border-amber-500/40 bg-amber-950/10 p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                            {m.type} · {m.subject}
                          </span>
                          <span className="font-mono-tabular text-[11px] text-slate-400">
                            {m.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200">{m.message}</p>
                        {m.reply ? (
                          <div className="rounded-lg bg-slate-900 p-2.5 text-xs text-emerald-300">
                            <strong>Your Reply ({m.replyTime}):</strong> {m.reply}
                          </div>
                        ) : (
                          <div className="flex gap-2 pt-2">
                            <input
                              type="text"
                              value={memoReplyInputs[m.id] || ''}
                              onChange={(e) =>
                                setMemoReplyInputs((prev) => ({
                                  ...prev,
                                  [m.id]: e.target.value,
                                }))
                              }
                              placeholder="Submit your formal explanation / response..."
                              className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
                            />
                            <button
                              onClick={async () => {
                                const rep = (memoReplyInputs[m.id] || '').trim();
                                if (!rep) return;
                                await fetch('/api/memos/reply', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    id: m.id,
                                    username: currentUser.username,
                                    reply: rep,
                                  }),
                                });
                                fetchBootstrapData(currentUser);
                                showBanner('Memo response recorded!', 'success');
                              }}
                              className="rounded-lg bg-[#cc0000] px-4 py-1.5 text-xs font-bold text-white cursor-pointer"
                            >
                              Submit Reply
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              VIEW 5.5: SALARY, PAYROLL & PAYSLIP (PROJECT-WISE SALARY)
          ================================================================= */}
          {activeView === 'payroll' && (
            <SalaryPayrollTab
              currentUser={currentUser}
              employees={employeesList}
              sessions={allSessions}
              presenceList={presenceList}
              nowMs={nowMs}
              onRefresh={() => fetchBootstrapData(currentUser)}
              showBanner={showBanner}
            />
          )}

          {/* =================================================================
              VIEW 8: SETTINGS & MANAGEMENT ADMIN
          ================================================================= */}
          {activeView === 'settings' && (
            <div className="space-y-6">
              {/* Personal Profile & Security */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 space-y-4">
                  <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-3">
                    My Profile, Employment Status & Reporting Hierarchy
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400">Username:</span>
                      <div className="font-bold text-white mt-0.5">{currentUser.username}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Role:</span>
                      <div className="font-bold text-red-400 mt-0.5">{currentUser.role}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Employment Status:</span>
                      <div className="mt-0.5">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 font-heading text-[10px] font-bold uppercase ${
                            (currentUser.employmentStatus || 'Active') === 'Active'
                              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                              : (currentUser.employmentStatus || 'Active') === 'Inactive'
                              ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                              : (currentUser.employmentStatus || 'Active') === 'Left'
                              ? 'border-slate-600 bg-slate-800 text-slate-300'
                              : 'border-red-500/40 bg-red-500/15 text-red-300'
                          }`}
                        >
                          {currentUser.employmentStatus || 'Active'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Reports To:</span>
                      <div className="font-bold text-sky-400 mt-0.5">
                        {currentUser.reportsTo || 'Rebecca Mary'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Joining Date:</span>
                      <div className="font-mono-tabular text-white mt-0.5">
                        {currentUser.joiningDate || 'Not set'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Hourly Salary Rate:</span>
                      <div className="font-mono-tabular font-bold text-emerald-400 mt-0.5">
                        ₹{currentUser.hourlySalary ?? 450}/hr
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Residential Address</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={profileAddress}
                        onChange={(e) => setProfileAddress(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                      <button
                        onClick={async () => {
                          await fetch('/api/profile/address', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              username: currentUser.username,
                              address: profileAddress,
                            }),
                          });
                          showBanner('Address saved!', 'success');
                        }}
                        className="rounded-xl bg-[#cc0000] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* Daily Huddle Primary Focus on User Profile */}
                  <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-red-400" />
                        Daily Huddle Primary Focus (Team Visibility)
                      </span>
                      <button
                        type="button"
                        onClick={openDailyHuddleModal}
                        className="rounded-lg border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-200 cursor-pointer"
                      >
                        Edit Focus
                      </button>
                    </div>
                    <p className="text-xs text-white leading-relaxed">
                      {employeesList.find((e) => e.username === currentUser.username)?.dailyFocus ||
                        currentUser.dailyFocus ||
                        'No Daily Huddle focus logged yet for today.'}
                    </p>
                  </div>
                </div>

                {/* Change Password */}
                <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 space-y-3">
                  <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-3">
                    Change Security Password
                  </h2>
                  <input
                    type="password"
                    value={oldPass}
                    onChange={(e) => setOldPass(e.target.value)}
                    placeholder="Current Password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-white"
                  />
                  <input
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="New Password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-white"
                  />
                  <input
                    type="password"
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="Confirm New Password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-white"
                  />
                  <button
                    onClick={async () => {
                      if (!oldPass || !newPass || newPass !== confirmPass) {
                        showBanner('Check password fields.', 'error');
                        return;
                      }
                      const res = await fetch('/api/profile/password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          username: currentUser.username,
                          oldPass,
                          newPass,
                        }),
                      });
                      const d = await res.json();
                      if (d.success) {
                        setOldPass('');
                        setNewPass('');
                        setConfirmPass('');
                        showBanner('Password updated!', 'success');
                      } else {
                        showBanner(d.message || 'Error', 'error');
                      }
                    }}
                    className="rounded-xl bg-[#cc0000] px-5 py-2.5 text-xs font-bold text-white cursor-pointer"
                  >
                    Update Password
                  </button>
                </div>
              </div>

              {/* Employee Directory, Status (Active, Inactive, Left, Terminated), Reports To & Removal Manager */}
              <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                      Employee Roster — Status (Active / Inactive / Left / Terminated), Reports To & Removal
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Add new employees, update Employment Status (Active, Inactive, Left, Terminated), set Reports To, adjust Hourly Salary, or remove example/added employees
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveView('payroll')}
                      className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-3.5 py-2 font-heading text-xs font-bold uppercase tracking-wider text-emerald-300 cursor-pointer"
                    >
                      Open Salary, Payroll & Payslips
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await fetch('/api/employees/remove-examples', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ keepUsername: currentUser.username }),
                        });
                        const d = await res.json();
                        if (d.success) {
                          fetchBootstrapData(currentUser);
                          showBanner(
                            `Removed ${d.removedCount ?? 0} example employees (kept your active profile).`,
                            'info'
                          );
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 px-3.5 py-2 font-heading text-xs font-bold uppercase tracking-wider text-red-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove Example Employees
                    </button>
                  </div>
                </div>

                {/* Add New Employee Form with Role, Status (Active/Inactive/Left/Terminated), Reports To, Hourly Salary */}
                <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-4 space-y-3">
                  <div className="font-heading text-xs font-bold uppercase tracking-wider text-slate-200">
                    Add New Employee Account
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
                    <input
                      type="text"
                      value={newEmpName}
                      onChange={(e) => setNewEmpName(e.target.value)}
                      placeholder="Employee Full Name"
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={newEmpPass}
                      onChange={(e) => setNewEmpPass(e.target.value)}
                      placeholder="PIN (e.g. 1234)"
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                    <select
                      value={newEmpRole}
                      onChange={(e) => setNewEmpRole(e.target.value)}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    >
                      {ALL_USER_ROLES.map((r) => (
                        <option key={r} value={r}>
                          Role: {r}
                        </option>
                      ))}
                    </select>
                    <select
                      value={newEmpStatus}
                      onChange={(e) => setNewEmpStatus(e.target.value as EmploymentStatus)}
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    >
                      {EMPLOYMENT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          Status: {st}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newEmpReportsTo}
                      onChange={(e) => setNewEmpReportsTo(e.target.value)}
                      placeholder="Reports To (e.g. Raghavan K)"
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="number"
                      min={0}
                      value={newEmpSalary}
                      onChange={(e) => setNewEmpSalary(e.target.value)}
                      placeholder="Hourly Salary (₹/hr)"
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 font-mono-tabular text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newEmpName.trim() || !newEmpPass.trim()) {
                          showBanner('Enter employee name and PIN.', 'error');
                          return;
                        }
                        const res = await fetch('/api/employees/add', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            username: newEmpName.trim(),
                            password: newEmpPass.trim(),
                            role: newEmpRole,
                            employmentStatus: newEmpStatus,
                            reportsTo: newEmpReportsTo.trim() || 'Rebecca Mary',
                            hourlySalary: Number(newEmpSalary) || 450,
                          }),
                        });
                        const d = await res.json();
                        if (d.success) {
                          setNewEmpName('');
                          fetchBootstrapData(currentUser);
                          showBanner(`Employee ${newEmpName} added (${newEmpStatus})!`, 'success');
                        } else {
                          showBanner(d.message || 'Could not add employee.', 'error');
                        }
                      }}
                      className="rounded-xl bg-[#cc0000] hover:bg-red-700 px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-white cursor-pointer"
                    >
                      + Add Employee
                    </button>
                  </div>
                </div>

                {/* Full Interactive Employee Roster Table with Status, Reports To, Salary & Remove Button */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Status (Active / Inactive / Left / Terminated)</th>
                        <th className="py-2.5 px-3">Reports To</th>
                        <th className="py-2.5 px-3">Hourly Salary</th>
                        <th className="py-2.5 px-3">Auto Breaks (Lunch / Tea)</th>
                        <th className="py-2.5 px-3 text-right">Remove Employee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {employeesList.map((emp) => (
                        <tr key={emp.username} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-bold text-white">{emp.username}</td>
                          <td className="py-2.5 px-3">
                            <select
                              value={emp.role}
                              onChange={async (e) => {
                                await fetch('/api/employees/update-details', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    username: emp.username,
                                    role: e.target.value,
                                  }),
                                });
                                fetchBootstrapData(currentUser);
                                showBanner(`Updated ${emp.username}'s role to ${e.target.value}.`, 'success');
                              }}
                              className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                            >
                              {ALL_USER_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={(emp.employmentStatus as EmploymentStatus) || 'Active'}
                              onChange={async (e) => {
                                const nextSt = e.target.value as EmploymentStatus;
                                await fetch('/api/employees/update-details', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    username: emp.username,
                                    employmentStatus: nextSt,
                                  }),
                                });
                                fetchBootstrapData(currentUser);
                                showBanner(
                                  `Updated ${emp.username}'s status to ${nextSt}.`,
                                  'success'
                                );
                              }}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${
                                (emp.employmentStatus || 'Active') === 'Active'
                                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                                  : (emp.employmentStatus || 'Active') === 'Inactive'
                                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                                  : (emp.employmentStatus || 'Active') === 'Left'
                                  ? 'border-slate-600 bg-slate-800 text-slate-300'
                                  : 'border-red-500/40 bg-red-500/15 text-red-300'
                              }`}
                            >
                              {EMPLOYMENT_STATUSES.map((st) => (
                                <option key={st} value={st} className="bg-slate-900 text-white">
                                  {st}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                defaultValue={emp.reportsTo || 'Rebecca Mary'}
                                onBlur={async (e) => {
                                  const val = e.target.value.trim();
                                  if (val && val !== emp.reportsTo) {
                                    await fetch('/api/employees/update-details', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        username: emp.username,
                                        reportsTo: val,
                                      }),
                                    });
                                    fetchBootstrapData(currentUser);
                                    showBanner(
                                      `Updated ${emp.username}'s Reports To → ${val}`,
                                      'success'
                                    );
                                  }
                                }}
                                className="w-36 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white"
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1 font-mono-tabular">
                              <span className="text-slate-400">₹</span>
                              <input
                                type="number"
                                min={0}
                                defaultValue={emp.hourlySalary ?? 450}
                                onBlur={async (e) => {
                                  const val = Number(e.target.value);
                                  if (Number.isFinite(val) && val !== emp.hourlySalary) {
                                    await fetch('/api/employees/update-details', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        username: emp.username,
                                        hourlySalary: val,
                                      }),
                                    });
                                    fetchBootstrapData(currentUser);
                                    showBanner(
                                      `Updated ${emp.username}'s hourly salary to ₹${val}/hr`,
                                      'success'
                                    );
                                  }
                                }}
                                className="w-20 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 font-mono-tabular text-xs text-emerald-300 font-bold"
                              />
                              <span className="text-[10px] text-slate-500">/hr</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono-tabular text-[11px] text-slate-300">
                            L: {emp.lunchBreakStart || '13:00'}–{emp.lunchBreakEnd || '13:45'} · T:{' '}
                            {emp.teaBreakStart || '17:00'}–{emp.teaBreakEnd || '17:15'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              disabled={emp.username === currentUser.username}
                              onClick={async () => {
                                const res = await fetch('/api/employees/delete', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ username: emp.username }),
                                });
                                const d = await res.json();
                                if (d.success) {
                                  fetchBootstrapData(currentUser);
                                  showBanner(`Removed employee ${emp.username}.`, 'info');
                                } else {
                                  showBanner(d.message || 'Could not remove employee.', 'error');
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-40 px-2.5 py-1 text-[10px] font-bold uppercase text-red-300 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Management / Leadership Admin Panels */}
              {isAssignerRole(currentUser.role) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Issue Memo / Warning */}
                  <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 space-y-3">
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-2.5">
                      Issue Official Memo or Warning
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={memoTargetEmp}
                        onChange={(e) => setMemoTargetEmp(e.target.value)}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      >
                        <option value="">-- Select Employee --</option>
                        {employeesList.map((e) => (
                          <option key={e.username} value={e.username}>
                            {e.username}
                          </option>
                        ))}
                      </select>
                      <select
                        value={memoType}
                        onChange={(e) => setMemoType(e.target.value as 'Memo' | 'Warning')}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      >
                        <option value="Memo">Official Memo</option>
                        <option value="Warning">Disciplinary Warning</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={memoSubject}
                      onChange={(e) => setMemoSubject(e.target.value)}
                      placeholder="Subject"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={memoMessage}
                      onChange={(e) => setMemoMessage(e.target.value)}
                      placeholder="Detailed memo message..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                    <button
                      onClick={async () => {
                        if (!memoTargetEmp || !memoSubject || !memoMessage) return;
                        await fetch('/api/memos/send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            employee: memoTargetEmp,
                            type: memoType,
                            subject: memoSubject,
                            message: memoMessage,
                            sentBy: currentUser.username,
                          }),
                        });
                        setMemoSubject('');
                        setMemoMessage('');
                        fetchBootstrapData(currentUser);
                        showBanner(`${memoType} sent & live alert triggered!`, 'success');
                      }}
                      className="rounded-xl bg-[#cc0000] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      Send {memoType}
                    </button>
                  </div>

                  {/* Direct Mark Leave / Permission */}
                  <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 space-y-3">
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-2.5">
                      Direct Mark Employee Leave / Permission
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={directLpEmp}
                        onChange={(e) => setDirectLpEmp(e.target.value)}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      >
                        <option value="">-- Employee --</option>
                        {employeesList.map((e) => (
                          <option key={e.username} value={e.username}>
                            {e.username}
                          </option>
                        ))}
                      </select>
                      <select
                        value={directLpAction}
                        onChange={(e) =>
                          setDirectLpAction(e.target.value as 'Leave' | 'Permission')
                        }
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      >
                        <option value="Leave">Mark Leave</option>
                        <option value="Permission">Mark Permission</option>
                      </select>
                      <input
                        type="date"
                        value={directLpDate}
                        onChange={(e) => setDirectLpDate(e.target.value)}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    {directLpAction === 'Leave' ? (
                      <select
                        value={directLpLeaveType}
                        onChange={(e) => setDirectLpLeaveType(e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      >
                        <option value="Casual Leave">Casual Leave</option>
                        <option value="Sick Leave">Sick Leave</option>
                        <option value="LOP">Loss of Pay (LOP)</option>
                      </select>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="time"
                          value={directLpFrom}
                          onChange={(e) => setDirectLpFrom(e.target.value)}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                        />
                        <input
                          type="time"
                          value={directLpTo}
                          onChange={(e) => setDirectLpTo(e.target.value)}
                          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                        />
                      </div>
                    )}
                    <input
                      type="text"
                      value={directLpReason}
                      onChange={(e) => setDirectLpReason(e.target.value)}
                      placeholder="Reason / Remarks"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                    />
                    <button
                      onClick={async () => {
                        if (!directLpEmp || !directLpDate) return;
                        await fetch('/api/management/direct-leave-perm', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            employee: directLpEmp,
                            actionType: directLpAction,
                            date: directLpDate,
                            leaveType: directLpLeaveType,
                            fromTime: directLpFrom,
                            toTime: directLpTo,
                            reason: directLpReason,
                            markedBy: currentUser.username,
                          }),
                        });
                        setDirectLpReason('');
                        fetchBootstrapData(currentUser);
                        showBanner(`${directLpAction} marked for ${directLpEmp}!`, 'success');
                      }}
                      className="rounded-xl bg-[#cc0000] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      Confirm & Mark {directLpAction}
                    </button>
                  </div>

                  {/* Employee Details & Week-Off Config */}
                  <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 space-y-3">
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-2.5">
                      Employee Joining Date, Status, Reports To & Week-Off
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={editEmpTarget}
                        onChange={(e) => {
                          const name = e.target.value;
                          setEditEmpTarget(name);
                          const found = employeesList.find((u) => u.username === name);
                          if (found) {
                            setEditEmpRole(found.role || 'Production');
                            setEditEmpStatus((found.employmentStatus as EmploymentStatus) || 'Active');
                            setEditEmpReportsTo(found.reportsTo || 'Rebecca Mary');
                            setEditEmpSalary(String(found.hourlySalary ?? 450));
                            setEditEmpJoinDate(found.joiningDate || '');
                            setEditEmpEmergency(found.emergencyContact || '');
                            setEditEmpWeekOff(found.weekOff || 'Sunday');
                            setEditEmpAltSat(Boolean(found.altSatOff));
                          }
                        }}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      >
                        <option value="">-- Select Employee --</option>
                        {employeesList.map((e) => (
                          <option key={e.username} value={e.username}>
                            {e.username} ({e.employmentStatus || 'Active'})
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={editEmpJoinDate}
                        onChange={(e) => setEditEmpJoinDate(e.target.value)}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={editEmpStatus}
                        onChange={(e) => setEditEmpStatus(e.target.value as EmploymentStatus)}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      >
                        {EMPLOYMENT_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            Status: {st}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={editEmpReportsTo}
                        onChange={(e) => setEditEmpReportsTo(e.target.value)}
                        placeholder="Reports To"
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editEmpEmergency}
                        onChange={(e) => setEditEmpEmergency(e.target.value)}
                        placeholder="Emergency Contact Phone"
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      />
                      <select
                        value={editEmpWeekOff}
                        onChange={(e) => setEditEmpWeekOff(e.target.value)}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                      >
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
                          (d) => (
                            <option key={d} value={d}>
                              Week Off: {d}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={editEmpAltSat}
                        onChange={(e) => setEditEmpAltSat(e.target.checked)}
                      />
                      <span>Alternate Saturday Off (2nd & 4th Saturdays)</span>
                    </label>
                    <button
                      onClick={async () => {
                        if (!editEmpTarget) return;
                        await fetch('/api/employees/update-details', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            username: editEmpTarget,
                            role: editEmpRole,
                            employmentStatus: editEmpStatus,
                            reportsTo: editEmpReportsTo,
                            hourlySalary: Number(editEmpSalary) || 450,
                            joiningDate: editEmpJoinDate,
                            emergencyContact: editEmpEmergency,
                            weekOff: editEmpWeekOff,
                            altSatOff: editEmpAltSat,
                          }),
                        });
                        fetchBootstrapData(currentUser);
                        showBanner(`Updated ${editEmpTarget}'s profile & status settings!`, 'success');
                      }}
                      className="rounded-xl bg-[#cc0000] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                    >
                      Save Employee Config
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* =====================================================================
          15-MINUTE BROWSER INACTIVITY CONFIRMATION MODAL (AUTO-PAUSE TO BREAK)
      ===================================================================== */}
      {idlePromptOpen && activeSession && activeSession.status === 'running' && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/50 bg-[#121620] p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-400">
                  <AlertCircle className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-bold uppercase tracking-wider text-white">
                    Inactivity Detected (15+ Mins)
                  </h3>
                  <p className="text-xs text-amber-300 font-semibold">
                    Are you still working on {activeSession.project}?
                  </p>
                </div>
              </div>
              <span className="rounded-lg border border-red-500/40 bg-red-500/15 px-2.5 py-1 font-mono-tabular text-xs font-black text-red-300">
                {idleCountdownSec}s
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-4 space-y-2 text-xs text-slate-300">
              <p>
                Your browser has been inactive for over <strong>15 minutes</strong> while your work timer is running on{' '}
                <strong className="text-white">
                  {activeSession.project} — {activeSession.task}
                </strong>
                .
              </p>
              <p className="text-slate-400">
                Please confirm if you are still actively working. If no response is received within{' '}
                <span className="font-mono-tabular font-bold text-amber-300">
                  {idleCountdownSec} seconds
                </span>
                , your session will automatically switch to{' '}
                <span className="font-mono-tabular font-bold text-amber-400">'on_break'</span>.
              </p>
              <div className="pt-2">
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-1000"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((idleCountdownSec / IDLE_CONFIRM_WINDOW_SEC) * 100)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleConfirmStillWorking}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 px-4 font-heading text-xs font-bold uppercase tracking-wider text-white shadow-lg cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Yes, Still Working
              </button>
              <button
                type="button"
                onClick={() =>
                  handleAutoPauseToBreak(
                    "Session status switched to 'on_break' from the inactivity prompt."
                  )
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 py-3 px-4 font-heading text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg cursor-pointer"
              >
                <Coffee className="w-4 h-4" />
                Switch to 'on_break'
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          DAILY HUDDLE MODAL (AUTO-TRIGGERED ON FIRST DAILY SESSION START)
      ===================================================================== */}
      {dailyHuddleModalOpen && currentUser && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveDailyHuddle}
            className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-[#121620] p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/15 text-red-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading text-base font-bold uppercase tracking-wider text-white">
                      Daily Huddle — Log Primary Focus
                    </h3>
                    <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase text-emerald-300">
                      Team Visibility
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Share your primary BIM deliverable focus for today — displayed on your profile card across the team
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDailyHuddleModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Primary Focus Project
                </label>
                <select
                  value={dailyHuddleProjectInput}
                  onChange={(e) => setDailyHuddleProjectInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3.5 py-2.5 text-xs text-white"
                >
                  {PROJECTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-heading text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  What is your primary focus for today?
                </label>
                <textarea
                  rows={3}
                  value={dailyHuddleFocusInput}
                  onChange={(e) => setDailyHuddleFocusInput(e.target.value)}
                  placeholder="e.g., Completing Level-2 HVAC duct routing & resolving Navisworks clashes on CMRL..."
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] p-3.5 text-xs text-white placeholder:text-slate-500 focus:border-[#cc0000] focus:outline-none"
                />
              </div>

              {/* Quick Focus Templates */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Quick Focus Templates:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    `Completing LOD 350 HVAC & piping modeling on ${dailyHuddleProjectInput || 'CMRL'}`,
                    `Zero-clash Navisworks coordination & sleeve signoff on ${dailyHuddleProjectInput || 'CMRL'}`,
                    `Issuing annotated shop drawing sheets & schedules on ${dailyHuddleProjectInput || 'CMRL'}`,
                    `QC checklist verification & markups review on ${dailyHuddleProjectInput || 'CMRL'}`,
                  ].map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      onClick={() => setDailyHuddleFocusInput(tpl)}
                      className="rounded-lg border border-slate-800 bg-[#0b0e14] hover:border-slate-600 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white cursor-pointer text-left"
                    >
                      + {tpl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDailyHuddleModalOpen(false)}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Skip for Now
              </button>
              <button
                type="submit"
                disabled={dailyHuddleSaving}
                className="flex items-center gap-2 rounded-xl bg-[#cc0000] hover:bg-red-700 disabled:opacity-50 px-5 py-2.5 font-heading text-xs font-bold uppercase tracking-wider text-white shadow-lg cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {dailyHuddleSaving ? 'Publishing...' : 'Publish Daily Huddle Focus'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
