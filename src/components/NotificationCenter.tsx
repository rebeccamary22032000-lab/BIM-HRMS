import React, { useState } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Volume2,
  VolumeX,
  AlertTriangle,
  Play,
  Square,
  Coffee,
  MessageSquare,
  FileWarning,
  Megaphone,
  Calendar,
  Clock,
  Check,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Radio,
} from 'lucide-react';
import { NotificationItem, User } from '../constants';

export interface LiveToastItem {
  toastId: string;
  notification: NotificationItem;
  createdAt: number;
}

interface NotificationCenterProps {
  currentUser: User;
  notifications: NotificationItem[];
  liveToasts: LiveToastItem[];
  isOpen: boolean;
  soundEnabled: boolean;
  desktopPushEnabled: boolean;
  onlineDevicesCount: number;
  onClose: () => void;
  onDismissToast: (toastId: string) => void;
  onToggleSound: () => void;
  onToggleDesktopPush: () => void;
  onMarkAllRead: () => void;
  onDismissNotification: (id: string) => void;
  onNavigateFromNotification: (notif: NotificationItem) => void;
  onTriggerTestNotification: () => void;
}

export function getNotificationMeta(type: string) {
  switch (type) {
    case 'qc_error':
      return {
        label: 'QC Error Alert',
        badgeBg: 'bg-red-500/15 text-red-400 border-red-500/30',
        accentBorder: 'border-l-red-500',
        iconBg: 'bg-red-500/20 text-red-400',
        Icon: ShieldAlert,
      };
    case 'memo_issued':
    case 'memo_reply':
      return {
        label: type === 'memo_issued' ? 'Official Memo / Warning' : 'Memo Reply',
        badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        accentBorder: 'border-l-amber-500',
        iconBg: 'bg-amber-500/20 text-amber-400',
        Icon: FileWarning,
      };
    case 'chat_message':
      return {
        label: 'Direct / Group Message',
        badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        accentBorder: 'border-l-sky-500',
        iconBg: 'bg-sky-500/20 text-sky-400',
        Icon: MessageSquare,
      };
    case 'circular_posted':
      return {
        label: 'Company Circular',
        badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        accentBorder: 'border-l-purple-500',
        iconBg: 'bg-purple-500/20 text-purple-400',
        Icon: Megaphone,
      };
    case 'leave_request':
    case 'leave_status':
      return {
        label: type === 'leave_request' ? 'Leave Approval Needed' : 'Leave Decision',
        badgeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        accentBorder: 'border-l-indigo-500',
        iconBg: 'bg-indigo-500/20 text-indigo-400',
        Icon: Calendar,
      };
    case 'permission_request':
    case 'permission_status':
      return {
        label: type === 'permission_request' ? 'Permission Request' : 'Permission Decision',
        badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        accentBorder: 'border-l-cyan-500',
        iconBg: 'bg-cyan-500/20 text-cyan-400',
        Icon: Clock,
      };
    case 'session_start':
    case 'break_end':
      return {
        label: type === 'session_start' ? 'Production Started' : 'Resumed Work',
        badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        accentBorder: 'border-l-emerald-500',
        iconBg: 'bg-emerald-500/20 text-emerald-400',
        Icon: Play,
      };
    case 'break_start':
      return {
        label: 'Break Started',
        badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        accentBorder: 'border-l-amber-500',
        iconBg: 'bg-amber-500/20 text-amber-400',
        Icon: Coffee,
      };
    case 'session_end':
      return {
        label: 'Session Completed',
        badgeBg: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
        accentBorder: 'border-l-slate-400',
        iconBg: 'bg-slate-500/20 text-slate-300',
        Icon: Square,
      };
    default:
      return {
        label: 'System Update',
        badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
        accentBorder: 'border-l-rose-500',
        iconBg: 'bg-rose-500/20 text-rose-400',
        Icon: AlertTriangle,
      };
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  currentUser,
  notifications,
  liveToasts,
  isOpen,
  soundEnabled,
  desktopPushEnabled,
  onlineDevicesCount,
  onClose,
  onDismissToast,
  onToggleSound,
  onToggleDesktopPush,
  onMarkAllRead,
  onDismissNotification,
  onNavigateFromNotification,
  onTriggerTestNotification,
}) => {
  const [activeTab, setActiveTab] = useState<
    'all' | 'unread' | 'qc' | 'memos' | 'messages' | 'approvals' | 'team'
  >('all');

  const isUnread = (n: NotificationItem) => {
    const readBy = n.readBy || [];
    return !readBy.includes(currentUser.username);
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return isUnread(n);
    if (activeTab === 'qc') return n.type === 'qc_error';
    if (activeTab === 'memos') return n.type === 'memo_issued' || n.type === 'memo_reply' || n.type === 'circular_posted';
    if (activeTab === 'messages') return n.type === 'chat_message';
    if (activeTab === 'approvals') {
      return (
        n.type === 'leave_request' ||
        n.type === 'leave_status' ||
        n.type === 'permission_request' ||
        n.type === 'permission_status' ||
        n.type === 'comment_updated'
      );
    }
    if (activeTab === 'team') {
      return (
        n.type === 'session_start' ||
        n.type === 'session_end' ||
        n.type === 'break_start' ||
        n.type === 'break_end'
      );
    }
    return true;
  });

  const unreadCount = notifications.filter(isUnread).length;

  return (
    <>
      {/* FLOATING REAL-TIME OS/MAC-STYLE TOAST NOTIFICATIONS (TOP RIGHT) */}
      <div className="fixed top-16 right-4 z-[110] flex flex-col gap-2.5 w-[380px] max-w-[calc(100vw-2rem)] pointer-events-none">
        {liveToasts.map((item) => {
          const n = item.notification;
          const meta = getNotificationMeta(n.type);
          const IconComponent = meta.Icon;

          return (
            <div
              key={item.toastId}
              className={`pointer-events-auto group relative overflow-hidden rounded-xl border border-slate-700/80 border-l-4 ${meta.accentBorder} bg-[#111622]/95 backdrop-blur-xl p-3.5 shadow-2xl shadow-black/70 transition-all duration-300 animate-in fade-in slide-in-from-right-5`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.iconBg}`}>
                  <IconComponent className="h-4.5 w-4.5" />
                </div>

                <div
                  onClick={() => {
                    onNavigateFromNotification(n);
                    onDismissToast(item.toastId);
                  }}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badgeBg}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      {meta.label}
                    </span>
                    <span className="font-mono-tabular text-[10px] text-slate-400 shrink-0">
                      Just now
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs font-semibold text-white leading-snug line-clamp-2">
                    <span className="text-red-400 font-bold">{n.actor}</span>{' '}
                    <span className="text-slate-200 font-normal">{n.message}</span>
                  </p>

                  {(n.project || n.task || n.extra) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {n.project && (
                        <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 border border-slate-700/70">
                          {n.project}
                        </span>
                      )}
                      {n.task && (
                        <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-[10px] text-slate-400">
                          {n.task}
                          {n.subtask ? ` · ${n.subtask}` : ''}
                        </span>
                      )}
                      {n.extra && (
                        <span className="text-[10px] text-amber-300/90 italic truncate max-w-[220px]">
                          {n.extra}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-red-400 group-hover:text-red-300">
                    <span>Click to open</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </div>

                <button
                  onClick={() => onDismissToast(item.toastId)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                  title="Dismiss alert"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* SLIDE-OVER NOTIFICATION CENTER DRAWER */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-xs">
          <div
            className="fixed inset-0"
            onClick={onClose}
          />
          <div className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-slate-800 bg-[#0e121b] text-slate-100 shadow-2xl">
            {/* Header */}
            <div className="border-b border-slate-800 bg-[#121722] px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-red-600/15 border border-red-500/30 text-red-400">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#cc0000] px-1 font-mono-tabular text-[10px] font-bold text-white">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                      Real-Time Notification Center
                    </h2>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                        <Radio className="w-3 h-3 animate-pulse" /> Live WebSocket Sync
                      </span>
                      <span>·</span>
                      <span className="font-mono-tabular">{onlineDevicesCount} active device{onlineDevicesCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={onToggleSound}
                    title={soundEnabled ? 'Sound alerts ON' : 'Sound alerts MUTED'}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium flex items-center gap-1 transition-colors ${
                      soundEnabled
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-800/70 text-slate-400'
                    }`}
                  >
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{soundEnabled ? 'Sound On' : 'Muted'}</span>
                  </button>

                  <button
                    onClick={onToggleDesktopPush}
                    title="Toggle browser desktop notifications"
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      desktopPushEnabled
                        ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                        : 'border-slate-700 bg-slate-800/70 text-slate-400'
                    }`}
                  >
                    Desktop Push {desktopPushEnabled ? 'ON' : 'OFF'}
                  </button>

                  <button
                    onClick={onClose}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Action bar */}
              <div className="mt-3.5 flex items-center justify-between gap-2">
                <button
                  onClick={onTriggerTestNotification}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#cc0000]/15 hover:bg-[#cc0000]/25 border border-[#cc0000]/40 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-red-400" />
                  Send Live Test Alert Across Devices
                </button>

                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Mark All Read ({unreadCount})
                  </button>
                )}
              </div>

              {/* Category filter tabs */}
              <div className="mt-3.5 flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                {[
                  { id: 'all', label: 'All', count: notifications.length },
                  { id: 'unread', label: 'Unread', count: unreadCount },
                  {
                    id: 'qc',
                    label: 'QC Alerts',
                    count: notifications.filter((n) => n.type === 'qc_error').length,
                  },
                  {
                    id: 'memos',
                    label: 'Memos & Circulars',
                    count: notifications.filter(
                      (n) =>
                        n.type === 'memo_issued' ||
                        n.type === 'memo_reply' ||
                        n.type === 'circular_posted'
                    ).length,
                  },
                  {
                    id: 'messages',
                    label: 'Messages',
                    count: notifications.filter((n) => n.type === 'chat_message').length,
                  },
                  {
                    id: 'approvals',
                    label: 'Approvals',
                    count: notifications.filter((n) =>
                      [
                        'leave_request',
                        'leave_status',
                        'permission_request',
                        'permission_status',
                        'comment_updated',
                      ].includes(n.type)
                    ).length,
                  },
                  {
                    id: 'team',
                    label: 'Live Sessions',
                    count: notifications.filter((n) =>
                      ['session_start', 'session_end', 'break_start', 'break_end'].includes(n.type)
                    ).length,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                      activeTab === tab.id
                        ? 'bg-[#cc0000] text-white shadow-sm'
                        : 'bg-slate-800/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span
                        className={`rounded px-1.5 py-0.2 font-mono-tabular text-[10px] ${
                          activeTab === tab.id
                            ? 'bg-black/30 text-white'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 p-3 space-y-2">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/60 text-slate-500 mb-3">
                    <Bell className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">
                    No notifications in this view
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Real-time alerts from QC reviews, work sessions, memos, approvals, and chat messages appear here immediately.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const meta = getNotificationMeta(n.type);
                  const IconComponent = meta.Icon;
                  const unread = isUnread(n);
                  const canVerifyDismiss =
                    currentUser.role === 'Management' &&
                    (n.type === 'comment_updated' ||
                      n.type === 'leave_request' ||
                      n.type === 'permission_request' ||
                      n.type === 'memo_reply');

                  return (
                    <div
                      key={n.id}
                      className={`group relative rounded-xl border border-l-4 p-3.5 transition-all ${
                        meta.accentBorder
                      } ${
                        unread
                          ? 'border-slate-700 bg-[#151c2c] shadow-md'
                          : 'border-slate-800/80 bg-[#111622]/60 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.iconBg}`}
                        >
                          <IconComponent className="h-4.5 w-4.5" />
                        </div>

                        <div
                          onClick={() => onNavigateFromNotification(n)}
                          className="flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.badgeBg}`}
                            >
                              {unread && (
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              )}
                              {meta.label}
                            </span>
                            <span className="font-mono-tabular text-[11px] text-slate-400">
                              {n.timestamp}
                            </span>
                          </div>

                          <p className="mt-1.5 text-xs text-slate-200 leading-relaxed">
                            <strong className="font-bold text-white">{n.actor}</strong>{' '}
                            {n.message}
                          </p>

                          {(n.project || n.task || n.extra) && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {n.project && (
                                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-200 border border-slate-700">
                                  {n.project}
                                </span>
                              )}
                              {n.task && (
                                <span className="rounded bg-slate-800/70 px-2 py-0.5 text-[10px] text-slate-300">
                                  {n.task}
                                  {n.subtask ? ` / ${n.subtask}` : ''}
                                </span>
                              )}
                              {n.extra && (
                                <span className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">
                                  {n.extra}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {canVerifyDismiss && (
                          <button
                            onClick={() => onDismissNotification(n.id)}
                            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300 transition-colors cursor-pointer"
                            title="Verify & dismiss notification"
                          >
                            <Check className="w-3.5 h-3.5" /> Verified
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
