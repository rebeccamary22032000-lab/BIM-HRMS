import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Download,
  Users,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
  Edit3,
  Laptop,
  Calendar,
  Settings,
  Briefcase,
  Search,
  Eye,
  X,
  RefreshCw,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  PROJECTS,
  User,
  PresenceItem,
  EMPLOYMENT_STATUSES,
  EmploymentStatus,
  ALL_USER_ROLES,
  AttendanceRulesConfig,
  DEFAULT_ATTENDANCE_RULES,
} from '../constants';

interface SalaryPayrollTabProps {
  currentUser: User;
  employees: User[];
  sessions: any[];
  presenceList: PresenceItem[];
  nowMs: number;
  onRefresh: () => void;
  showBanner: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// Helper to convert numbers to Indian Rupees in words (e.g., 19665 -> "Nineteen Thousand Six Hundred Sixty Five Rupees Only")
function numberToIndianWords(num: number): string {
  const n = Math.max(0, Math.round(num));
  if (n === 0) return 'Zero Rupees Only';

  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];

  const twoDigitWords = (val: number): string => {
    if (val === 0) return '';
    if (val < 20) return ones[val];
    const t = Math.floor(val / 10);
    const o = val % 10;
    return `${tens[t]}${o > 0 ? ' ' + ones[o] : ''}`;
  };

  let rem = n;
  const parts: string[] = [];

  const crore = Math.floor(rem / 10000000);
  rem %= 10000000;
  if (crore > 0) parts.push(`${twoDigitWords(crore)} Crore`);

  const lakh = Math.floor(rem / 100000);
  rem %= 100000;
  if (lakh > 0) parts.push(`${twoDigitWords(lakh)} Lakh`);

  const thousand = Math.floor(rem / 1000);
  rem %= 1000;
  if (thousand > 0) parts.push(`${twoDigitWords(thousand)} Thousand`);

  const hundred = Math.floor(rem / 100);
  rem %= 100;
  if (hundred > 0) parts.push(`${ones[hundred]} Hundred`);

  if (rem > 0) parts.push(twoDigitWords(rem));

  return `${parts.join(' ')} Rupees Only`;
}

// Parse "9:20 AM" or "7:00 PM" into minutes since midnight; returns null for "-", "Holiday", "WO", "CL", "SL", "Comp"
function parseClockToMinutes(raw: string): number | null {
  const s = (raw || '').trim().toUpperCase();
  if (!s || s === '-' || ['HOLIDAY', 'WO', 'COMP', 'CL', 'SL'].includes(s)) return null;
  const match12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hh = parseInt(match12[1], 10);
    const mm = parseInt(match12[2], 10);
    const mer = match12[3].toUpperCase();
    if (mer === 'PM' && hh < 12) hh += 12;
    if (mer === 'AM' && hh === 12) hh = 0;
    return hh * 60 + mm;
  }
  const match24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hh = parseInt(match24[1], 10);
    const mm = parseInt(match24[2], 10);
    return hh * 60 + mm;
  }
  return null;
}

function formatMinutesToClock12(totalMins: number): string {
  const norm = ((Math.round(totalMins) % 1440) + 1440) % 1440;
  const h24 = Math.floor(norm / 60);
  const mm = norm % 60;
  const mer = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${mer}`;
}

function formatDurationHHMM(mins: number): string {
  if (mins <= 0) return '-';
  const m = Math.round(mins);
  const hh = Math.floor(m / 60);
  const rem = m % 60;
  return `${String(hh).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export interface MonthlyAttendanceSummaryRow {
  empCode: string;
  name: string;
  department: string;
  role: string;
  weekOff: number;
  present: number;
  presentLate: number;
  presentEarlyOut: number;
  holiday: number;
  cl: number;
  sl: number;
  absent: number;
  permMorning: number;
  permEvening: number;
  firstHalfLeave: number;
  secondHalfLeave: number;
  compensation: number;
  empWorkingDays: number;
  presentDays: number;
  continuesLeave: number;
  totalWorkingDays: number;
  checkPunch: number;
  graceDays: number;
  lateHours: string;
  permissionHours: string;
  earlyOutHours: string;
  extraHours: string;
  totalHoursWorked: string;
  screenTimeHours: string;
  sandwichLeaveDays: number;
  totalLeaveDays: number;
  // Payroll & Payslip specific editable fields (Image 5)
  workedDay: number;
  paidLeaves: number;
  totalPayableDays: number;
  totalSalary: number;
  basicSalary: number;
  penalties: number;
}

export interface DailyAttendanceEntry {
  id: string;
  dayName: string;
  date: string;
  employeeName: string;
  shiftIn: string;
  inTime: string;
  shiftOut: string;
  outTime: string;
  screenTime: string;
  weekOffDay: string;
  prevWorkingDayStatus: string;
  nextWorkingDayStatus: string;
  sandwichLeave: string;
  consecutiveLeaveDays: number;
  leaveBlockTotal: string;
}

const INITIAL_DAILY_PUNCHES: DailyAttendanceEntry[] = [
  { id: 'd_1', dayName: 'Thursday', date: '01-10-2026', employeeName: 'SELVAN A', shiftIn: '9:00 AM', inTime: '9:20 AM', shiftOut: '6:00 PM', outTime: '7:00 PM', screenTime: '09:15', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_2', dayName: 'Thursday', date: '01-10-2026', employeeName: 'HASAN FAMEERDEEN S', shiftIn: '9:00 AM', inTime: '9:00 AM', shiftOut: '6:00 PM', outTime: '6:45 PM', screenTime: '09:20', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_3', dayName: 'Thursday', date: '01-10-2026', employeeName: 'SURYA B', shiftIn: '9:00 AM', inTime: '9:20 AM', shiftOut: '6:00 PM', outTime: '7:01 PM', screenTime: '09:18', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_4', dayName: 'Thursday', date: '01-10-2026', employeeName: 'ABHISHEK V', shiftIn: '9:00 AM', inTime: '9:20 AM', shiftOut: '6:00 PM', outTime: '7:05 PM', screenTime: '09:22', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_5', dayName: 'Thursday', date: '01-10-2026', employeeName: 'SANJAY D', shiftIn: '9:00 AM', inTime: '-', shiftOut: '6:00 PM', outTime: '-', screenTime: '00:00', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 1, leaveBlockTotal: '1' },
  { id: 'd_6', dayName: 'Thursday', date: '01-10-2026', employeeName: 'SARAVANA KUMAR BP', shiftIn: '9:00 AM', inTime: '9:15 AM', shiftOut: '6:00 PM', outTime: '6:42 PM', screenTime: '09:05', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_7', dayName: 'Thursday', date: '01-10-2026', employeeName: 'KATTU BAVA K', shiftIn: '9:00 AM', inTime: '9:30 AM', shiftOut: '6:00 PM', outTime: '7:48 PM', screenTime: '09:55', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_8', dayName: 'Thursday', date: '01-10-2026', employeeName: 'THASLEEMA A', shiftIn: '9:00 AM', inTime: '8:44 AM', shiftOut: '5:00 PM', outTime: '5:04 PM', screenTime: '08:05', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_9', dayName: 'Thursday', date: '01-10-2026', employeeName: 'KARTHI G', shiftIn: '9:00 AM', inTime: '9:11 AM', shiftOut: '6:00 PM', outTime: '7:27 PM', screenTime: '09:50', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_10', dayName: 'Thursday', date: '01-10-2026', employeeName: 'G AKASH', shiftIn: '9:00 AM', inTime: '-', shiftOut: '6:00 PM', outTime: '-', screenTime: '00:00', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 1, leaveBlockTotal: '-' },
  { id: 'd_11', dayName: 'Thursday', date: '01-10-2026', employeeName: 'J MOHAMED HASIK', shiftIn: '9:00 AM', inTime: '9:38 AM', shiftOut: '6:00 PM', outTime: '7:28 PM', screenTime: '09:28', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_12', dayName: 'Thursday', date: '01-10-2026', employeeName: 'SURYA PRAKASH', shiftIn: '9:00 AM', inTime: '-', shiftOut: '6:00 PM', outTime: '-', screenTime: '00:00', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 1, leaveBlockTotal: '-' },
  { id: 'd_13', dayName: 'Thursday', date: '01-10-2026', employeeName: 'REBECCA MARY REETHU P', shiftIn: '9:00 AM', inTime: '9:11 AM', shiftOut: '6:00 PM', outTime: '1:03 PM', screenTime: '03:45', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_14', dayName: 'Thursday', date: '01-10-2026', employeeName: 'KIRI PAVAN', shiftIn: '9:00 AM', inTime: '9:26 AM', shiftOut: '6:00 PM', outTime: '6:01 PM', screenTime: '08:15', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_15', dayName: 'Thursday', date: '01-10-2026', employeeName: 'TAMIZHARASAN', shiftIn: '9:00 AM', inTime: '-', shiftOut: '6:00 PM', outTime: '-', screenTime: '00:00', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 1, leaveBlockTotal: '-' },
  { id: 'd_16', dayName: 'Thursday', date: '01-10-2026', employeeName: 'GOKULNATH', shiftIn: '9:00 AM', inTime: '9:25 AM', shiftOut: '6:00 PM', outTime: '6:51 PM', screenTime: '09:10', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_17', dayName: 'Thursday', date: '01-10-2026', employeeName: 'DEEPAK', shiftIn: '9:00 AM', inTime: '9:33 AM', shiftOut: '6:00 PM', outTime: '6:49 PM', screenTime: '08:58', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_18', dayName: 'Thursday', date: '01-10-2026', employeeName: 'JANARTHANAN', shiftIn: '9:00 AM', inTime: '9:33 AM', shiftOut: '6:00 PM', outTime: '7:48 PM', screenTime: '09:52', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_19', dayName: 'Thursday', date: '01-10-2026', employeeName: 'MARI SELVAM', shiftIn: '9:00 AM', inTime: '-', shiftOut: '6:00 PM', outTime: '-', screenTime: '00:00', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 1, leaveBlockTotal: '-' },
  { id: 'd_20', dayName: 'Thursday', date: '01-10-2026', employeeName: 'THANZEELER RAHMAN', shiftIn: '9:00 AM', inTime: '9:28 AM', shiftOut: '6:00 PM', outTime: '6:56 PM', screenTime: '09:12', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_21', dayName: 'Thursday', date: '01-10-2026', employeeName: 'KARTHI M', shiftIn: '9:00 AM', inTime: '9:41 AM', shiftOut: '6:00 PM', outTime: '7:40 PM', screenTime: '09:38', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_22', dayName: 'Thursday', date: '01-10-2026', employeeName: 'SONAIMUTHU V', shiftIn: '9:00 AM', inTime: '9:49 AM', shiftOut: '6:00 PM', outTime: '8:07 PM', screenTime: '09:56', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_23', dayName: 'Thursday', date: '01-10-2026', employeeName: 'MOHANAKRISHNAN', shiftIn: '9:00 AM', inTime: '-', shiftOut: '6:00 PM', outTime: '-', screenTime: '00:00', weekOffDay: '-', prevWorkingDayStatus: '-', nextWorkingDayStatus: '-', sandwichLeave: '-', consecutiveLeaveDays: 1, leaveBlockTotal: '-' },
  { id: 'd_24', dayName: 'Friday', date: '02-10-2026', employeeName: 'SELVAN A', shiftIn: '9:00 AM', inTime: 'Holiday', shiftOut: '6:00 PM', outTime: 'Holiday', screenTime: '00:00', weekOffDay: '-', prevWorkingDayStatus: 'Present', nextWorkingDayStatus: 'Present', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_25', dayName: 'Friday', date: '02-10-2026', employeeName: 'HASAN FAMEERDEEN S', shiftIn: '9:00 AM', inTime: 'Holiday', shiftOut: '6:00 PM', outTime: 'Holiday', screenTime: '00:00', weekOffDay: '-', prevWorkingDayStatus: 'Present', nextWorkingDayStatus: 'Present', sandwichLeave: '-', consecutiveLeaveDays: 0, leaveBlockTotal: '-' },
  { id: 'd_26', dayName: 'Friday', date: '02-10-2026', employeeName: 'G AKASH', shiftIn: '9:00 AM', inTime: 'Holiday', shiftOut: '6:00 PM', outTime: 'Holiday', screenTime: '00:00', weekOffDay: '-', prevWorkingDayStatus: 'Absent', nextWorkingDayStatus: 'Absent', sandwichLeave: 'Sandwich Leave', consecutiveLeaveDays: 2, leaveBlockTotal: '-' },
];

const INITIAL_SUMMARY_BY_NAME: Record<string, Partial<MonthlyAttendanceSummaryRow>> = {
  'SONAIMUTHU V': { empCode: '1001', department: 'CO-ORDINATOR', role: 'SENIOR BIM MODELER-MECHANICAL', weekOff: 6, present: 5, presentLate: 13, presentEarlyOut: 0, holiday: 2, cl: 0, sl: 0, absent: 1, permMorning: 0, permEvening: 0, firstHalfLeave: 0, secondHalfLeave: 0, compensation: 0, empWorkingDays: 27, presentDays: 26, continuesLeave: 0, totalWorkingDays: 30, checkPunch: 1, graceDays: 6, lateHours: '2:41', permissionHours: '0:00', earlyOutHours: '0:00', extraHours: '26:08', totalHoursWorked: '174:27', screenTimeHours: '168:30', sandwichLeaveDays: 0, totalLeaveDays: 1, workedDay: 20, paidLeaves: 2, totalPayableDays: 28, totalSalary: 32000, basicSalary: 29866.67, penalties: 0 },
  'KARTHI M': { empCode: '1013', department: 'MEP-ELECTRICAL', role: 'BIM MODELER-ELECTRICAL', weekOff: 1, present: 4, presentLate: 1, presentEarlyOut: 0, holiday: 1, cl: 0, sl: 0, absent: 20, permMorning: 0, permEvening: 0, firstHalfLeave: 1, secondHalfLeave: 0, compensation: 0, empWorkingDays: 28, presentDays: 8, continuesLeave: 20, totalWorkingDays: 30, checkPunch: 0, graceDays: 4, lateHours: '0:11', permissionHours: '0:00', earlyOutHours: '0:00', extraHours: '6:11', totalHoursWorked: '54:48', screenTimeHours: '52:24', sandwichLeaveDays: 5, totalLeaveDays: 20, workedDay: 6, paidLeaves: 1, totalPayableDays: 8, totalSalary: 24000, basicSalary: 6400.0, penalties: 0 },
  'THANZEELER RAHMAN': { empCode: '1017', department: 'MEP-MECHANICAL', role: 'BIM MODELER-MECHANICAL', weekOff: 6, present: 19, presentLate: 0, presentEarlyOut: 0, holiday: 2, cl: 0, sl: 0, absent: 0, permMorning: 0, permEvening: 0, firstHalfLeave: 0, secondHalfLeave: 0, compensation: 0, empWorkingDays: 27, presentDays: 27, continuesLeave: 0, totalWorkingDays: 30, checkPunch: 1, graceDays: 20, lateHours: '0:00', permissionHours: '0:00', earlyOutHours: '0:00', extraHours: '5:45', totalHoursWorked: '176:45', screenTimeHours: '171:12', sandwichLeaveDays: 0, totalLeaveDays: 0, workedDay: 21, paidLeaves: 3, totalPayableDays: 30, totalSalary: 25000, basicSalary: 25000.0, penalties: 0 },
  'MARI SELVAM': { empCode: '1018', department: 'MEP-BIM', role: 'BIM MODELER-MECHANICAL', weekOff: 7, present: 16, presentLate: 0, presentEarlyOut: 0, holiday: 0, cl: 3, sl: 0, absent: 4, permMorning: 0, permEvening: 0, firstHalfLeave: 0, secondHalfLeave: 0, compensation: 0, empWorkingDays: 28, presentDays: 16, continuesLeave: 4, totalWorkingDays: 31, checkPunch: 0, graceDays: 14, lateHours: '0:00', permissionHours: '0:00', earlyOutHours: '0:00', extraHours: '4:15', totalHoursWorked: '148:20', screenTimeHours: '142:00', sandwichLeaveDays: 0, totalLeaveDays: 7, workedDay: 16, paidLeaves: 3, totalPayableDays: 26, totalSalary: 23500, basicSalary: 19709.68, penalties: 44.8 },
  'JANARTHANAN': { empCode: '1020', department: 'MEP-MECHANICAL', role: 'BIM MODELER-MECHANICAL', weekOff: 6, present: 15, presentLate: 4, presentEarlyOut: 0, holiday: 2, cl: 0, sl: 0, absent: 0, permMorning: 0, permEvening: 0, firstHalfLeave: 0, secondHalfLeave: 0, compensation: 0, empWorkingDays: 27, presentDays: 27, continuesLeave: 0, totalWorkingDays: 30, checkPunch: 1, graceDays: 16, lateHours: '0:44', permissionHours: '0:00', earlyOutHours: '0:00', extraHours: '11:05', totalHoursWorked: '177:51', screenTimeHours: '172:48', sandwichLeaveDays: 0, totalLeaveDays: 0, workedDay: 21, paidLeaves: 3, totalPayableDays: 30, totalSalary: 25000, basicSalary: 25000.0, penalties: 0 },
  'DEEPAK': { empCode: '1021', department: 'MEP-ELECTRICAL', role: 'BIM MODELER-ELECTRICAL', weekOff: 6, present: 1, presentLate: 16, presentEarlyOut: 0, holiday: 2, cl: 0, sl: 0, absent: 1, permMorning: 1, permEvening: 0, firstHalfLeave: 0, secondHalfLeave: 0, compensation: 0, empWorkingDays: 27, presentDays: 26, continuesLeave: 0, totalWorkingDays: 30, checkPunch: 1, graceDays: 2, lateHours: '1:50', permissionHours: '0:39', earlyOutHours: '0:00', extraHours: '17:01', totalHoursWorked: '168:02', screenTimeHours: '163:30', sandwichLeaveDays: 0, totalLeaveDays: 1, workedDay: 20, paidLeaves: 3, totalPayableDays: 29, totalSalary: 24500, basicSalary: 23683.33, penalties: 0 },
  'GOKULNATH': { empCode: '1025', department: 'MEP-MECHANICAL', role: 'Jr.BIM MODELER-MECHANICAL', weekOff: 6, present: 15, presentLate: 3, presentEarlyOut: 0, holiday: 2, cl: 0, sl: 0, absent: 1, permMorning: 0, permEvening: 0, firstHalfLeave: 0, secondHalfLeave: 0, compensation: 0, empWorkingDays: 27, presentDays: 26, continuesLeave: 0, totalWorkingDays: 30, checkPunch: 1, graceDays: 16, lateHours: '0:05', permissionHours: '0:00', earlyOutHours: '0:00', extraHours: '18:41', totalHoursWorked: '179:06', screenTimeHours: '174:12', sandwichLeaveDays: 0, totalLeaveDays: 1, workedDay: 20, paidLeaves: 3, totalPayableDays: 29, totalSalary: 19500, basicSalary: 18850.0, penalties: 0 },
  'TAMIZHARASAN': { empCode: '1029', department: 'MEP-MECHANICAL', role: 'Jr.BIM MODELER-MECHANICAL', weekOff: 6, present: 14, presentLate: 2, presentEarlyOut: 0, holiday: 1, cl: 0, sl: 0, absent: 3, permMorning: 0, permEvening: 1, firstHalfLeave: 0, secondHalfLeave: 0, compensation: 0, empWorkingDays: 27, presentDays: 24, continuesLeave: 0, totalWorkingDays: 30, checkPunch: 1, graceDays: 16, lateHours: '0:09', permissionHours: '1:23', earlyOutHours: '0:00', extraHours: '14:50', totalHoursWorked: '165:18', screenTimeHours: '160:24', sandwichLeaveDays: 0, totalLeaveDays: 3, workedDay: 18, paidLeaves: 3, totalPayableDays: 27, totalSalary: 19500, basicSalary: 17550.0, penalties: 0 },
  'REBECCA MARY REETHU P': { empCode: '1031', department: 'BIM-HR/ADMIN', role: 'BIM-HR/ADMIN', weekOff: 8, present: 7, presentLate: 1, presentEarlyOut: 1, holiday: 2, cl: 0, sl: 0, absent: 6, permMorning: 0, permEvening: 0, firstHalfLeave: 0, secondHalfLeave: 2, compensation: 0, empWorkingDays: 27, presentDays: 21, continuesLeave: 0, totalWorkingDays: 30, checkPunch: 1, graceDays: 11, lateHours: '0:02', permissionHours: '0:00', earlyOutHours: '0:32', extraHours: '1:57', totalHoursWorked: '87:42', screenTimeHours: '85:30', sandwichLeaveDays: 0, totalLeaveDays: 6, workedDay: 16, paidLeaves: 2, totalPayableDays: 26, totalSalary: 35000, basicSalary: 30333.33, penalties: 0 },
  'KIRI PAVAN': { empCode: '1034', department: 'MEP-ELECTRICAL', role: 'Jr.BIM MODELER -ELECTRICAL', weekOff: 4, present: 3, presentLate: 6, presentEarlyOut: 0, holiday: 2, cl: 0, sl: 0, absent: 10, permMorning: 2, permEvening: 1, firstHalfLeave: 0, secondHalfLeave: 0, compensation: 0, empWorkingDays: 28, presentDays: 18, continuesLeave: 0, totalWorkingDays: 30, checkPunch: 0, graceDays: 4, lateHours: '1:59', permissionHours: '1:33', earlyOutHours: '0:00', extraHours: '6:26', totalHoursWorked: '106:54', screenTimeHours: '102:18', sandwichLeaveDays: 2, totalLeaveDays: 10, workedDay: 14, paidLeaves: 2, totalPayableDays: 20, totalSalary: 19000, basicSalary: 12666.67, penalties: 0 },
  'SURYA PRAKASH': { empCode: '1037', department: 'MEP-MECHANICAL', role: 'Jr.BIM MODELER-MECHANICAL', weekOff: 3, present: 7, presentLate: 2, presentEarlyOut: 0, holiday: 1, cl: 0, sl: 0, absent: 14, permMorning: 0, permEvening: 0, firstHalfLeave: 0, secondHalfLeave: 0, compensation: 0, empWorkingDays: 27, presentDays: 13, continuesLeave: 0, totalWorkingDays: 30, checkPunch: 1, graceDays: 8, lateHours: '0:34', permissionHours: '0:00', earlyOutHours: '0:00', extraHours: '13:29', totalHoursWorked: '91:25', screenTimeHours: '88:36', sandwichLeaveDays: 3, totalLeaveDays: 14, workedDay: 10, paidLeaves: 2, totalPayableDays: 16, totalSalary: 19000, basicSalary: 10133.33, penalties: 0 },
};

export const SalaryPayrollTab: React.FC<SalaryPayrollTabProps> = ({
  employees,
  sessions,
  presenceList,
  nowMs,
  onRefresh,
  showBanner,
}) => {
  // Top-level Mode Switcher: 'attendance' (Attendance-Wise + Official Payslip) vs 'project' (Project-Wise Salary)
  const [payrollMode, setPayrollMode] = useState<'attendance' | 'project'>('attendance');

  // Sub-tabs inside Attendance-Wise Mode matching all 5 uploaded images
  const [attSubTab, setAttSubTab] = useState<
    'payslip' | 'summary' | 'daily' | 'shifts' | 'rules'
  >('payslip');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL');

  // Attendance Rules State (Image 4 - Blue cells are inputs)
  const [rules, setRules] = useState<AttendanceRulesConfig>(DEFAULT_ATTENDANCE_RULES);

  // Daily Attendance Rows State (Image 1 - Editable In/Out & Screen Time)
  const [dailyRows, setDailyRows] = useState<DailyAttendanceEntry[]>(INITIAL_DAILY_PUNCHES);
  const [newDailyEmp, setNewDailyEmp] = useState<string>('MARI SELVAM');
  const [newDailyDate, setNewDailyDate] = useState<string>('03-10-2026');
  const [newDailyDay, setNewDailyDay] = useState<string>('Saturday');
  const [newDailyIn, setNewDailyIn] = useState<string>('9:15 AM');
  const [newDailyOut, setNewDailyOut] = useState<string>('6:30 PM');

  // Monthly Attendance Summary & Payslip Overrides State (Image 2 & Image 5)
  const [summaryOverrides, setSummaryOverrides] = useState<
    Record<string, Partial<MonthlyAttendanceSummaryRow>>
  >(INITIAL_SUMMARY_BY_NAME);

  // Selected Employee for the Official Attendance-Wise Payslip (defaults to MARI SELVAM Code 1018 as in Image 5)
  const [selectedPayslipEmp, setSelectedPayslipEmp] = useState<string>('MARI SELVAM');
  const [payslipCompanyTitle, setPayslipCompanyTitle] = useState<string>('BIM BYTES SOLUTIONS');
  const [payslipCompanySub, setPayslipCompanySub] = useState<string>('Avadi,Chennai');
  const [payslipPeriodText, setPayslipPeriodText] = useState<string>(
    'Payslip from 01-May-2026 to 31-May-2026'
  );
  const [payslipEditMode, setPayslipEditMode] = useState<boolean>(true);

  // Project-Wise Editable Overrides (Hours & Hourly Rate per Employee+Project)
  const [projectTimeOverrides, setProjectTimeOverrides] = useState<Record<string, number>>({});
  const [hourlyRateOverrides, setHourlyRateOverrides] = useState<Record<string, number>>({});

  // Add New Employee Modal / Inline Form State
  const [showAddEmpModal, setShowAddEmpModal] = useState<boolean>(false);
  const [inspectEmpModal, setInspectEmpModal] = useState<User | null>(null);
  const [addForm, setAddForm] = useState({
    username: '',
    empCode: '',
    password: '1234',
    department: 'MEP-BIM',
    designation: 'BIM MODELER-MECHANICAL',
    role: 'Production',
    shiftIn: '9:00 AM',
    workingHours: 9,
    shiftOut: '6:00 PM',
    allSaturdaysOff: false,
    monthlySalary: 23500,
    hourlySalary: 102,
    screenTimeHours: 160,
    reportsTo: 'SONAIMUTHU V',
    employmentStatus: 'Active' as EmploymentStatus,
    uanNumber: '-',
    workLocation: 'BIM BYTES SOLUTIONS',
    bankName: '-',
    bankAccountNo: '-',
    ifscCode: '-',
    branchName: '-',
    pfNumber: '-',
    esicNumber: '-',
  });

  useEffect(() => {
    if (
      employees.length > 0 &&
      !employees.some((e) => e.username.toUpperCase() === selectedPayslipEmp.toUpperCase())
    ) {
      const mari = employees.find((e) => e.username.toUpperCase() === 'MARI SELVAM');
      setSelectedPayslipEmp(mari ? mari.username : employees[0].username);
    }
  }, [employees, selectedPayslipEmp]);

  // Save any employee field to backend SQLite
  const handleUpdateEmployeeBackend = async (username: string, patch: Partial<User>) => {
    try {
      const res = await fetch('/api/employees/update-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, ...patch }),
      });
      const d = await res.json();
      if (d.success) {
        onRefresh();
      }
    } catch {
      // ignore
    }
  };

  // Compute live Daily Attendance rows using the Editable Attendance Rules (Image 1 & Image 4)
  const computedDailyRows = useMemo(() => {
    return dailyRows.map((row) => {
      const shiftStartMin = parseClockToMinutes(row.shiftIn) ?? 9 * 60;
      const shiftEndMin = parseClockToMinutes(row.shiftOut) ?? 18 * 60;
      const inMin = parseClockToMinutes(row.inTime);
      const outMin = parseClockToMinutes(row.outTime);

      const upperIn = (row.inTime || '').trim().toUpperCase();
      if (upperIn === 'HOLIDAY') {
        const isSandwiched = row.sandwichLeave === 'Sandwich Leave';
        return {
          ...row,
          requiredOutTime: '-',
          graceUsed: '-',
          lateIn: '-',
          earlyOutBy: '-',
          totalHoursWorked: '-',
          extraTime: '-',
          firstHalfPermission: '-',
          secondHalfPermission: '-',
          presentStatus: isSandwiched ? 'Absent' : 'Holiday',
          overallStatus: isSandwiched ? 'Absent' : 'Holiday',
          leaveCounted: isSandwiched ? 1 : 0,
          baseStatus: 'Holiday',
        };
      }

      if (upperIn === 'WO') {
        return {
          ...row,
          requiredOutTime: '-',
          graceUsed: '-',
          lateIn: '-',
          earlyOutBy: '-',
          totalHoursWorked: '-',
          extraTime: '-',
          firstHalfPermission: '-',
          secondHalfPermission: '-',
          presentStatus: 'Week Off',
          overallStatus: 'Week Off',
          leaveCounted: 0,
          baseStatus: 'Week Off',
        };
      }

      if (upperIn === 'CL' || upperIn === 'SL') {
        return {
          ...row,
          requiredOutTime: '-',
          graceUsed: '-',
          lateIn: '-',
          earlyOutBy: '-',
          totalHoursWorked: '-',
          extraTime: '-',
          firstHalfPermission: '-',
          secondHalfPermission: '-',
          presentStatus: upperIn,
          overallStatus: upperIn,
          leaveCounted: 1,
          baseStatus: upperIn,
        };
      }

      if (inMin === null || outMin === null) {
        return {
          ...row,
          requiredOutTime: '-',
          graceUsed: '-',
          lateIn: '-',
          earlyOutBy: '-',
          totalHoursWorked: '-',
          extraTime: '-',
          firstHalfPermission: '-',
          secondHalfPermission: '-',
          presentStatus: 'Absent',
          overallStatus: 'Absent',
          leaveCounted: 1,
          baseStatus: 'Absent',
        };
      }

      const diffFromStart = inMin - shiftStartMin;
      const graceLimit = rules.graceMinutes; // default 30
      const graceUsedMin =
        diffFromStart > 0 && diffFromStart <= graceLimit ? diffFromStart : 0;
      const reqOutMin = shiftEndMin + graceUsedMin;

      const lateInMin = diffFromStart > graceLimit ? diffFromStart - graceLimit : 0;
      const totalWorkedMin = Math.max(0, outMin - inMin);
      const extraTimeMin = outMin > reqOutMin ? outMin - reqOutMin : 0;
      const earlyOutDiff = reqOutMin - outMin;

      let firstHalfPermMin = 0;
      let secondHalfPermMin = 0;
      let earlyOutMin = 0;

      if (
        earlyOutDiff > 0 &&
        earlyOutDiff <= rules.eveningPermissionHours * 60 &&
        outMin > shiftStartMin + rules.secondHalfLatestOutHours * 60
      ) {
        secondHalfPermMin = earlyOutDiff;
      } else if (earlyOutDiff > rules.eveningPermissionHours * 60) {
        earlyOutMin = earlyOutDiff;
      }

      let presentStatus = 'Present';
      let overallStatus = 'Present';

      if (totalWorkedMin < rules.minStayValidDayHours * 60) {
        presentStatus = 'Check Punch';
        overallStatus = 'Check Punch';
      } else if (outMin <= shiftStartMin + rules.secondHalfLatestOutHours * 60) {
        presentStatus = 'Second Half Day Leave';
        overallStatus = 'Second Half Day Leave';
      } else if (
        inMin >= shiftStartMin + rules.firstHalfEarliestHours * 60 &&
        inMin <= shiftStartMin + rules.firstHalfLatestHours * 60
      ) {
        presentStatus = 'First Half Day Leave';
        overallStatus = 'First Half Day Leave';
      } else if (secondHalfPermMin > 0) {
        presentStatus = 'Present - Permission (Evening)';
        overallStatus = `Permission (Evening) 0:${String(secondHalfPermMin).padStart(2, '0')}`;
      } else if (lateInMin > 0) {
        presentStatus = 'Present Late';
        const lh = Math.floor(lateInMin / 60);
        const lm = lateInMin % 60;
        overallStatus = `Present - Late ${lh}:${String(lm).padStart(2, '0')}`;
      }

      return {
        ...row,
        requiredOutTime: formatMinutesToClock12(reqOutMin),
        graceUsed: graceUsedMin > 0 ? formatDurationHHMM(graceUsedMin) : '-',
        lateIn: lateInMin > 0 ? formatDurationHHMM(lateInMin) : '-',
        earlyOutBy: earlyOutMin > 0 ? formatDurationHHMM(earlyOutMin) : '-',
        totalHoursWorked: formatDurationHHMM(totalWorkedMin),
        extraTime: extraTimeMin > 0 ? formatDurationHHMM(extraTimeMin) : '-',
        firstHalfPermission: firstHalfPermMin > 0 ? formatDurationHHMM(firstHalfPermMin) : '-',
        secondHalfPermission:
          secondHalfPermMin > 0 ? formatDurationHHMM(secondHalfPermMin) : '-',
        presentStatus,
        overallStatus,
        leaveCounted: 0,
        baseStatus: presentStatus,
      };
    });
  }, [dailyRows, rules]);

  // Build Complete Monthly Attendance Summary Rows for all Employees (Image 2 & Image 5)
  const monthlySummaryRows: MonthlyAttendanceSummaryRow[] = useMemo(() => {
    return employees.map((emp, idx) => {
      const ov = summaryOverrides[emp.username] || {};
      const totalWorkingDays = ov.totalWorkingDays ?? rules.totalWorkingDaysInMonth;
      const workedDay = ov.workedDay ?? 20;
      const weekOff = ov.weekOff ?? (emp.allSaturdaysOff ? 8 : 6);
      const holiday = ov.holiday ?? 2;
      const paidLeaves = ov.paidLeaves ?? 2;
      const totalPayableDays =
        ov.totalPayableDays ?? Math.min(totalWorkingDays, workedDay + weekOff + holiday + paidLeaves);
      const totalSalary = ov.totalSalary ?? Number(emp.monthlySalary ?? 23500);
      const basicSalary =
        ov.basicSalary !== undefined
          ? ov.basicSalary
          : Math.round(((totalSalary / Math.max(1, totalWorkingDays)) * totalPayableDays) * 100) /
            100;
      const penalties = ov.penalties !== undefined ? ov.penalties : 0;

      const screenHrsNum = Number(emp.screenTimeHours ?? 156);
      const screenHh = Math.floor(screenHrsNum);
      const screenMm = Math.round((screenHrsNum - screenHh) * 60);
      const defaultScreenStr = `${screenHh}:${String(screenMm).padStart(2, '0')}`;

      return {
        empCode: ov.empCode ?? emp.empCode ?? String(1001 + idx),
        name: emp.username,
        department: ov.department ?? emp.department ?? 'MEP-BIM',
        role: ov.role ?? emp.designation ?? emp.role ?? 'BIM MODELER-MECHANICAL',
        weekOff,
        present: ov.present ?? 15,
        presentLate: ov.presentLate ?? 3,
        presentEarlyOut: ov.presentEarlyOut ?? 0,
        holiday,
        cl: ov.cl ?? 0,
        sl: ov.sl ?? 0,
        absent: ov.absent ?? 1,
        permMorning: ov.permMorning ?? 0,
        permEvening: ov.permEvening ?? 0,
        firstHalfLeave: ov.firstHalfLeave ?? 0,
        secondHalfLeave: ov.secondHalfLeave ?? 0,
        compensation: ov.compensation ?? 0,
        empWorkingDays: ov.empWorkingDays ?? 27,
        presentDays: ov.presentDays ?? 26,
        continuesLeave: ov.continuesLeave ?? 0,
        totalWorkingDays,
        checkPunch: ov.checkPunch ?? 0,
        graceDays: ov.graceDays ?? 12,
        lateHours: ov.lateHours ?? '0:15',
        permissionHours: ov.permissionHours ?? '0:00',
        earlyOutHours: ov.earlyOutHours ?? '0:00',
        extraHours: ov.extraHours ?? '10:20',
        totalHoursWorked: ov.totalHoursWorked ?? '168:30',
        screenTimeHours: ov.screenTimeHours ?? defaultScreenStr,
        sandwichLeaveDays: ov.sandwichLeaveDays ?? 0,
        totalLeaveDays: ov.totalLeaveDays ?? (ov.absent ?? 1) + (ov.cl ?? 0) + (ov.sl ?? 0),
        workedDay,
        paidLeaves,
        totalPayableDays,
        totalSalary,
        basicSalary,
        penalties,
      };
    });
  }, [employees, summaryOverrides, rules.totalWorkingDaysInMonth]);

  const updateSummaryField = (
    empName: string,
    field: keyof MonthlyAttendanceSummaryRow,
    value: string | number
  ) => {
    setSummaryOverrides((prev) => {
      const current = prev[empName] || {};
      const next = { ...current, [field]: value };

      // If Worked Day, Week Off, Holiday, Paid Leaves, or Total Salary changed, optionally recalculate Basic Salary unless Basic Salary itself was edited
      const rowMatch = monthlySummaryRows.find((r) => r.name === empName);
      if (
        rowMatch &&
        ['workedDay', 'weekOff', 'holiday', 'paidLeaves', 'totalPayableDays', 'totalSalary', 'totalWorkingDays'].includes(
          field
        )
      ) {
        const wDay = Number(field === 'workedDay' ? value : next.workedDay ?? rowMatch.workedDay);
        const wOff = Number(field === 'weekOff' ? value : next.weekOff ?? rowMatch.weekOff);
        const hol = Number(field === 'holiday' ? value : next.holiday ?? rowMatch.holiday);
        const pLv = Number(field === 'paidLeaves' ? value : next.paidLeaves ?? rowMatch.paidLeaves);
        const totWorkDays = Number(
          field === 'totalWorkingDays' ? value : next.totalWorkingDays ?? rowMatch.totalWorkingDays
        );
        const payable =
          field === 'totalPayableDays'
            ? Number(value)
            : wDay + wOff + hol + pLv;
        next.totalPayableDays = payable;
        const totSal = Number(
          field === 'totalSalary' ? value : next.totalSalary ?? rowMatch.totalSalary
        );
        next.basicSalary =
          Math.round(((totSal / Math.max(1, totWorkDays)) * payable) * 100) / 100;
      }

      return { ...prev, [empName]: next };
    });
  };

  // Current employee selected for Payslip preview & PDF generation
  const activePayslipEmployee = useMemo(() => {
    return (
      employees.find((e) => e.username.toUpperCase() === selectedPayslipEmp.toUpperCase()) ||
      employees[0]
    );
  }, [employees, selectedPayslipEmp]);

  const activePayslipSummary = useMemo(() => {
    if (!activePayslipEmployee) return null;
    return (
      monthlySummaryRows.find((r) => r.name === activePayslipEmployee.username) ||
      monthlySummaryRows[0]
    );
  }, [activePayslipEmployee, monthlySummaryRows]);

  // Generate Official Attendance-Wise Payslip PDF matching Image 5 (BIM BYTES SOLUTIONS, Avadi,Chennai)
  const handleDownloadAttendancePayslipPdf = () => {
    if (!activePayslipEmployee || !activePayslipSummary) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 42;

    // 1. Top Logo ("B" red/dark emblem + BIM BYTES SOLUTIONS)
    doc.setFillColor(204, 0, 0);
    doc.roundedRect(margin, 32, 26, 20, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('B', margin + 8, 47);

    doc.setFontSize(6.5);
    doc.setTextColor(30, 30, 30);
    doc.text('BIM BYTES', margin - 2, 60);
    doc.text('SOLUTIONS', margin - 2, 67);

    // 2. Company Header & Payslip Date Range
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(20, 25, 35);
    doc.text(payslipCompanyTitle, margin, 90);

    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(payslipCompanySub, margin, 104);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(payslipPeriodText, pageW - margin, 102, { align: 'right' });

    // Divider line
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(1);
    doc.line(margin, 116, pageW - margin, 116);

    // 3. Employee Details Section
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Employee Details', margin, 138);

    const leftFields: Array<[string, string]> = [
      ['Employee Name', activePayslipEmployee.username],
      ['Code', activePayslipSummary.empCode],
      ['Designation', activePayslipSummary.role],
      ['Department', activePayslipSummary.department],
      ['UAN Number', activePayslipEmployee.uanNumber || '-'],
      ['Work Location', activePayslipEmployee.workLocation || 'BIM BYTES SOLUTIONS'],
    ];
    const rightFields: Array<[string, string]> = [
      ['Bank Name', activePayslipEmployee.bankName || '-'],
      ['Bank Account No.', activePayslipEmployee.bankAccountNo || '-'],
      ['IFSC Code', activePayslipEmployee.ifscCode || '-'],
      ['Branch Name', activePayslipEmployee.branchName || '-'],
      ['PF Number', activePayslipEmployee.pfNumber || '-'],
      ['ESIC Number', activePayslipEmployee.esicNumber || '-'],
    ];

    let y = 160;
    doc.setFontSize(9);
    for (let i = 0; i < leftFields.length; i++) {
      const [lKey, lVal] = leftFields[i];
      const [rKey, rVal] = rightFields[i];

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(lKey, margin, y);
      doc.text(':', margin + 95, y);
      doc.text(lVal, margin + 115, y);

      const rightColX = pageW / 2 + 15;
      doc.text(rKey, rightColX, y);
      doc.text(':', rightColX + 95, y);
      doc.text(rVal, rightColX + 115, y);

      y += 20;
    }

    y += 12;

    // 4. Earnings & Deductions Table
    const tableW = pageW - margin * 2;
    const colW = tableW / 4;

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, tableW, 24, 3, 3, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Earnings', margin + 10, y + 16);
    doc.text('Amount (Rs.)', margin + colW + 10, y + 16);
    doc.text('Deductions', margin + colW * 2 + 10, y + 16);
    doc.text('Amount (Rs.)', margin + colW * 3 + 10, y + 16);

    y += 26;
    doc.setTextColor(30, 41, 59);
    doc.text('Basic Salary', margin + 10, y + 16);
    doc.text(activePayslipSummary.basicSalary.toFixed(2), margin + colW + 10, y + 16);
    doc.text('Penalties', margin + colW * 2 + 10, y + 16);
    doc.text(activePayslipSummary.penalties.toFixed(2), margin + colW * 3 + 10, y + 16);

    y += 24;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, pageW - margin, y);

    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y + 1, tableW, 24, 'F');
    doc.text('Total Gross Earnings', margin + 10, y + 17);
    doc.text(activePayslipSummary.basicSalary.toFixed(2), margin + colW + 10, y + 17);
    doc.text('Total Deductions', margin + colW * 2 + 10, y + 17);
    doc.text(activePayslipSummary.penalties.toFixed(2), margin + colW * 3 + 10, y + 17);

    y += 45;

    // 5. Rounded Box for Total Payable Days
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, tableW, 74, 5, 5, 'S');

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Total Payable Days', margin + 62, y + 28, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(String(activePayslipSummary.totalPayableDays), margin + 62, y + 50, {
      align: 'center',
    });

    // Vertical divider inside box
    doc.line(margin + 130, y + 10, margin + 130, y + 64);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('Worked Day', margin + 145, y + 24);
    doc.text(':', margin + 240, y + 24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(activePayslipSummary.workedDay), margin + 260, y + 24);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Holiday', margin + 145, y + 42);
    doc.text(':', margin + 240, y + 42);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(activePayslipSummary.holiday), margin + 260, y + 42);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Paid Leaves', margin + 145, y + 60);
    doc.text(':', margin + 240, y + 60);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(activePayslipSummary.paidLeaves), margin + 260, y + 60);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Weekly Off', margin + 335, y + 24);
    doc.text(':', margin + 420, y + 24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(String(activePayslipSummary.weekOff), margin + 440, y + 24);

    y += 90;

    // 6. Light-Green Net Payable Banner
    const netPayableRounded = Math.round(
      Math.max(0, activePayslipSummary.basicSalary - activePayslipSummary.penalties)
    );
    const wordsText = numberToIndianWords(netPayableRounded);

    doc.setFillColor(236, 253, 245);
    doc.roundedRect(margin, y, tableW, 50, 4, 4, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Total Net Payable :', margin + 14, y + 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(16, 185, 129);
    doc.text(`Rs. ${netPayableRounded}`, margin + 125, y + 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(wordsText, margin + 14, y + 39);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Total Salary', pageW - margin - 85, y + 20, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(16, 185, 129);
    doc.text(`Rs. ${activePayslipSummary.totalSalary}`, pageW - margin - 85, y + 39, {
      align: 'center',
    });

    y += 64;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text('Total Net Payable = Gross Earnings - Total Deductions', margin, y);

    // Footer
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('This PDF is system-generated, no signature required', pageW / 2, 790, {
      align: 'center',
    });

    doc.save(
      `BIM_Bytes_Payslip_${activePayslipEmployee.username.replace(/\s+/g, '_')}_${activePayslipSummary.empCode}.pdf`
    );
    showBanner(
      `Downloaded Official Attendance-Wise Payslip PDF for ${activePayslipEmployee.username}!`,
      'success'
    );
  };

  // ============================================================================
  // PROJECT-WISE SALARY CALCULATIONS (Mode 2)
  // Formula: Project Time Spent (Hours) * Employee Hourly Salary = Project-Wise Salary
  // ============================================================================
  const projectWiseRows = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        employee: string;
        empCode: string;
        role: string;
        department: string;
        reportsTo: string;
        status: string;
        project: string;
        loggedHours: number;
        screenHours: number;
        hourlySalary: number;
      }
    >();

    // Seed from sessions
    for (const s of sessions) {
      const empObj = employees.find((e) => e.username === s.username);
      const key = `${s.username}__${s.project}`;
      const existing = map.get(key) || {
        key,
        employee: s.username,
        empCode: empObj?.empCode || '1018',
        role: empObj?.designation || empObj?.role || s.role || 'BIM MODELER',
        department: empObj?.department || 'MEP-BIM',
        reportsTo: empObj?.reportsTo || 'SONAIMUTHU V',
        status: empObj?.employmentStatus || 'Active',
        project: s.project,
        loggedHours: 0,
        screenHours: 0,
        hourlySalary: Number(empObj?.hourlySalary ?? 102),
      };
      const hrs = Number(s.workHours || 0);
      existing.loggedHours = Math.round((existing.loggedHours + hrs) * 100) / 100;
      existing.screenHours = Math.round((existing.screenHours + hrs * 0.96) * 100) / 100;
      map.set(key, existing);
    }

    // Add live active sessions
    for (const pres of presenceList) {
      if (pres.session) {
        const empObj = employees.find((e) => e.username === pres.username);
        const key = `${pres.username}__${pres.session.project}`;
        const totalEl = Math.max(0, Math.floor((nowMs - pres.session.startTimeMs) / 1000));
        let brk = pres.session.breakTotalSec || 0;
        if (pres.session.status === 'on_break' && pres.session.currentBreakStartMs) {
          brk += Math.max(0, Math.floor((nowMs - pres.session.currentBreakStartMs) / 1000));
        }
        const liveHrs = Math.max(0, totalEl - brk) / 3600;
        const existing = map.get(key) || {
          key,
          employee: pres.username,
          empCode: empObj?.empCode || '1018',
          role: empObj?.designation || empObj?.role || 'BIM MODELER',
          department: empObj?.department || 'MEP-BIM',
          reportsTo: empObj?.reportsTo || 'SONAIMUTHU V',
          status: empObj?.employmentStatus || 'Active',
          project: pres.session.project,
          loggedHours: 0,
          screenHours: 0,
          hourlySalary: Number(empObj?.hourlySalary ?? 102),
        };
        existing.loggedHours = Math.round((existing.loggedHours + liveHrs) * 100) / 100;
        existing.screenHours = Math.round((existing.screenHours + liveHrs * 0.97) * 100) / 100;
        map.set(key, existing);
      }
    }

    // Also include CMRL project entries for key BIM Bytes employees if not yet in sessions
    for (const emp of employees.slice(0, 14)) {
      const key = `${emp.username}__CMRL`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          employee: emp.username,
          empCode: emp.empCode || '1018',
          role: emp.designation || emp.role,
          department: emp.department || 'MEP-BIM',
          reportsTo: emp.reportsTo || 'SONAIMUTHU V',
          status: emp.employmentStatus || 'Active',
          project: 'CMRL',
          loggedHours: 42.5,
          screenHours: 40.8,
          hourlySalary: Number(emp.hourlySalary ?? 102),
        });
      }
    }

    return Array.from(map.values())
      .map((r) => {
        const finalHours =
          projectTimeOverrides[r.key] !== undefined ? projectTimeOverrides[r.key] : r.loggedHours;
        const finalRate =
          hourlyRateOverrides[r.employee] !== undefined
            ? hourlyRateOverrides[r.employee]
            : r.hourlySalary;
        const projectWiseSalary = Math.round(finalHours * finalRate * 100) / 100;
        return {
          ...r,
          loggedHours: finalHours,
          hourlySalary: finalRate,
          projectWiseSalary,
        };
      })
      .filter((r) => {
        if (selectedProjectFilter !== 'ALL' && r.project !== selectedProjectFilter) return false;
        if (
          searchQuery.trim() &&
          !r.employee.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
          !r.project.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
          !r.empCode.toLowerCase().includes(searchQuery.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      });
  }, [
    sessions,
    employees,
    presenceList,
    nowMs,
    projectTimeOverrides,
    hourlyRateOverrides,
    selectedProjectFilter,
    searchQuery,
  ]);

  const filteredSummaryRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return monthlySummaryRows;
    return monthlySummaryRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.empCode.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q)
    );
  }, [monthlySummaryRows, searchQuery]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.username.trim()) {
      showBanner('Please enter Employee Name.', 'error');
      return;
    }
    const res = await fetch('/api/employees/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    });
    const d = await res.json();
    if (d.success) {
      onRefresh();
      setShowAddEmpModal(false);
      setAddForm((prev) => ({ ...prev, username: '', empCode: '' }));
      showBanner(`Added employee ${addForm.username} to Roster & Payroll!`, 'success');
    } else {
      showBanner(d.message || 'Error adding employee', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          TOP HEADER & 2-TYPE MODE SWITCHER:
          1) ATTENDANCE-WISE SALARY, PAYROLL & OFFICIAL PAYSLIP (BIM BYTES PROCESS)
          2) PROJECT-WISE SALARY & COSTING (Project Time Spent * Hourly Salary)
      ===================================================================== */}
      <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-[#cc0000]/20 border border-[#cc0000]/40 px-2.5 py-1 font-heading text-[11px] font-bold uppercase tracking-wider text-red-300">
                BIM BYTES SOLUTIONS · Avadi, Chennai
              </span>
              <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 font-mono-tabular text-[11px] font-bold text-emerald-300">
                100% Editable Sheets & Payslip
              </span>
              <span className="rounded-lg bg-sky-500/15 border border-sky-500/30 px-2.5 py-1 font-mono-tabular text-[11px] font-bold text-sky-300">
                Live Screen Time Included
              </span>
            </div>
            <h2 className="font-heading text-lg font-bold uppercase tracking-wider text-white mt-2">
              Enterprise Salary, Payroll, Attendance & Official Payslip Center
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Switch between <strong>Type 1: Attendance-Wise Payroll & Official Payslip</strong> (following your exact BIM Bytes attendance rules & payslip process) and <strong>Type 2: Project-Wise Salary</strong> (Project Time Spent × Hourly Salary). Every cell and employee detail is directly editable.
            </p>
          </div>

          {/* 2-Type Primary Mode Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-[#0b0e14] p-1.5 border border-slate-800">
              <button
                type="button"
                onClick={() => setPayrollMode('attendance')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  payrollMode === 'attendance'
                    ? 'bg-[#cc0000] text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Type 1: Attendance-Wise & Payslip</span>
              </button>
              <button
                type="button"
                onClick={() => setPayrollMode('project')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2.5 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  payrollMode === 'project'
                    ? 'bg-[#cc0000] text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Type 2: Project-Wise Salary</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowAddEmpModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 font-heading text-xs font-bold uppercase tracking-wider text-white shadow-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Employee
            </button>
          </div>
        </div>

        {/* Sub-Navigation & Search Filter Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {payrollMode === 'attendance' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  id: 'payslip' as const,
                  label: '1. Attendance Payroll & Payslip',
                  badge: 'Payslip PDF',
                },
                {
                  id: 'summary' as const,
                  label: '2. Monthly Attendance Summary',
                  badge: `${employees.length} Staff`,
                },
                {
                  id: 'daily' as const,
                  label: '3. Daily Attendance & Screen Time',
                  badge: 'In/Out Calc',
                },
                {
                  id: 'shifts' as const,
                  label: '4. Employee Shifts & Details',
                  badge: 'Roster',
                },
                {
                  id: 'rules' as const,
                  label: '5. Attendance Rules (Blue Inputs)',
                  badge: '14 Rules',
                },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setAttSubTab(t.id)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-heading text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    attSubTab === t.id
                      ? 'border-red-500/50 bg-[#cc0000]/20 text-white'
                      : 'border-slate-800 bg-[#0b0e14] text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.2 font-mono-tabular text-[10px] text-amber-300">
                    {t.badge}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Filter Project:
              </span>
              {['ALL', ...PROJECTS].map((proj) => (
                <button
                  key={proj}
                  type="button"
                  onClick={() => setSelectedProjectFilter(proj)}
                  className={`rounded-lg border px-3 py-1.5 font-heading text-xs font-bold uppercase tracking-wider cursor-pointer ${
                    selectedProjectFilter === proj
                      ? 'border-[#cc0000] bg-[#cc0000] text-white'
                      : 'border-slate-800 bg-[#0b0e14] text-slate-400 hover:text-white'
                  }`}
                >
                  {proj}
                </button>
              ))}
            </div>
          )}

          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employee name, Emp ID (1018), department..."
              className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] pl-9 pr-3 py-2 text-xs text-white focus:border-[#cc0000] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODE 1: ATTENDANCE-WISE SALARY, PAYROLL & OFFICIAL PAYSLIP
      ===================================================================== */}
      {payrollMode === 'attendance' && (
        <>
          {/* -----------------------------------------------------------------
              SUB-TAB 1: ATTENDANCE-WISE PAYROLL & OFFICIAL PAYSLIP (IMAGE 5)
          ----------------------------------------------------------------- */}
          {attSubTab === 'payslip' && activePayslipEmployee && activePayslipSummary && (
            <div className="space-y-6">
              {/* Top Split: Employee Selector + Editable Official BIM BYTES SOLUTIONS Payslip */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Left Column: Quick Employee Picker & Editable Payroll Register Summary */}
                <div className="xl:col-span-5 rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                      <div>
                        <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                          Select Employee for Attendance Payslip
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Click any employee to view, edit & download their official Attendance-Wise Payslip
                        </p>
                      </div>
                      <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono-tabular text-[10px] font-bold text-emerald-300">
                        {filteredSummaryRows.length} Employees
                      </span>
                    </div>

                    <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1">
                      {filteredSummaryRows.map((row) => {
                        const isSelected =
                          row.name.toUpperCase() === activePayslipEmployee.username.toUpperCase();
                        const netPay = Math.round(Math.max(0, row.basicSalary - row.penalties));
                        const empObj = employees.find((e) => e.username === row.name);
                        return (
                          <div
                            key={row.name}
                            onClick={() => setSelectedPayslipEmp(row.name)}
                            className={`rounded-xl border p-3 transition-all cursor-pointer ${
                              isSelected
                                ? 'border-[#cc0000] bg-[#cc0000]/15 shadow-md'
                                : 'border-slate-800 bg-[#0b0e14] hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono-tabular text-[10px] font-bold text-amber-300">
                                    #{row.empCode}
                                  </span>
                                  <span className="font-bold text-xs text-white truncate">
                                    {row.name}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                  {row.role} · {row.department}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div className="font-mono-tabular text-xs font-extrabold text-emerald-400">
                                  ₹{netPay.toLocaleString('en-IN')}
                                </div>
                                <div className="font-mono-tabular text-[10px] text-slate-400">
                                  Payable: {row.totalPayableDays}d / Total: ₹{row.totalSalary}
                                </div>
                              </div>
                            </div>

                            <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-300 font-mono-tabular">
                              <span>Worked: {row.workedDay}d</span>
                              <span>WO: {row.weekOff}d</span>
                              <span>Leaves: {row.paidLeaves}d</span>
                              <span className="text-sky-300">
                                Screen Time: {row.screenTimeHours}h
                              </span>
                              {empObj && (
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setInspectEmpModal(empObj);
                                  }}
                                  className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[9px] font-sans font-bold uppercase text-slate-200 hover:text-white"
                                >
                                  Details
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-[#0b0e14] p-3 text-xs text-slate-300 space-y-1">
                    <div className="font-heading text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      Attendance-Wise Payslip Formula
                    </div>
                    <p className="text-[11px] text-slate-400">
                      <span className="font-mono-tabular text-white">
                        Total Payable Days = Worked Day + Weekly Off + Holiday + Paid Leaves
                      </span>
                      <br />
                      <span className="font-mono-tabular text-white">
                        Total Net Payable = Basic Salary (Gross Earnings) − Penalties (Total Deductions)
                      </span>
                    </p>
                  </div>
                </div>

                {/* Right Column: Official BIM BYTES SOLUTIONS Payslip (Exact Replica of Image 5 + Editable Inputs) */}
                <div className="xl:col-span-7 space-y-4">
                  {/* Action Bar above Payslip */}
                  <div className="rounded-2xl border border-slate-800 bg-[#121620] p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPayslipEditMode(!payslipEditMode)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-heading text-xs font-bold uppercase tracking-wider cursor-pointer ${
                          payslipEditMode
                            ? 'border-amber-500/50 bg-amber-500/20 text-amber-200'
                            : 'border-slate-700 bg-slate-800 text-slate-200'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {payslipEditMode ? 'Inline Editing: ON (Click Any Field)' : 'Enable Inline Edit'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectEmpModal(activePayslipEmployee)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3.5 py-2 font-heading text-xs font-bold uppercase tracking-wider text-slate-200 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Full Employee Profile
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadAttendancePayslipPdf}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#cc0000] hover:bg-red-700 px-5 py-2.5 font-heading text-xs font-bold uppercase tracking-wider text-white shadow-lg cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Download Official Payslip PDF
                    </button>
                  </div>

                  {/* WHITE PAPER PAYSLIP SHEET (MATCHING IMAGE 5 PIXEL-FOR-PIXEL) */}
                  <div className="rounded-2xl bg-white text-slate-900 p-6 sm:p-10 shadow-2xl border border-slate-300">
                    {/* Top Logo & Header */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-300 pb-4">
                      <div>
                        {/* BIM BYTES SOLUTIONS Emblem */}
                        <div className="inline-flex flex-col items-center mb-2">
                          <div className="flex items-center justify-center h-8 w-10 rounded bg-[#cc0000] text-white font-black text-lg tracking-tighter shadow-sm">
                            B
                          </div>
                          <span className="text-[8px] font-black tracking-widest text-slate-900 uppercase mt-0.5">
                            BIM BYTES
                          </span>
                          <span className="text-[7px] font-bold tracking-widest text-slate-600 uppercase -mt-1">
                            SOLUTIONS
                          </span>
                        </div>

                        <div>
                          {payslipEditMode ? (
                            <input
                              type="text"
                              value={payslipCompanyTitle}
                              onChange={(e) => setPayslipCompanyTitle(e.target.value)}
                              className="font-sans text-xl font-normal tracking-wide text-slate-900 border-b border-dashed border-blue-400 bg-blue-50/40 px-1 focus:outline-none"
                            />
                          ) : (
                            <div className="font-sans text-xl font-normal tracking-wide text-slate-900">
                              {payslipCompanyTitle}
                            </div>
                          )}
                        </div>
                        <div className="mt-0.5">
                          {payslipEditMode ? (
                            <input
                              type="text"
                              value={payslipCompanySub}
                              onChange={(e) => setPayslipCompanySub(e.target.value)}
                              className="text-xs text-slate-500 border-b border-dashed border-blue-400 bg-blue-50/40 px-1 focus:outline-none"
                            />
                          ) : (
                            <div className="text-xs text-slate-500">{payslipCompanySub}</div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        {payslipEditMode ? (
                          <input
                            type="text"
                            value={payslipPeriodText}
                            onChange={(e) => setPayslipPeriodText(e.target.value)}
                            className="text-sm font-medium text-slate-800 border-b border-dashed border-blue-400 bg-blue-50/40 px-1.5 py-0.5 text-right w-72 focus:outline-none"
                          />
                        ) : (
                          <div className="text-sm font-medium text-slate-800">
                            {payslipPeriodText}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Employee Details 2-Column Grid */}
                    <div className="mt-5">
                      <h4 className="text-sm font-semibold text-slate-800 mb-3">
                        Employee Details
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 text-xs">
                        {/* Left Column */}
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-12 items-center">
                            <span className="col-span-5 text-slate-600">Employee Name</span>
                            <span className="col-span-1 text-slate-600">:</span>
                            <span className="col-span-6 font-semibold text-slate-900">
                              {activePayslipEmployee.username}
                            </span>
                          </div>

                          <div className="grid grid-cols-12 items-center">
                            <span className="col-span-5 text-slate-600">Code</span>
                            <span className="col-span-1 text-slate-600">:</span>
                            <div className="col-span-6">
                              {payslipEditMode ? (
                                <input
                                  type="text"
                                  value={activePayslipSummary.empCode}
                                  onChange={(e) => {
                                    updateSummaryField(
                                      activePayslipEmployee.username,
                                      'empCode',
                                      e.target.value
                                    );
                                    handleUpdateEmployeeBackend(activePayslipEmployee.username, {
                                      empCode: e.target.value,
                                    });
                                  }}
                                  className="w-full border-b border-dashed border-blue-500 bg-blue-50/50 px-1 py-0.5 font-mono-tabular text-xs text-blue-900 font-semibold"
                                />
                              ) : (
                                <span className="font-mono-tabular text-slate-800">
                                  {activePayslipSummary.empCode}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-12 items-center">
                            <span className="col-span-5 text-slate-600">Designation</span>
                            <span className="col-span-1 text-slate-600">:</span>
                            <div className="col-span-6">
                              {payslipEditMode ? (
                                <input
                                  type="text"
                                  value={activePayslipSummary.role}
                                  onChange={(e) => {
                                    updateSummaryField(
                                      activePayslipEmployee.username,
                                      'role',
                                      e.target.value
                                    );
                                    handleUpdateEmployeeBackend(activePayslipEmployee.username, {
                                      designation: e.target.value,
                                    });
                                  }}
                                  className="w-full border-b border-dashed border-blue-500 bg-blue-50/50 px-1 py-0.5 text-xs text-blue-900 font-semibold"
                                />
                              ) : (
                                <span className="text-slate-800">{activePayslipSummary.role}</span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-12 items-center">
                            <span className="col-span-5 text-slate-600">Department</span>
                            <span className="col-span-1 text-slate-600">:</span>
                            <div className="col-span-6">
                              {payslipEditMode ? (
                                <input
                                  type="text"
                                  value={activePayslipSummary.department}
                                  onChange={(e) => {
                                    updateSummaryField(
                                      activePayslipEmployee.username,
                                      'department',
                                      e.target.value
                                    );
                                    handleUpdateEmployeeBackend(activePayslipEmployee.username, {
                                      department: e.target.value,
                                    });
                                  }}
                                  className="w-full border-b border-dashed border-blue-500 bg-blue-50/50 px-1 py-0.5 text-xs text-blue-900 font-semibold"
                                />
                              ) : (
                                <span className="text-slate-800">
                                  {activePayslipSummary.department}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-12 items-center">
                            <span className="col-span-5 text-slate-600">UAN Number</span>
                            <span className="col-span-1 text-slate-600">:</span>
                            <div className="col-span-6">
                              {payslipEditMode ? (
                                <input
                                  type="text"
                                  defaultValue={activePayslipEmployee.uanNumber || '-'}
                                  onBlur={(e) =>
                                    handleUpdateEmployeeBackend(activePayslipEmployee.username, {
                                      uanNumber: e.target.value,
                                    })
                                  }
                                  className="w-full border-b border-dashed border-blue-500 bg-blue-50/50 px-1 py-0.5 text-xs text-blue-900"
                                />
                              ) : (
                                <span className="text-slate-800">
                                  {activePayslipEmployee.uanNumber || '-'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-12 items-center">
                            <span className="col-span-5 text-slate-600">Work Location</span>
                            <span className="col-span-1 text-slate-600">:</span>
                            <div className="col-span-6">
                              {payslipEditMode ? (
                                <input
                                  type="text"
                                  defaultValue={
                                    activePayslipEmployee.workLocation || 'BIM BYTES SOLUTIONS'
                                  }
                                  onBlur={(e) =>
                                    handleUpdateEmployeeBackend(activePayslipEmployee.username, {
                                      workLocation: e.target.value,
                                    })
                                  }
                                  className="w-full border-b border-dashed border-blue-500 bg-blue-50/50 px-1 py-0.5 text-xs text-blue-900"
                                />
                              ) : (
                                <span className="text-slate-800">
                                  {activePayslipEmployee.workLocation || 'BIM BYTES SOLUTIONS'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-12 items-center">
                            <span className="col-span-5 text-slate-600">Bank Name</span>
                            <span className="col-span-1 text-slate-600">:</span>
                            <div className="col-span-6">
                              {payslipEditMode ? (
                                <input
                                  type="text"
                                  defaultValue={activePayslipEmployee.bankName || '-'}
                                  onBlur={(e) =>
                                    handleUpdateEmployeeBackend(activePayslipEmployee.username, {
                                      bankName: e.target.value,
                                    })
                                  }
                                  className="w-full border-b border-dashed border-blue-500 bg-blue-50/50 px-1 py-0.5 text-xs text-blue-900"
                                />
                              ) : (
                                <span className="text-slate-800">
                                  {activePayslipEmployee.bankName || '-'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-12 items-center">
                            <span className="col-span-5 text-slate-600">Bank Account No.</span>
                            <span className="col-span-1 text-slate-600">:</span>
                            <div className="col-span-6">
                              {payslipEditMode ? (
                                <input
                                  type="text"
                                  defaultValue={activePayslipEmployee.bankAccountNo || '-'}
                                  onBlur={(e) =>
                                    handleUpdateEmployeeBackend(activePayslipEmployee.username, {
                                      bankAccountNo: e.target.value,
                                    })
                                  }
                                  className="w-full border-b border-dashed border-blue-500 bg-blue-50/50 px-1 py-0.5 text-xs text-blue-900"
                                />
                              ) : (
                                <span className="text-slate-800">
                                  {activePayslipEmployee.bankAccountNo || '-'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-12 items-center">
                            <span className="col-span-5 text-slate-600">IFSC Code</span>
                            <span className="col-span-1 text-slate-600">:</span>
                            <div className="col-span-6">
                              {payslipEditMode ? (
                                <input
                                  type="text"
                                  defaultValue={activePayslipEmployee.ifscCode || '-'}
                                  onBlur={(e) =>
                                    handleUpdateEmployeeBackend(activePayslipEmployee.username, {
                                      ifscCode: e.target.value,
                                    })
                                  }
                                  className="w-full border-b border-dashed border-blue-500 bg-blue-50/50 px-1 py-0.5 text-xs text-blue-900"
                                />
                              ) : (
                                <span className="text-slate-800">
                                  {activePayslipEmployee.ifscCode || '-'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-12 items-center">
                            <span className="col-span-5 text-slate-600">Branch Name</span>
                            <span className="col-span-1 text-slate-600">:</span>
                            <div className="col-span-6">
                              {payslipEditMode ? (
                                <input
                                  type="text"
                                  defaultValue={activePayslipEmployee.branchName || '-'}
                                  onBlur={(e) =>
                                    handleUpdateEmployeeBackend(activePayslipEmployee.username, {
                                      branchName: e.target.value,
                                    })
                                  }
                                  className="w-full border-b border-dashed border-blue-500 bg-blue-50/50 px-1 py-0.5 text-xs text-blue-900"
                                />
                              ) : (
                                <span className="text-slate-800">
                                  {activePayslipEmployee.branchName || '-'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-12 items-center">
                            <span className="col-span-5 text-slate-600">PF Number</span>
                            <span className="col-span-1 text-slate-600">:</span>
                            <div className="col-span-6">
                              {payslipEditMode ? (
                                <input
                                  type="text"
                                  defaultValue={activePayslipEmployee.pfNumber || '-'}
                                  onBlur={(e) =>
                                    handleUpdateEmployeeBackend(activePayslipEmployee.username, {
                                      pfNumber: e.target.value,
                                    })
                                  }
                                  className="w-full border-b border-dashed border-blue-500 bg-blue-50/50 px-1 py-0.5 text-xs text-blue-900"
                                />
                              ) : (
                                <span className="text-slate-800">
                                  {activePayslipEmployee.pfNumber || '-'}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-12 items-center">
                            <span className="col-span-5 text-slate-600">ESIC Number</span>
                            <span className="col-span-1 text-slate-600">:</span>
                            <div className="col-span-6">
                              {payslipEditMode ? (
                                <input
                                  type="text"
                                  defaultValue={activePayslipEmployee.esicNumber || '-'}
                                  onBlur={(e) =>
                                    handleUpdateEmployeeBackend(activePayslipEmployee.username, {
                                      esicNumber: e.target.value,
                                    })
                                  }
                                  className="w-full border-b border-dashed border-blue-500 bg-blue-50/50 px-1 py-0.5 text-xs text-blue-900"
                                />
                              ) : (
                                <span className="text-slate-800">
                                  {activePayslipEmployee.esicNumber || '-'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Earnings & Deductions Table (Image 5) */}
                    <div className="mt-6">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700">
                            <th className="py-2.5 px-3 rounded-l-md font-medium w-1/4">Earnings</th>
                            <th className="py-2.5 px-3 font-medium w-1/4">Amount (Rs.)</th>
                            <th className="py-2.5 px-3 font-medium w-1/4">Deductions</th>
                            <th className="py-2.5 px-3 rounded-r-md font-medium w-1/4">
                              Amount (Rs.)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-300">
                            <td className="py-3 px-3 text-slate-800">Basic Salary</td>
                            <td className="py-3 px-3 font-mono-tabular">
                              {payslipEditMode ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={activePayslipSummary.basicSalary}
                                  onChange={(e) =>
                                    updateSummaryField(
                                      activePayslipEmployee.username,
                                      'basicSalary',
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-28 border-b border-dashed border-blue-500 bg-blue-50/60 px-1.5 py-0.5 font-mono-tabular text-xs font-bold text-blue-900"
                                />
                              ) : (
                                activePayslipSummary.basicSalary.toFixed(2)
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-800">Penalties</td>
                            <td className="py-3 px-3 font-mono-tabular">
                              {payslipEditMode ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={activePayslipSummary.penalties}
                                  onChange={(e) =>
                                    updateSummaryField(
                                      activePayslipEmployee.username,
                                      'penalties',
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-24 border-b border-dashed border-blue-500 bg-blue-50/60 px-1.5 py-0.5 font-mono-tabular text-xs font-bold text-blue-900"
                                />
                              ) : (
                                activePayslipSummary.penalties.toFixed(2)
                              )}
                            </td>
                          </tr>
                          <tr className="bg-slate-50 font-medium text-slate-800">
                            <td className="py-2.5 px-3">Total Gross Earnings</td>
                            <td className="py-2.5 px-3 font-mono-tabular">
                              {activePayslipSummary.basicSalary.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3">Total Deductions</td>
                            <td className="py-2.5 px-3 font-mono-tabular">
                              {activePayslipSummary.penalties.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Rounded Attendance Box (Total Payable Days, Worked Day, Holiday, Paid Leaves, Weekly Off) */}
                    <div className="mt-6 rounded-xl border border-slate-300 p-4 grid grid-cols-1 sm:grid-cols-12 items-center gap-4">
                      <div className="sm:col-span-3 text-center sm:border-r border-slate-300 pr-2">
                        <div className="text-xs text-slate-500">Total Payable Days</div>
                        <div className="mt-1">
                          {payslipEditMode ? (
                            <input
                              type="number"
                              value={activePayslipSummary.totalPayableDays}
                              onChange={(e) =>
                                updateSummaryField(
                                  activePayslipEmployee.username,
                                  'totalPayableDays',
                                  Number(e.target.value)
                                )
                              }
                              className="w-16 text-center border-b border-dashed border-blue-500 bg-blue-50/60 font-mono-tabular text-xl font-bold text-blue-900"
                            />
                          ) : (
                            <span className="font-mono-tabular text-2xl font-bold text-slate-900">
                              {activePayslipSummary.totalPayableDays}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-5 space-y-1.5 text-xs pl-2">
                        <div className="grid grid-cols-12 items-center">
                          <span className="col-span-6 text-slate-500">Worked Day</span>
                          <span className="col-span-2 text-slate-500">:</span>
                          <div className="col-span-4 font-mono-tabular font-bold text-slate-900">
                            {payslipEditMode ? (
                              <input
                                type="number"
                                value={activePayslipSummary.workedDay}
                                onChange={(e) =>
                                  updateSummaryField(
                                    activePayslipEmployee.username,
                                    'workedDay',
                                    Number(e.target.value)
                                  )
                                }
                                className="w-14 border-b border-dashed border-blue-500 bg-blue-50/60 px-1 text-blue-900 font-bold"
                              />
                            ) : (
                              activePayslipSummary.workedDay
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-12 items-center">
                          <span className="col-span-6 text-slate-500">Holiday</span>
                          <span className="col-span-2 text-slate-500">:</span>
                          <div className="col-span-4 font-mono-tabular font-bold text-slate-900">
                            {payslipEditMode ? (
                              <input
                                type="number"
                                value={activePayslipSummary.holiday}
                                onChange={(e) =>
                                  updateSummaryField(
                                    activePayslipEmployee.username,
                                    'holiday',
                                    Number(e.target.value)
                                  )
                                }
                                className="w-14 border-b border-dashed border-blue-500 bg-blue-50/60 px-1 text-blue-900 font-bold"
                              />
                            ) : (
                              activePayslipSummary.holiday
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-12 items-center">
                          <span className="col-span-6 text-slate-500">Paid Leaves</span>
                          <span className="col-span-2 text-slate-500">:</span>
                          <div className="col-span-4 font-mono-tabular font-bold text-slate-900">
                            {payslipEditMode ? (
                              <input
                                type="number"
                                value={activePayslipSummary.paidLeaves}
                                onChange={(e) =>
                                  updateSummaryField(
                                    activePayslipEmployee.username,
                                    'paidLeaves',
                                    Number(e.target.value)
                                  )
                                }
                                className="w-14 border-b border-dashed border-blue-500 bg-blue-50/60 px-1 text-blue-900 font-bold"
                              />
                            ) : (
                              activePayslipSummary.paidLeaves
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="sm:col-span-4 space-y-1.5 text-xs">
                        <div className="grid grid-cols-12 items-center">
                          <span className="col-span-6 text-slate-500">Weekly Off</span>
                          <span className="col-span-2 text-slate-500">:</span>
                          <div className="col-span-4 font-mono-tabular font-bold text-slate-900">
                            {payslipEditMode ? (
                              <input
                                type="number"
                                value={activePayslipSummary.weekOff}
                                onChange={(e) =>
                                  updateSummaryField(
                                    activePayslipEmployee.username,
                                    'weekOff',
                                    Number(e.target.value)
                                  )
                                }
                                className="w-14 border-b border-dashed border-blue-500 bg-blue-50/60 px-1 text-blue-900 font-bold"
                              />
                            ) : (
                              activePayslipSummary.weekOff
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-12 items-center pt-1">
                          <span className="col-span-6 text-slate-500">Screen Time</span>
                          <span className="col-span-2 text-slate-500">:</span>
                          <div className="col-span-4 font-mono-tabular font-bold text-sky-700">
                            {activePayslipSummary.screenTimeHours}h
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Light-Green Banner Box (Total Net Payable & Total Salary) */}
                    {(() => {
                      const netPayableRounded = Math.round(
                        Math.max(0, activePayslipSummary.basicSalary - activePayslipSummary.penalties)
                      );
                      return (
                        <div className="mt-5 rounded-lg bg-[#e9f9ee] px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-medium text-slate-900">
                                Total Net Payable :
                              </span>
                              <span className="font-mono-tabular text-xl font-extrabold text-[#16a34a]">
                                ₹{netPayableRounded}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-700 mt-1">
                              {numberToIndianWords(netPayableRounded)}
                            </div>
                          </div>

                          <div className="text-left sm:text-center">
                            <div className="text-sm font-medium text-slate-900">Total Salary</div>
                            <div className="mt-0.5 flex items-center sm:justify-center gap-1 font-mono-tabular text-xl font-extrabold text-[#16a34a]">
                              <span>₹</span>
                              {payslipEditMode ? (
                                <input
                                  type="number"
                                  value={activePayslipSummary.totalSalary}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    updateSummaryField(
                                      activePayslipEmployee.username,
                                      'totalSalary',
                                      val
                                    );
                                    handleUpdateEmployeeBackend(activePayslipEmployee.username, {
                                      monthlySalary: val,
                                    });
                                  }}
                                  className="w-24 border-b border-dashed border-emerald-700 bg-white/70 px-1 text-lg font-extrabold text-[#16a34a]"
                                />
                              ) : (
                                <span>{activePayslipSummary.totalSalary}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="mt-2 text-[11px] text-slate-700">
                      Total Net Payable = Gross Earnings - Total Deductions
                    </div>

                    <div className="mt-10 pt-4 border-t border-slate-200 text-center text-[11px] text-slate-500">
                      This PDF is system-generated, no signature required
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              SUB-TAB 2: MONTHLY ATTENDANCE SUMMARY SHEET (IMAGE 2)
          ----------------------------------------------------------------- */}
          {attSubTab === 'summary' && (
            <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                    Monthly Attendance Summary Sheet (All Cells Editable + Screen Time)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Matches your BIM Bytes Monthly Summary sheet. Edit any cell to immediately update employee attendance counts, Screen Time, and Attendance-Wise Payslip!
                  </p>
                </div>
                <span className="rounded-lg bg-blue-500/15 border border-blue-500/30 px-3 py-1 text-xs font-semibold text-blue-300">
                  Click any cell to edit · Click Employee Name to open Payslip
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#1b365d] text-white font-bold">
                      <th className="py-2.5 px-2 border border-slate-600">S.no</th>
                      <th className="py-2.5 px-2 border border-slate-600">Emp ID</th>
                      <th className="py-2.5 px-2.5 border border-slate-600 min-w-[160px]">Name</th>
                      <th className="py-2.5 px-2 border border-slate-600 min-w-[130px]">Department</th>
                      <th className="py-2.5 px-2 border border-slate-600 min-w-[180px]">Role</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Week Off</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Present</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Present Late</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Present - Early Out</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Holiday</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">CL</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">SL</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Absent</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Perm (Morning)</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Perm (Evening)</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">1st Half Leave</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">2nd Half Leave</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Comp</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Emp Working Days</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Present Days</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Continues leave</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Total Working days</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Check Punch</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Grace Days</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Late Hours</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Permission Hours</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Early Out Hours</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Extra Hours</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Total Hours Worked</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center bg-sky-900">
                        Screen Time (Hrs)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Sandwich Leave</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Total Leave Days</th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">Payslip</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white text-slate-900 divide-y divide-slate-300">
                    {filteredSummaryRows.map((row, idx) => (
                      <tr key={row.name} className="hover:bg-blue-50/50">
                        <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2 border border-slate-300 font-mono-tabular">
                          <input
                            type="text"
                            value={row.empCode}
                            onChange={(e) =>
                              updateSummaryField(row.name, 'empCode', e.target.value)
                            }
                            className="w-14 bg-transparent font-mono-tabular text-center focus:bg-blue-50 focus:outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2.5 border border-slate-300 font-semibold">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPayslipEmp(row.name);
                              setAttSubTab('payslip');
                            }}
                            className="text-left text-blue-700 hover:underline font-bold cursor-pointer"
                          >
                            {row.name}
                          </button>
                        </td>
                        <td className="py-1.5 px-2 border border-slate-300">
                          <input
                            type="text"
                            value={row.department}
                            onChange={(e) =>
                              updateSummaryField(row.name, 'department', e.target.value)
                            }
                            className="w-full bg-transparent focus:bg-blue-50 focus:outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2 border border-slate-300">
                          <input
                            type="text"
                            value={row.role}
                            onChange={(e) => updateSummaryField(row.name, 'role', e.target.value)}
                            className="w-full bg-transparent focus:bg-blue-50 focus:outline-none"
                          />
                        </td>
                        {(
                          [
                            'weekOff',
                            'present',
                            'presentLate',
                            'presentEarlyOut',
                            'holiday',
                            'cl',
                            'sl',
                          ] as const
                        ).map((field) => (
                          <td
                            key={field}
                            className="py-1.5 px-1.5 border border-slate-300 text-center font-mono-tabular"
                          >
                            <input
                              type="number"
                              value={row[field]}
                              onChange={(e) =>
                                updateSummaryField(row.name, field, Number(e.target.value))
                              }
                              className="w-10 text-center bg-transparent focus:bg-blue-50 focus:outline-none"
                            />
                          </td>
                        ))}
                        <td
                          className={`py-1.5 px-1.5 border border-slate-300 text-center font-mono-tabular font-bold ${
                            row.absent >= 10 ? 'bg-[#f8cbad] text-red-900' : ''
                          }`}
                        >
                          <input
                            type="number"
                            value={row.absent}
                            onChange={(e) =>
                              updateSummaryField(row.name, 'absent', Number(e.target.value))
                            }
                            className="w-10 text-center bg-transparent focus:bg-blue-50 focus:outline-none"
                          />
                        </td>
                        {(
                          [
                            'permMorning',
                            'permEvening',
                            'firstHalfLeave',
                            'secondHalfLeave',
                            'compensation',
                            'empWorkingDays',
                            'presentDays',
                            'continuesLeave',
                            'totalWorkingDays',
                            'checkPunch',
                            'graceDays',
                          ] as const
                        ).map((field) => (
                          <td
                            key={field}
                            className="py-1.5 px-1.5 border border-slate-300 text-center font-mono-tabular"
                          >
                            <input
                              type="number"
                              value={row[field]}
                              onChange={(e) =>
                                updateSummaryField(row.name, field, Number(e.target.value))
                              }
                              className="w-10 text-center bg-transparent focus:bg-blue-50 focus:outline-none"
                            />
                          </td>
                        ))}
                        {(
                          [
                            'lateHours',
                            'permissionHours',
                            'earlyOutHours',
                            'extraHours',
                            'totalHoursWorked',
                          ] as const
                        ).map((field) => (
                          <td
                            key={field}
                            className="py-1.5 px-1.5 border border-slate-300 text-center font-mono-tabular"
                          >
                            <input
                              type="text"
                              value={row[field]}
                              onChange={(e) => updateSummaryField(row.name, field, e.target.value)}
                              className="w-14 text-center bg-transparent focus:bg-blue-50 focus:outline-none"
                            />
                          </td>
                        ))}
                        <td className="py-1.5 px-1.5 border border-slate-300 text-center font-mono-tabular bg-sky-50 font-bold text-sky-900">
                          <input
                            type="text"
                            value={row.screenTimeHours}
                            onChange={(e) =>
                              updateSummaryField(row.name, 'screenTimeHours', e.target.value)
                            }
                            className="w-14 text-center bg-transparent focus:bg-white focus:outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 border border-slate-300 text-center font-mono-tabular">
                          <input
                            type="number"
                            value={row.sandwichLeaveDays}
                            onChange={(e) =>
                              updateSummaryField(
                                row.name,
                                'sandwichLeaveDays',
                                Number(e.target.value)
                              )
                            }
                            className="w-10 text-center bg-transparent focus:bg-blue-50 focus:outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-1.5 border border-slate-300 text-center font-mono-tabular font-bold">
                          <input
                            type="number"
                            value={row.totalLeaveDays}
                            onChange={(e) =>
                              updateSummaryField(row.name, 'totalLeaveDays', Number(e.target.value))
                            }
                            className="w-10 text-center bg-transparent focus:bg-blue-50 focus:outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2 border border-slate-300 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPayslipEmp(row.name);
                              setAttSubTab('payslip');
                            }}
                            className="rounded bg-[#cc0000] px-2 py-1 text-[10px] font-bold text-white cursor-pointer"
                          >
                            Payslip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              SUB-TAB 3: DAILY ATTENDANCE & SCREEN TIME REGISTER (IMAGE 1)
          ----------------------------------------------------------------- */}
          {attSubTab === 'daily' && (
            <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                    Daily Attendance & Screen Time Sheet (Editable Blue In/Out Punches)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Matches your daily sheet: edit any blue <strong>In Time</strong> or <strong>Out Time</strong> (e.g. <span className="font-mono-tabular text-sky-300">9:20 AM</span>, <span className="font-mono-tabular text-sky-300">-</span>, <span className="font-mono-tabular text-sky-300">Holiday</span>, <span className="font-mono-tabular text-sky-300">WO</span>, <span className="font-mono-tabular text-sky-300">CL</span>, <span className="font-mono-tabular text-sky-300">SL</span>) and watch Required Out Time, Grace Used, Late In, Total Hours Worked, Extra Time, and Present/Overall Status recalculate automatically!
                  </p>
                </div>

                {/* Add New Daily Punch Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={newDailyEmp}
                    onChange={(e) => setNewDailyEmp(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-[#0b0e14] px-2.5 py-1.5 text-xs text-white"
                  >
                    {employees.map((e) => (
                      <option key={e.username} value={e.username}>
                        {e.username}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newDailyDate}
                    onChange={(e) => setNewDailyDate(e.target.value)}
                    placeholder="DD-MM-YYYY"
                    className="w-24 rounded-lg border border-slate-700 bg-[#0b0e14] px-2.5 py-1.5 font-mono-tabular text-xs text-white"
                  />
                  <input
                    type="text"
                    value={newDailyIn}
                    onChange={(e) => setNewDailyIn(e.target.value)}
                    placeholder="In (9:15 AM)"
                    className="w-24 rounded-lg border border-slate-700 bg-[#0b0e14] px-2.5 py-1.5 font-mono-tabular text-xs text-white"
                  />
                  <input
                    type="text"
                    value={newDailyOut}
                    onChange={(e) => setNewDailyOut(e.target.value)}
                    placeholder="Out (6:30 PM)"
                    className="w-24 rounded-lg border border-slate-700 bg-[#0b0e14] px-2.5 py-1.5 font-mono-tabular text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const empObj = employees.find((e) => e.username === newDailyEmp);
                      setDailyRows((prev) => [
                        {
                          id: `d_${Date.now()}`,
                          dayName: newDailyDay || 'Saturday',
                          date: newDailyDate || '03-10-2026',
                          employeeName: newDailyEmp,
                          shiftIn: empObj?.shiftIn || '9:00 AM',
                          inTime: newDailyIn || '9:15 AM',
                          shiftOut: empObj?.shiftOut || '6:00 PM',
                          outTime: newDailyOut || '6:30 PM',
                          screenTime: '08:55',
                          weekOffDay: '-',
                          prevWorkingDayStatus: 'Present',
                          nextWorkingDayStatus: 'Present',
                          sandwichLeave: '-',
                          consecutiveLeaveDays: 0,
                          leaveBlockTotal: '-',
                        },
                        ...prev,
                      ]);
                      showBanner(`Added daily attendance entry for ${newDailyEmp}.`, 'success');
                    }}
                    className="rounded-lg bg-[#cc0000] px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                  >
                    + Add Punch Row
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-[#1b365d] text-white font-bold">
                      <th className="py-2.5 px-2 border border-slate-600">Days</th>
                      <th className="py-2.5 px-2 border border-slate-600">Date</th>
                      <th className="py-2.5 px-2.5 border border-slate-600 min-w-[160px]">
                        Employees Name
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        Shift in time
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        In Time (Editable)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        Shift out time
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        Out Time (Editable)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        Required Out Time
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        Grace Used
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        Late In (after grace)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        Early Out By
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        Total Hours Worked
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center bg-sky-900">
                        Screen Time
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        Extra Time (after req out)
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        1st Half Perm
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        2nd Half Perm
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 min-w-[140px]">
                        Present Status
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 min-w-[150px]">
                        Overall Status
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        Sandwich Leave
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600 text-center">
                        Leave Counted
                      </th>
                      <th className="py-2.5 px-2 border border-slate-600">Base Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white text-slate-900 divide-y divide-slate-300">
                    {computedDailyRows
                      .filter(
                        (r) =>
                          !searchQuery.trim() ||
                          r.employeeName
                            .toLowerCase()
                            .includes(searchQuery.trim().toLowerCase()) ||
                          r.date.includes(searchQuery.trim())
                      )
                      .map((row) => {
                        const isPresent = row.presentStatus === 'Present';
                        const isAbsent = row.presentStatus === 'Absent';
                        const isLateOrPerm =
                          row.presentStatus.includes('Late') ||
                          row.presentStatus.includes('Permission') ||
                          row.presentStatus.includes('Half Day');
                        const statusBg = isPresent
                          ? 'bg-[#c6efce] text-[#006100]'
                          : isAbsent
                          ? 'bg-[#ffc7ce] text-[#9c0006]'
                          : isLateOrPerm
                          ? 'bg-[#ffeb9c] text-[#9c6500]'
                          : 'bg-slate-100 text-slate-800';

                        return (
                          <tr key={row.id} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2 border border-slate-300">
                              <input
                                type="text"
                                value={row.dayName}
                                onChange={(e) =>
                                  setDailyRows((prev) =>
                                    prev.map((item) =>
                                      item.id === row.id
                                        ? { ...item, dayName: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="w-20 bg-transparent focus:bg-blue-50 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 font-mono-tabular">
                              <input
                                type="text"
                                value={row.date}
                                onChange={(e) =>
                                  setDailyRows((prev) =>
                                    prev.map((item) =>
                                      item.id === row.id ? { ...item, date: e.target.value } : item
                                    )
                                  )
                                }
                                className="w-20 bg-transparent font-mono-tabular focus:bg-blue-50 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-2.5 border border-slate-300 font-semibold">
                              {row.employeeName}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                              <input
                                type="text"
                                value={row.shiftIn}
                                onChange={(e) =>
                                  setDailyRows((prev) =>
                                    prev.map((item) =>
                                      item.id === row.id
                                        ? { ...item, shiftIn: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="w-16 text-center bg-transparent font-mono-tabular focus:bg-blue-50 focus:outline-none"
                              />
                            </td>
                            {/* Blue Editable In Time */}
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                              <input
                                type="text"
                                value={row.inTime}
                                onChange={(e) =>
                                  setDailyRows((prev) =>
                                    prev.map((item) =>
                                      item.id === row.id
                                        ? { ...item, inTime: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="w-20 text-center bg-blue-50/60 text-blue-700 font-bold font-mono-tabular rounded px-1 focus:bg-blue-100 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                              <input
                                type="text"
                                value={row.shiftOut}
                                onChange={(e) =>
                                  setDailyRows((prev) =>
                                    prev.map((item) =>
                                      item.id === row.id
                                        ? { ...item, shiftOut: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="w-16 text-center bg-transparent font-mono-tabular focus:bg-blue-50 focus:outline-none"
                              />
                            </td>
                            {/* Blue Editable Out Time */}
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                              <input
                                type="text"
                                value={row.outTime}
                                onChange={(e) =>
                                  setDailyRows((prev) =>
                                    prev.map((item) =>
                                      item.id === row.id
                                        ? { ...item, outTime: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="w-20 text-center bg-blue-50/60 text-blue-700 font-bold font-mono-tabular rounded px-1 focus:bg-blue-100 focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                              {row.requiredOutTime}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                              {row.graceUsed}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                              {row.lateIn}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                              {row.earlyOutBy}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular font-bold">
                              {row.totalHoursWorked}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular bg-sky-50 font-bold text-sky-900">
                              <input
                                type="text"
                                value={row.screenTime}
                                onChange={(e) =>
                                  setDailyRows((prev) =>
                                    prev.map((item) =>
                                      item.id === row.id
                                        ? { ...item, screenTime: e.target.value }
                                        : item
                                    )
                                  )
                                }
                                className="w-14 text-center bg-transparent font-mono-tabular focus:bg-white focus:outline-none"
                              />
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                              {row.extraTime}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                              {row.firstHalfPermission}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                              {row.secondHalfPermission}
                            </td>
                            <td className={`py-1.5 px-2 border border-slate-300 font-semibold ${statusBg}`}>
                              {row.presentStatus}
                            </td>
                            <td className={`py-1.5 px-2 border border-slate-300 font-semibold ${statusBg}`}>
                              {row.overallStatus}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center">
                              {row.sandwichLeave}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300 text-center font-mono-tabular">
                              {row.leaveCounted}
                            </td>
                            <td className="py-1.5 px-2 border border-slate-300">
                              {row.baseStatus}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              SUB-TAB 4: EMPLOYEE SHIFTS & ROSTER DETAILS SHEET (IMAGE 3)
          ----------------------------------------------------------------- */}
          {attSubTab === 'shifts' && (
            <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                    Employee Shifts, Screen Time & Complete Details Sheet (Editable Blue Inputs)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Matches your Shifts sheet (`Name`, `Shift In`, `Working Hours`, `Shift Out`, `All Saturdays Off?`) plus Emp ID, Department, Designation, Monthly Salary, Screen Time, Status (`Active`, `Inactive`, `Left`, `Terminated`), Reports To, and Bank/PF details.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#cc0000] hover:bg-red-700 px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-white cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add New Employee
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1b365d] text-white font-bold">
                      <th className="py-2.5 px-2.5 border border-slate-600">Emp ID</th>
                      <th className="py-2.5 px-3 border border-slate-600 min-w-[180px]">Name</th>
                      <th className="py-2.5 px-2.5 border border-slate-600">Department</th>
                      <th className="py-2.5 px-2.5 border border-slate-600 min-w-[190px]">
                        Designation / Role
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-600 text-center">
                        Shift In
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-600 text-center">
                        Working Hours
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-600 text-center">
                        Shift Out
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-600 text-center">
                        All Saturdays Off?
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-600 text-center">
                        Monthly Salary (₹)
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-600 text-center">
                        Hourly Salary (₹/hr)
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-600 text-center bg-sky-900">
                        Screen Time (Hrs)
                      </th>
                      <th className="py-2.5 px-2.5 border border-slate-600">Reports To</th>
                      <th className="py-2.5 px-2.5 border border-slate-600">Status</th>
                      <th className="py-2.5 px-2.5 border border-slate-600 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white text-slate-900 divide-y divide-slate-300">
                    {employees
                      .filter(
                        (e) =>
                          !searchQuery.trim() ||
                          e.username.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
                          (e.empCode || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
                      )
                      .map((emp) => (
                        <tr key={emp.username} className="hover:bg-blue-50/40">
                          <td className="py-1.5 px-2.5 border border-slate-300 font-mono-tabular">
                            <input
                              type="text"
                              defaultValue={emp.empCode || '1018'}
                              onBlur={(e) =>
                                handleUpdateEmployeeBackend(emp.username, {
                                  empCode: e.target.value,
                                })
                              }
                              className="w-14 bg-blue-50/60 text-blue-700 font-bold text-center rounded px-1"
                            />
                          </td>
                          <td className="py-1.5 px-3 border border-slate-300 font-bold text-slate-900">
                            {emp.username}
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300">
                            <input
                              type="text"
                              defaultValue={emp.department || 'MEP-BIM'}
                              onBlur={(e) =>
                                handleUpdateEmployeeBackend(emp.username, {
                                  department: e.target.value,
                                })
                              }
                              className="w-32 bg-transparent focus:bg-blue-50 px-1"
                            />
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300">
                            <input
                              type="text"
                              defaultValue={emp.designation || emp.role}
                              onBlur={(e) =>
                                handleUpdateEmployeeBackend(emp.username, {
                                  designation: e.target.value,
                                })
                              }
                              className="w-full bg-transparent focus:bg-blue-50 px-1"
                            />
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 text-center font-mono-tabular">
                            <input
                              type="text"
                              defaultValue={emp.shiftIn || '9:00 AM'}
                              onBlur={(e) =>
                                handleUpdateEmployeeBackend(emp.username, {
                                  shiftIn: e.target.value,
                                })
                              }
                              className="w-20 text-center bg-blue-50/60 text-blue-700 font-bold rounded px-1"
                            />
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 text-center font-mono-tabular">
                            <input
                              type="number"
                              defaultValue={emp.workingHours ?? 9}
                              onBlur={(e) => {
                                const wHrs = Number(e.target.value) || 9;
                                const sIn = parseClockToMinutes(emp.shiftIn || '9:00 AM') ?? 540;
                                const sOutStr = formatMinutesToClock12(sIn + wHrs * 60);
                                handleUpdateEmployeeBackend(emp.username, {
                                  workingHours: wHrs,
                                  shiftOut: sOutStr,
                                });
                              }}
                              className="w-12 text-center bg-blue-50/60 text-blue-700 font-bold rounded px-1"
                            />
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 text-center font-mono-tabular">
                            <input
                              type="text"
                              defaultValue={emp.shiftOut || '6:00 PM'}
                              onBlur={(e) =>
                                handleUpdateEmployeeBackend(emp.username, {
                                  shiftOut: e.target.value,
                                })
                              }
                              className="w-20 text-center bg-transparent px-1"
                            />
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 text-center">
                            <select
                              value={emp.allSaturdaysOff ? 'Yes' : 'No'}
                              onChange={(e) =>
                                handleUpdateEmployeeBackend(emp.username, {
                                  allSaturdaysOff: e.target.value === 'Yes',
                                })
                              }
                              className="bg-blue-50/60 text-blue-700 font-bold rounded px-2 py-0.5"
                            >
                              <option value="No">No</option>
                              <option value="Yes">Yes</option>
                            </select>
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 text-center font-mono-tabular">
                            <input
                              type="number"
                              defaultValue={emp.monthlySalary ?? 23500}
                              onBlur={(e) => {
                                const mSal = Number(e.target.value) || 23500;
                                updateSummaryField(emp.username, 'totalSalary', mSal);
                                handleUpdateEmployeeBackend(emp.username, {
                                  monthlySalary: mSal,
                                });
                              }}
                              className="w-20 text-center bg-blue-50/60 text-emerald-800 font-bold rounded px-1"
                            />
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 text-center font-mono-tabular">
                            <input
                              type="number"
                              defaultValue={emp.hourlySalary ?? 102}
                              onBlur={(e) =>
                                handleUpdateEmployeeBackend(emp.username, {
                                  hourlySalary: Number(e.target.value) || 102,
                                })
                              }
                              className="w-16 text-center bg-blue-50/60 text-blue-700 font-bold rounded px-1"
                            />
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 text-center font-mono-tabular bg-sky-50 font-bold text-sky-900">
                            <input
                              type="number"
                              step="0.1"
                              defaultValue={emp.screenTimeHours ?? 156}
                              onBlur={(e) =>
                                handleUpdateEmployeeBackend(emp.username, {
                                  screenTimeHours: Number(e.target.value) || 0,
                                })
                              }
                              className="w-16 text-center bg-transparent"
                            />
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300">
                            <input
                              type="text"
                              defaultValue={emp.reportsTo || 'SONAIMUTHU V'}
                              onBlur={(e) =>
                                handleUpdateEmployeeBackend(emp.username, {
                                  reportsTo: e.target.value,
                                })
                              }
                              className="w-28 bg-transparent focus:bg-blue-50 px-1"
                            />
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300">
                            <select
                              value={(emp.employmentStatus as EmploymentStatus) || 'Active'}
                              onChange={(e) =>
                                handleUpdateEmployeeBackend(emp.username, {
                                  employmentStatus: e.target.value,
                                })
                              }
                              className="rounded border border-slate-300 px-1.5 py-0.5 text-[11px] font-bold"
                            >
                              {EMPLOYMENT_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 px-2.5 border border-slate-300 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setInspectEmpModal(emp)}
                                className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-white cursor-pointer"
                              >
                                Details
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPayslipEmp(emp.username);
                                  setAttSubTab('payslip');
                                }}
                                className="rounded bg-[#cc0000] px-2 py-1 text-[10px] font-bold text-white cursor-pointer"
                              >
                                Payslip
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

          {/* -----------------------------------------------------------------
              SUB-TAB 5: ATTENDANCE RULES SHEET (IMAGE 4 - BLUE INPUT CELLS)
          ----------------------------------------------------------------- */}
          {attSubTab === 'rules' && (
            <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                    Attendance Rules Sheet — Blue Cells Are Inputs (Change Them & Every Sheet Recalculates)
                  </h3>
                  <p className="text-xs text-slate-400 italic">
                    Exact rules engine from your BIM Bytes attendance workbook
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRules(DEFAULT_ATTENDANCE_RULES);
                    showBanner('Reset Attendance Rules to standard BIM Bytes defaults.', 'info');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reset Defaults
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-700 bg-white text-slate-900">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1b365d] text-white font-bold">
                      <th className="py-2.5 px-3 border border-slate-600 w-80">Setting</th>
                      <th className="py-2.5 px-3 border border-slate-600 text-center w-28">
                        Value (Blue Input)
                      </th>
                      <th className="py-2.5 px-3 border border-slate-600">Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {(
                      [
                        {
                          key: 'graceMinutes' as const,
                          setting: 'Grace time (minutes after shift start)',
                          meaning:
                            'Arrive within grace = no late mark, but required out time moves later by the same minutes (in 9:17 -> out 6:17 PM; in 9:30 -> out 6:30 PM)',
                        },
                        {
                          key: 'morningPermissionHours' as const,
                          setting: 'Morning permission allowance (hours after shift start)',
                          meaning:
                            'Arrival after the late window and up to this = "Present - Permission (Morning)" (10:00 to 11:00), minutes counted from the end of grace (9:30). After this time = "Present Late", counted from 11:00',
                        },
                        {
                          key: 'lateLimitHours' as const,
                          setting: 'Late limit (hours after shift start)',
                          meaning:
                            'Arrival after the permission allowance and before this = "Present Late" (late minutes counted after 11:00). Later than this = half day rules',
                        },
                        {
                          key: 'eveningPermissionHours' as const,
                          setting: 'Evening permission allowance (hours before required out)',
                          meaning:
                            'Leaving up to this long before Required Out = "Present - Permission (Evening)" (in 9:00 -> 4:00-6:00 PM; in 9:30 -> 4:30-6:30 PM). Leaving earlier = "Present - Early Out"',
                        },
                        {
                          key: 'firstHalfEarliestHours' as const,
                          setting: 'First half-day leave: earliest arrival (hours after shift start)',
                          meaning:
                            'Arrives between these two limits and stays to required out = "First Half Day Leave"',
                        },
                        {
                          key: 'firstHalfLatestHours' as const,
                          setting: 'First half-day leave: latest arrival (hours after shift start)',
                          meaning:
                            'Upper bound for First Half Day Leave window',
                        },
                        {
                          key: 'secondHalfLatestOutHours' as const,
                          setting: 'Second half-day leave: latest out (hours after shift start)',
                          meaning:
                            'On-time arrival but out by this time = "Second Half Day Leave" (2:00 PM)',
                        },
                        {
                          key: 'totalWorkingDaysInMonth' as const,
                          setting: 'Total working days in the month',
                          meaning:
                            'Used in Summary column "Total Working days" (data runs 01-10-2026 to 30-10-2026)',
                        },
                        {
                          key: 'longAbsentThresholdDays' as const,
                          setting: 'Long absent if absent days are more than',
                          meaning:
                            'Used for "Continues leave" and the Long Absent count in Summary',
                        },
                        {
                          key: 'firstSaturdayOffNumber' as const,
                          setting: 'Saturday off - first Saturday number',
                          meaning: '2nd Saturday of the month is a week off for everyone',
                        },
                        {
                          key: 'secondSaturdayOffNumber' as const,
                          setting: 'Saturday off - second Saturday number',
                          meaning: '4th Saturday of the month is a week off for everyone',
                        },
                        {
                          key: 'minStayValidDayHours' as const,
                          setting: 'Minimum stay for a valid day (hours)',
                          meaning:
                            'In and out punches less than this far apart (for example the same minute = one punch only) show "Check Punch"',
                        },
                        {
                          key: 'totalPermissionAllowedDayHours' as const,
                          setting: 'Total permission allowed per day (morning + evening, hours)',
                          meaning:
                            'Morning and evening permission on the same day are allowed together up to this total (in 9:46 and out 5:31 PM = 0:46 + 0:29 = 1:15). Over this = Check Punch',
                        },
                        {
                          key: 'lateWindowAfterGraceMinutes' as const,
                          setting: 'Late window after grace (minutes after shift start)',
                          meaning:
                            'Arrival after grace and up to this = "Present Late" (9:30 to 10:00), counted from the end of grace. Leaving early (within the evening allowance) is permission',
                        },
                      ] as const
                    ).map((item) => (
                      <tr key={item.key} className="hover:bg-blue-50/40">
                        <td className="py-2 px-3 border border-slate-300 font-medium">
                          {item.setting}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 text-center">
                          <input
                            type="number"
                            step="0.5"
                            value={rules[item.key]}
                            onChange={(e) =>
                              setRules((prev) => ({
                                ...prev,
                                [item.key]: Number(e.target.value),
                              }))
                            }
                            className="w-20 text-center bg-blue-50 border border-blue-300 rounded py-1 font-mono-tabular font-bold text-blue-700"
                          />
                        </td>
                        <td className="py-2 px-3 border border-slate-300 text-slate-700">
                          {item.meaning}
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

      {/* =====================================================================
          MODE 2: PROJECT-WISE SALARY & COSTING
          Formula: Project Time Spent (Hours) * Employee Hourly Salary = Project-Wise Salary
      ===================================================================== */}
      {payrollMode === 'project' && (
        <div className="space-y-6">
          {/* Formula & CMRL Project-Wise Highlight Banner */}
          <div className="rounded-2xl border border-emerald-500/40 bg-[#121620] p-5 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 font-mono-tabular text-[10px] font-bold uppercase text-emerald-300">
                  Type 2 · Project-Wise Salary Formula (All Cells Editable)
                </span>
                <h3 className="font-heading text-base font-bold uppercase tracking-wider text-white mt-1.5">
                  Project Time Spent (Hours) × Employee Salary (Hours) = Project-Wise Salary
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Example: <strong>CMRL project time spent (hours) × employee hourly salary = CMRL project-wise salary</strong>. Edit any Project Time Spent or Hourly Salary cell below to recalculate live. (Note: Official Payslips are generated in Type 1 Attendance-Wise mode as per your process.)
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-slate-800 bg-[#0b0e14] px-4 py-2.5 text-right">
                  <div className="text-[10px] uppercase text-slate-400">
                    Total Project-Wise Salary ({selectedProjectFilter})
                  </div>
                  <div className="font-mono-tabular text-lg font-black text-emerald-400">
                    ₹
                    {projectWiseRows
                      .reduce((s, r) => s + r.projectWiseSalary, 0)
                      .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Editable Project-Wise Salary Table */}
          <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3">Emp ID</th>
                    <th className="py-2.5 px-3">Employee Name</th>
                    <th className="py-2.5 px-3">Department / Designation</th>
                    <th className="py-2.5 px-3">Reports To</th>
                    <th className="py-2.5 px-3">Project Name</th>
                    <th className="py-2.5 px-3 text-center">
                      Project Time Spent (Hrs) [Editable]
                    </th>
                    <th className="py-2.5 px-3 text-center">Active Screen Time (Hrs)</th>
                    <th className="py-2.5 px-3 text-center">
                      Employee Hourly Salary (₹/Hr) [Editable]
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      Project-Wise Salary (Hrs × Rate)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {projectWiseRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono-tabular font-bold text-amber-300">
                        #{row.empCode}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">{row.employee}</td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {row.department} · <span className="text-slate-400">{row.role}</span>
                      </td>
                      <td className="py-2.5 px-3 text-sky-300">{row.reportsTo}</td>
                      <td className="py-2.5 px-3">
                        <span className="rounded bg-[#cc0000]/20 border border-[#cc0000]/40 px-2 py-0.5 font-heading text-[11px] font-bold text-red-300">
                          {row.project}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          step="0.25"
                          value={row.loggedHours}
                          onChange={(e) =>
                            setProjectTimeOverrides((prev) => ({
                              ...prev,
                              [row.key]: Number(e.target.value),
                            }))
                          }
                          className="w-20 rounded-lg border border-blue-500/40 bg-[#0b0e14] px-2 py-1 text-center font-mono-tabular text-xs font-bold text-blue-300"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono-tabular text-sky-300">
                        {row.screenHours}h
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          value={row.hourlySalary}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setHourlyRateOverrides((prev) => ({
                              ...prev,
                              [row.employee]: val,
                            }));
                            handleUpdateEmployeeBackend(row.employee, { hourlySalary: val });
                          }}
                          className="w-20 rounded-lg border border-emerald-500/40 bg-[#0b0e14] px-2 py-1 text-center font-mono-tabular text-xs font-bold text-emerald-300"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-sm font-extrabold text-emerald-400">
                        ₹{row.projectWiseSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: ADD NEW EMPLOYEE WITH FULL DETAILS
      ===================================================================== */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateEmployee}
            className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#121620] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-heading text-base font-bold uppercase tracking-wider text-white">
                Add New Employee to BIM Bytes Roster & Payroll
              </h3>
              <button
                type="button"
                onClick={() => setShowAddEmpModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Employee Name *</label>
                <input
                  type="text"
                  required
                  value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                  placeholder="e.g. MARI SELVAM"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Emp Code / ID</label>
                <input
                  type="text"
                  value={addForm.empCode}
                  onChange={(e) => setAddForm({ ...addForm, empCode: e.target.value })}
                  placeholder="e.g. 1055"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Department</label>
                <input
                  type="text"
                  value={addForm.department}
                  onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                  placeholder="MEP-BIM / MEP-MECHANICAL"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Designation</label>
                <input
                  type="text"
                  value={addForm.designation}
                  onChange={(e) => setAddForm({ ...addForm, designation: e.target.value })}
                  placeholder="BIM MODELER-MECHANICAL"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">System Role</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                >
                  {ALL_USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Reports To</label>
                <input
                  type="text"
                  value={addForm.reportsTo}
                  onChange={(e) => setAddForm({ ...addForm, reportsTo: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Shift In</label>
                <input
                  type="text"
                  value={addForm.shiftIn}
                  onChange={(e) => setAddForm({ ...addForm, shiftIn: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Working Hours</label>
                <input
                  type="number"
                  value={addForm.workingHours}
                  onChange={(e) =>
                    setAddForm({ ...addForm, workingHours: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Monthly Total Salary (₹)</label>
                <input
                  type="number"
                  value={addForm.monthlySalary}
                  onChange={(e) =>
                    setAddForm({ ...addForm, monthlySalary: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Hourly Salary (₹/hr)</label>
                <input
                  type="number"
                  value={addForm.hourlySalary}
                  onChange={(e) =>
                    setAddForm({ ...addForm, hourlySalary: Number(e.target.value) })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={addForm.bankName}
                  onChange={(e) => setAddForm({ ...addForm, bankName: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Bank Account No.</label>
                <input
                  type="text"
                  value={addForm.bankAccountNo}
                  onChange={(e) => setAddForm({ ...addForm, bankAccountNo: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddEmpModal(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#cc0000] hover:bg-red-700 px-5 py-2 font-heading text-xs font-bold uppercase tracking-wider text-white cursor-pointer"
              >
                + Save & Add Employee
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: FULL EDITABLE EMPLOYEE DETAILS VIEW
      ===================================================================== */}
      {inspectEmpModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#121620] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-heading text-base font-bold uppercase tracking-wider text-white">
                  Employee Details — {inspectEmpModal.username} (#{inspectEmpModal.empCode || '1018'})
                </h3>
                <p className="text-xs text-slate-400">
                  Edit any field below — updates synchronize immediately with Roster & Attendance Payslips
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectEmpModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {(
                [
                  ['Emp Code', 'empCode', inspectEmpModal.empCode || '1018'],
                  ['Department', 'department', inspectEmpModal.department || 'MEP-BIM'],
                  [
                    'Designation',
                    'designation',
                    inspectEmpModal.designation || 'BIM MODELER-MECHANICAL',
                  ],
                  ['Reports To', 'reportsTo', inspectEmpModal.reportsTo || 'SONAIMUTHU V'],
                  ['Shift In', 'shiftIn', inspectEmpModal.shiftIn || '9:00 AM'],
                  ['Shift Out', 'shiftOut', inspectEmpModal.shiftOut || '6:00 PM'],
                  [
                    'Monthly Total Salary (₹)',
                    'monthlySalary',
                    String(inspectEmpModal.monthlySalary ?? 23500),
                  ],
                  [
                    'Hourly Salary (₹/hr)',
                    'hourlySalary',
                    String(inspectEmpModal.hourlySalary ?? 102),
                  ],
                  [
                    'Active Screen Time (Hrs)',
                    'screenTimeHours',
                    String(inspectEmpModal.screenTimeHours ?? 156),
                  ],
                  ['UAN Number', 'uanNumber', inspectEmpModal.uanNumber || '-'],
                  [
                    'Work Location',
                    'workLocation',
                    inspectEmpModal.workLocation || 'BIM BYTES SOLUTIONS',
                  ],
                  ['Bank Name', 'bankName', inspectEmpModal.bankName || '-'],
                  ['Bank Account No.', 'bankAccountNo', inspectEmpModal.bankAccountNo || '-'],
                  ['IFSC Code', 'ifscCode', inspectEmpModal.ifscCode || '-'],
                  ['Branch Name', 'branchName', inspectEmpModal.branchName || '-'],
                  ['PF Number', 'pfNumber', inspectEmpModal.pfNumber || '-'],
                  ['ESIC Number', 'esicNumber', inspectEmpModal.esicNumber || '-'],
                ] as const
              ).map(([label, key, val]) => (
                <div key={key}>
                  <label className="block text-slate-400 mb-1">{label}</label>
                  <input
                    type="text"
                    defaultValue={val}
                    onBlur={(e) => {
                      const v = e.target.value;
                      handleUpdateEmployeeBackend(inspectEmpModal.username, {
                        [key]: ['monthlySalary', 'hourlySalary', 'screenTimeHours'].includes(key)
                          ? Number(v)
                          : v,
                      } as Partial<User>);
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-white"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedPayslipEmp(inspectEmpModal.username);
                  setInspectEmpModal(null);
                  setPayrollMode('attendance');
                  setAttSubTab('payslip');
                }}
                className="rounded-xl bg-[#cc0000] px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-white cursor-pointer"
              >
                Open Attendance Payslip
              </button>
              <button
                type="button"
                onClick={() => setInspectEmpModal(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs text-slate-300 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
