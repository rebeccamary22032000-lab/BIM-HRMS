import React, { useRef, useState, useMemo } from 'react';
import {
  Flag,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User as UserIcon,
  Layers,
  Trash2,
  X,
  ArrowUpRight,
  SlidersHorizontal,
} from 'lucide-react';
import { PROJECTS, ProjectMilestone, User } from '../constants';

interface ProjectTimelineProps {
  milestones: ProjectMilestone[];
  currentUser: User;
  employees: User[];
  onRefresh: () => void;
  onOpenProjectDashboard?: (projectName: string) => void;
  showBanner: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProjectTimeline: React.FC<ProjectTimelineProps> = ({
  milestones,
  currentUser,
  employees,
  onRefresh,
  onOpenProjectDashboard,
  showBanner,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [filterMode, setFilterMode] = useState<
    'all' | 'critical' | 'mechanical' | 'electrical' | 'qa' | 'completed'
  >('all');
  const [selectedMilestone, setSelectedMilestone] = useState<ProjectMilestone | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // New milestone form state
  const [newProject, setNewProject] = useState<string>(PROJECTS[0]);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newDiscipline, setNewDiscipline] = useState<string>('Mechanical');
  const [newDueDate, setNewDueDate] = useState<string>(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [newPriority, setNewPriority] = useState<string>('High');
  const [newLead, setNewLead] = useState<string>(currentUser.username);
  const [newDeliverable, setNewDeliverable] = useState<string>('');
  const [newProgress, setNewProgress] = useState<number>(25);

  const canManage = currentUser.role === 'Management' || currentUser.role === 'QC';

  // Calculate days difference relative to today
  const getDaysRemaining = (dueDateStr: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMs = new Date(todayStr + 'T00:00:00').getTime();
    const dueMs = new Date(dueDateStr + 'T00:00:00').getTime();
    return Math.round((dueMs - todayMs) / 86400000);
  };

  // Sort chronologically by dueDate
  const sortedMilestones = useMemo(() => {
    return [...milestones]
      .filter((m) => {
        if (filterMode === 'critical') return m.priority === 'Critical' || m.status === 'At Risk';
        if (filterMode === 'mechanical') return m.discipline === 'Mechanical';
        if (filterMode === 'electrical') return m.discipline === 'Electrical';
        if (filterMode === 'qa') return m.status === 'QA Review';
        if (filterMode === 'completed') return m.status === 'Completed' || m.progress >= 100;
        return true;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [milestones, filterMode]);

  // Summary metrics
  const stats = useMemo(() => {
    const total = milestones.length;
    const completed = milestones.filter((m) => m.status === 'Completed' || m.progress >= 100).length;
    const urgent = milestones.filter((m) => {
      const days = getDaysRemaining(m.dueDate);
      return m.status !== 'Completed' && days <= 5;
    }).length;
    const avgProgress =
      total > 0
        ? Math.round(milestones.reduce((acc, m) => acc + Number(m.progress || 0), 0) / total)
        : 0;
    return { total, completed, urgent, avgProgress };
  }, [milestones]);

  const scrollTimeline = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const offset = direction === 'left' ? -360 : 360;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDueDate) {
      showBanner('Please enter a milestone name and target deadline date.', 'error');
      return;
    }
    const res = await fetch('/api/milestones/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project: newProject,
        milestoneName: newTitle.trim(),
        discipline: newDiscipline,
        dueDate: newDueDate,
        status: newProgress >= 100 ? 'Completed' : 'In Progress',
        progress: newProgress,
        lead: newLead,
        deliverable: newDeliverable.trim() || 'LOD 350 Coordinated Package',
        priority: newPriority,
        actor: currentUser.username,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setNewTitle('');
      setNewDeliverable('');
      setIsAddModalOpen(false);
      onRefresh();
      showBanner(`Milestone added for ${newProject} and synced across devices!`, 'success');
    }
  };

  const handleUpdateMilestone = async (
    m: ProjectMilestone,
    nextProgress: number,
    nextStatus: string
  ) => {
    const res = await fetch('/api/milestones/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: m.id,
        progress: nextProgress,
        status: nextStatus,
        dueDate: m.dueDate,
        actor: currentUser.username,
      }),
    });
    const data = await res.json();
    if (data.success) {
      if (selectedMilestone && selectedMilestone.id === m.id) {
        setSelectedMilestone({ ...selectedMilestone, progress: nextProgress, status: nextStatus });
      }
      onRefresh();
      showBanner(`Updated "${m.milestoneName}" (${nextProgress}% · ${nextStatus})`, 'success');
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    await fetch('/api/milestones/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setSelectedMilestone(null);
    onRefresh();
    showBanner('Milestone removed from timeline.', 'info');
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#cc0000]/15 border border-[#cc0000]/30 text-red-400">
            <Flag className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-sm sm:text-base font-bold uppercase tracking-wider text-white">
                Project Deadlines & Milestone Horizon
              </h2>
              <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 font-mono-tabular text-[11px] font-bold text-slate-300">
                {stats.completed}/{stats.total} Completed · {stats.avgProgress}% Avg
              </span>
              {stats.urgent > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 border border-red-500/30 px-2 py-0.5 font-mono-tabular text-[11px] font-bold text-red-300">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                  {stats.urgent} Due ≤ 5 Days
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Interactive horizontal milestone roadmap — click any node to inspect deliverables or update progress in real time
            </p>
          </div>
        </div>

        {/* Right Controls: Filters + Scroll Arrows + Add Milestone */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-[#0b0e14] p-1 border border-slate-800 overflow-x-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'critical', label: 'Critical' },
              { id: 'mechanical', label: 'Mechanical' },
              { id: 'electrical', label: 'Electrical' },
              { id: 'qa', label: 'QA Review' },
              { id: 'completed', label: 'Done' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterMode(tab.id as typeof filterMode)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                  filterMode === tab.id
                    ? 'bg-[#cc0000] text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollTimeline('left')}
              title="Scroll Timeline Left"
              className="rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollTimeline('right')}
              title="Scroll Timeline Right"
              className="rounded-lg border border-slate-700 bg-slate-800/80 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#cc0000] hover:bg-red-700 px-3 py-1.5 text-xs font-bold text-white shadow-lg shadow-red-950/40 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Milestone
            </button>
          )}
        </div>
      </div>

      {/* Proportional 45-Day Horizon Overview Bar */}
      <div className="mt-4 rounded-xl border border-slate-800/90 bg-[#0b0e14] px-4 py-2.5">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Today ({new Date().toISOString().slice(0, 10)})
          </span>
          <span>45-Day Delivery Horizon</span>
          <span className="font-mono-tabular text-slate-300">
            Overall Completion: {stats.avgProgress}%
          </span>
        </div>
        <div className="relative h-2.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#cc0000] via-amber-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${Math.max(6, stats.avgProgress)}%` }}
          />
        </div>
      </div>

      {/* HORIZONTAL TIMELINE TRACK */}
      {sortedMilestones.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">
          No project milestones match the selected filter.
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="mt-5 overflow-x-auto pb-3 pt-2 scroll-smooth"
        >
          <div className="relative inline-flex min-w-full items-stretch gap-5 px-2">
            {/* Continuous Horizontal Rail Line Behind Nodes */}
            <div className="pointer-events-none absolute top-[26px] left-8 right-8 h-0.5 bg-gradient-to-r from-[#cc0000] via-slate-700 to-emerald-500/70" />

            {sortedMilestones.map((m, index) => {
              const daysLeft = getDaysRemaining(m.dueDate);
              const isCompleted = m.status === 'Completed' || m.progress >= 100;
              const isOverdue = !isCompleted && daysLeft < 0;
              const isDueSoon = !isCompleted && daysLeft >= 0 && daysLeft <= 4;
              const isSelected = selectedMilestone?.id === m.id;

              const nodeRingColor = isCompleted
                ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                : isOverdue
                ? 'border-red-500 bg-red-600 text-white animate-pulse'
                : isDueSoon
                ? 'border-amber-400 bg-amber-500 text-slate-950'
                : 'border-[#cc0000] bg-[#121620] text-red-400';

              const cardBorder = isSelected
                ? 'border-[#cc0000] ring-1 ring-[#cc0000]/50 bg-[#161c2a]'
                : isCompleted
                ? 'border-emerald-500/30 bg-[#0d1119]/90 hover:border-emerald-500/60'
                : isOverdue
                ? 'border-red-500/50 bg-red-950/15 hover:border-red-500'
                : isDueSoon
                ? 'border-amber-500/40 bg-amber-950/10 hover:border-amber-500/70'
                : 'border-slate-800 bg-[#0d1119] hover:border-slate-600';

              return (
                <div
                  key={m.id}
                  className="relative flex flex-col items-start w-[295px] shrink-0 group"
                >
                  {/* Top Timeline Axis Node & Date Pill */}
                  <div className="relative z-10 flex items-center justify-between w-full mb-3 pr-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedMilestone(isSelected ? null : m)
                        }
                        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 font-mono-tabular text-xs font-extrabold shadow-lg transition-transform group-hover:scale-110 cursor-pointer ${nodeRingColor}`}
                        title="Click to inspect or update milestone"
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
                      </button>
                      <span className="rounded-md bg-[#0b0e14] border border-slate-800 px-2 py-0.5 font-mono-tabular text-[11px] font-bold text-slate-200">
                        {m.dueDate}
                      </span>
                    </div>

                    {/* Countdown Badge */}
                    <span
                      className={`rounded-md px-2 py-0.5 font-mono-tabular text-[10px] font-bold uppercase ${
                        isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isOverdue
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : daysLeft === 0
                          ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                          : isDueSoon
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {isCompleted
                        ? '✓ Delivered'
                        : isOverdue
                        ? `${Math.abs(daysLeft)}d Overdue`
                        : daysLeft === 0
                        ? 'Due Today'
                        : `In ${daysLeft}d`}
                    </span>
                  </div>

                  {/* Milestone Card */}
                  <div
                    onClick={() => setSelectedMilestone(isSelected ? null : m)}
                    className={`w-full flex-1 rounded-xl border p-4 transition-all cursor-pointer flex flex-col justify-between ${cardBorder}`}
                  >
                    <div>
                      {/* Project & Priority Row */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded bg-[#cc0000]/15 border border-[#cc0000]/30 px-2 py-0.5 font-heading text-[11px] font-bold uppercase tracking-wider text-red-300">
                          {m.project}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            m.priority === 'Critical'
                              ? 'bg-red-500/20 text-red-300'
                              : m.priority === 'High'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-sky-500/20 text-sky-300'
                          }`}
                        >
                          {m.priority}
                        </span>
                      </div>

                      {/* Milestone Title */}
                      <h3 className="mt-2 font-heading text-sm font-bold text-white leading-snug line-clamp-2">
                        {m.milestoneName}
                      </h3>

                      {/* Deliverable subtitle */}
                      <p className="mt-1 text-[11px] text-slate-400 line-clamp-1">
                        {m.deliverable}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2.5">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-400 font-medium">{m.status}</span>
                          <span className="font-mono-tabular font-bold text-white">
                            {m.progress}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isCompleted
                                ? 'bg-emerald-400'
                                : m.progress >= 70
                                ? 'bg-sky-400'
                                : m.progress >= 40
                                ? 'bg-amber-400'
                                : 'bg-[#cc0000]'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, m.progress))}%` }}
                          />
                        </div>
                      </div>

                      {/* Lead & Discipline Footer */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
                          <UserIcon className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate text-slate-300">{m.lead}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                          <Layers className="w-3 h-3 text-red-400" />
                          {m.discipline}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Milestone Interactive Inspector / Progress Updater */}
      {selectedMilestone && (
        <div className="mt-4 rounded-xl border border-slate-700 bg-[#0d1119] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-[#cc0000] px-2 py-0.5 font-heading text-xs font-bold uppercase text-white">
                {selectedMilestone.project}
              </span>
              <h4 className="font-heading text-sm font-bold text-white">
                {selectedMilestone.milestoneName}
              </h4>
              <span className="font-mono-tabular text-xs text-slate-400">
                Due: {selectedMilestone.dueDate} · Lead: {selectedMilestone.lead}
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Deliverable Spec: <span className="text-slate-400">{selectedMilestone.deliverable}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Progress Step Buttons */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[11px] text-slate-400 mr-1">Progress:</span>
              {[25, 50, 75, 90, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() =>
                    handleUpdateMilestone(
                      selectedMilestone,
                      pct,
                      pct === 100
                        ? 'Completed'
                        : pct === 90
                        ? 'QA Review'
                        : 'In Progress'
                    )
                  }
                  className={`rounded px-2 py-0.5 font-mono-tabular text-[11px] font-bold transition-colors cursor-pointer ${
                    selectedMilestone.progress === pct
                      ? 'bg-[#cc0000] text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>

            {onOpenProjectDashboard && (
              <button
                type="button"
                onClick={() => onOpenProjectDashboard(selectedMilestone.project)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                <span>Project Logs</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentUser.role === 'Management' && (
              <button
                type="button"
                onClick={() => handleDeleteMilestone(selectedMilestone.id)}
                className="rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 p-1.5 text-red-400 cursor-pointer"
                title="Delete Milestone"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedMilestone(null)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Add Milestone Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#121620] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-red-500" />
                <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
                  Schedule New Project Milestone
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMilestone} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Project
                  </label>
                  <select
                    value={newProject}
                    onChange={(e) => setNewProject(e.target.value)}
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
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Target Deadline Date
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Milestone Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Level 3 HVAC & Fire Fighting Shop Drawing Submission"
                  className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Discipline
                  </label>
                  <select
                    value={newDiscipline}
                    onChange={(e) => setNewDiscipline(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
                  >
                    <option value="Mechanical">Mechanical</option>
                    <option value="Electrical">Electrical</option>
                    <option value="Multi-Discipline">Multi-Discipline</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Milestone Lead
                  </label>
                  <select
                    value={newLead}
                    onChange={(e) => setNewLead(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
                  >
                    {employees.map((emp) => (
                      <option key={emp.username} value={emp.username}>
                        {emp.username}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Deliverable Specification
                  </label>
                  <input
                    type="text"
                    value={newDeliverable}
                    onChange={(e) => setNewDeliverable(e.target.value)}
                    placeholder="e.g. Federated NWD + Clash Free Report"
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Initial Progress (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={newProgress}
                    onChange={(e) => setNewProgress(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 font-mono-tabular text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#cc0000] hover:bg-red-700 px-5 py-2 text-xs font-bold text-white shadow-lg cursor-pointer"
                >
                  Publish Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
