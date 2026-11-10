import React, { useState, useMemo, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  Sliders,
  Download,
  Save,
  Radio,
  Briefcase,
  Users,
  PieChart,
  CheckCircle2,
  Edit3,
  BarChart3,
  Scale,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { PresenceItem, User } from '../constants';

export interface RoleRatesMap {
  Management: number;
  QC: number;
  Production: number;
  [role: string]: number;
}

interface ProjectFinancialsTabProps {
  currentUser: User;
  sessions: any[];
  presenceList: PresenceItem[];
  employees: User[];
  initialRoleRates: RoleRatesMap;
  initialProjectBudgets: Record<string, number>;
  initialCurrency?: string;
  nowMs: number;
  fromDate: string;
  toDate: string;
  onRefresh: () => void;
  showBanner: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const CURRENCIES: Record<string, { symbol: string; label: string }> = {
  USD: { symbol: '$', label: 'USD ($)' },
  INR: { symbol: '₹', label: 'INR (₹)' },
  SGD: { symbol: 'S$', label: 'SGD (S$)' },
  AED: { symbol: 'AED ', label: 'AED' },
  GBP: { symbol: '£', label: 'GBP (£)' },
  EUR: { symbol: '€', label: 'EUR (€)' },
};

export const ProjectFinancialsTab: React.FC<ProjectFinancialsTabProps> = ({
  currentUser,
  sessions,
  presenceList,
  employees,
  initialRoleRates,
  initialProjectBudgets,
  initialCurrency = 'USD',
  nowMs,
  fromDate,
  toDate,
  onRefresh,
  showBanner,
}) => {
  const [rates, setRates] = useState<RoleRatesMap>({
    Management: initialRoleRates?.Management ?? 85,
    QC: initialRoleRates?.QC ?? 60,
    Production: initialRoleRates?.Production ?? 42,
  });
  const [currency, setCurrency] = useState<string>(initialCurrency || 'USD');
  const [projectBudgets, setProjectBudgets] = useState<Record<string, number>>(
    initialProjectBudgets || {}
  );
  const [includeLiveTimers, setIncludeLiveTimers] = useState<boolean>(true);
  const [showProfitabilityComparison, setShowProfitabilityComparison] = useState<boolean>(true);
  const [editingBudgetProject, setEditingBudgetProject] = useState<string | null>(null);
  const [editingBudgetVal, setEditingBudgetVal] = useState<string>('');
  const [savingRates, setSavingRates] = useState<boolean>(false);

  useEffect(() => {
    if (initialRoleRates) {
      setRates({
        Management: Number(initialRoleRates.Management ?? 85),
        QC: Number(initialRoleRates.QC ?? 60),
        Production: Number(initialRoleRates.Production ?? 42),
      });
    }
  }, [initialRoleRates]);

  useEffect(() => {
    if (initialProjectBudgets) {
      setProjectBudgets(initialProjectBudgets);
    }
  }, [initialProjectBudgets]);

  useEffect(() => {
    if (initialCurrency) {
      setCurrency(initialCurrency);
    }
  }, [initialCurrency]);

  const curSymbol = CURRENCIES[currency]?.symbol || '$';

  const formatMoney = (amount: number) => {
    const abs = Math.abs(amount);
    const formatted = `${curSymbol}${abs.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    return amount < 0 ? `-${formatted}` : formatted;
  };

  // Filter sessions by selected date range
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (fromDate && s.date < fromDate) return false;
      if (toDate && s.date > toDate) return false;
      return true;
    });
  }, [sessions, fromDate, toDate]);

  // Compute live financial & profitability metrics across projects, roles, and employees
  const financials = useMemo(() => {
    const roleMap: Record<string, { hours: number; liveHours: number; cost: number }> = {
      Management: { hours: 0, liveHours: 0, cost: 0 },
      QC: { hours: 0, liveHours: 0, cost: 0 },
      Production: { hours: 0, liveHours: 0, cost: 0 },
    };

    const projectMap: Record<
      string,
      {
        project: string;
        totalHours: number;
        liveHours: number;
        hoursByRole: { Management: number; QC: number; Production: number };
        costByRole: { Management: number; QC: number; Production: number };
        totalCost: number;
        sessionsCount: number;
        contributors: Set<string>;
      }
    > = {};

    const empMap: Record<
      string,
      {
        username: string;
        role: string;
        rate: number;
        loggedHours: number;
        liveHours: number;
        totalHours: number;
        totalCost: number;
        projects: Set<string>;
      }
    > = {};

    const ensureProject = (proj: string) => {
      if (!projectMap[proj]) {
        projectMap[proj] = {
          project: proj,
          totalHours: 0,
          liveHours: 0,
          hoursByRole: { Management: 0, QC: 0, Production: 0 },
          costByRole: { Management: 0, QC: 0, Production: 0 },
          totalCost: 0,
          sessionsCount: 0,
          contributors: new Set<string>(),
        };
      }
      return projectMap[proj];
    };

    const ensureEmployee = (username: string, roleStr: string) => {
      const normalizedRole =
        roleStr === 'Management' || roleStr === 'QC' ? roleStr : 'Production';
      const rate = Number(rates[normalizedRole] ?? rates.Production ?? 42);
      if (!empMap[username]) {
        empMap[username] = {
          username,
          role: normalizedRole,
          rate,
          loggedHours: 0,
          liveHours: 0,
          totalHours: 0,
          totalCost: 0,
          projects: new Set<string>(),
        };
      }
      empMap[username].rate = rate;
      return empMap[username];
    };

    // 1. Process Completed Sessions
    for (const s of filteredSessions) {
      const roleKey =
        s.role === 'Management' || s.role === 'QC' ? s.role : 'Production';
      const hrs = Number(s.workHours || 0);
      const rate = Number(rates[roleKey] ?? 42);
      const cost = hrs * rate;

      roleMap[roleKey].hours += hrs;
      roleMap[roleKey].cost += cost;

      const p = ensureProject(s.project);
      p.totalHours += hrs;
      p.hoursByRole[roleKey as 'Management' | 'QC' | 'Production'] += hrs;
      p.costByRole[roleKey as 'Management' | 'QC' | 'Production'] += cost;
      p.totalCost += cost;
      p.sessionsCount += 1;
      p.contributors.add(s.username);

      const e = ensureEmployee(s.username, roleKey);
      e.loggedHours += hrs;
      e.totalHours += hrs;
      e.totalCost += cost;
      e.projects.add(s.project);
    }

    // 2. Optionally Include Live Active Timers (Real-Time Accruing Cost)
    if (includeLiveTimers) {
      for (const pres of presenceList) {
        if (!pres.session) continue;
        const empObj = employees.find((u) => u.username === pres.username);
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
        const workHrs = Math.max(0, (totalElSec - brkSec) / 3600);
        const rate = Number(rates[roleKey] ?? 42);
        const liveCost = workHrs * rate;

        roleMap[roleKey].hours += workHrs;
        roleMap[roleKey].liveHours += workHrs;
        roleMap[roleKey].cost += liveCost;

        const p = ensureProject(pres.session.project);
        p.totalHours += workHrs;
        p.liveHours += workHrs;
        p.hoursByRole[roleKey as 'Management' | 'QC' | 'Production'] += workHrs;
        p.costByRole[roleKey as 'Management' | 'QC' | 'Production'] += liveCost;
        p.totalCost += liveCost;
        p.contributors.add(pres.username);

        const e = ensureEmployee(pres.username, roleKey);
        e.liveHours += workHrs;
        e.totalHours += workHrs;
        e.totalCost += liveCost;
        e.projects.add(pres.session.project);
      }
    }

    const projectList = Object.values(projectMap)
      .map((p) => {
        const budget = Number(projectBudgets[p.project] || 12000);
        const netProfit = budget - p.totalCost;
        const profitMarginPct =
          budget > 0 ? Math.round((netProfit / budget) * 1000) / 10 : 0;
        const burnRatePct =
          budget > 0 ? Math.round((p.totalCost / budget) * 1000) / 10 : 0;
        return {
          ...p,
          budget,
          netProfit,
          profitMarginPct,
          burnRatePct,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost);

    const employeeList = Object.values(empMap).sort(
      (a, b) => b.totalCost - a.totalCost
    );

    const grandTotalHours =
      roleMap.Management.hours + roleMap.QC.hours + roleMap.Production.hours;
    const grandTotalCost =
      roleMap.Management.cost + roleMap.QC.cost + roleMap.Production.cost;
    const blendedRate =
      grandTotalHours > 0 ? grandTotalCost / grandTotalHours : 0;

    const totalAllocatedBudget = projectList.reduce(
      (acc, p) => acc + p.budget,
      0
    );
    const totalNetProfit = totalAllocatedBudget - grandTotalCost;
    const portfolioMarginPct =
      totalAllocatedBudget > 0
        ? Math.round((totalNetProfit / totalAllocatedBudget) * 1000) / 10
        : 0;

    return {
      roleMap,
      projectList,
      employeeList,
      grandTotalHours,
      grandTotalCost,
      blendedRate,
      totalAllocatedBudget,
      totalNetProfit,
      portfolioMarginPct,
    };
  }, [
    filteredSessions,
    rates,
    includeLiveTimers,
    presenceList,
    employees,
    nowMs,
    projectBudgets,
  ]);

  const handleSaveFinancialConfig = async (customBudgets?: Record<string, number>) => {
    setSavingRates(true);
    try {
      const res = await fetch('/api/financials/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleRates: rates,
          currency,
          projectBudgets: customBudgets || projectBudgets,
          actor: currentUser.username,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        showBanner(
          'Hourly role rates & project budgets saved and synced across all devices!',
          'success'
        );
      }
    } catch {
      showBanner('Failed to save financial rates.', 'error');
    } finally {
      setSavingRates(false);
    }
  };

  const handleExportFinancialCsv = () => {
    const headers = [
      'Project',
      'Total Hours',
      'Management Hours',
      'QC Hours',
      'Production Hours',
      `Management Cost (${currency})`,
      `QC Cost (${currency})`,
      `Production Cost (${currency})`,
      `Total Labor Cost (${currency})`,
      `Projected Budget (${currency})`,
      `Net Profit / Variance (${currency})`,
      'Profit Margin (%)',
    ];
    const rows = financials.projectList.map((p) => [
      p.project,
      p.totalHours.toFixed(2),
      p.hoursByRole.Management.toFixed(2),
      p.hoursByRole.QC.toFixed(2),
      p.hoursByRole.Production.toFixed(2),
      p.costByRole.Management.toFixed(2),
      p.costByRole.QC.toFixed(2),
      p.costByRole.Production.toFixed(2),
      p.totalCost.toFixed(2),
      p.budget.toFixed(2),
      p.netProfit.toFixed(2),
      `${p.profitMarginPct}%`,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BIM_Bytes_Project_Financials_${currency}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Custom Role Hourly Rate Configurator & Project Profitability Toggle */}
      <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-sm sm:text-base font-bold uppercase tracking-wider text-white">
                Custom Hourly Rates by Role & Project Profitability Engine
              </h2>
              <p className="text-xs text-slate-400">
                Adjust hourly pay rates per role and toggle Project Profitability to compare projected budgets vs. actual labor costs
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Project Profitability Toggle */}
            <button
              type="button"
              onClick={() => setShowProfitabilityComparison(!showProfitabilityComparison)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
                showProfitabilityComparison
                  ? 'border-[#cc0000] bg-[#cc0000]/20 text-white shadow-lg shadow-red-950/30'
                  : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-red-400" />
              <span>Project Profitability:</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono-tabular text-[10px] uppercase ${
                  showProfitabilityComparison
                    ? 'bg-[#cc0000] text-white'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {showProfitabilityComparison ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Live Timer Cost Accrual Toggle */}
            <button
              type="button"
              onClick={() => setIncludeLiveTimers(!includeLiveTimers)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                includeLiveTimers
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 bg-slate-800/80 text-slate-400'
              }`}
            >
              <Radio
                className={`w-3.5 h-3.5 ${
                  includeLiveTimers ? 'text-emerald-400 animate-pulse' : ''
                }`}
              />
              <span>
                Active Timers: {includeLiveTimers ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Currency Picker */}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-xl border border-slate-700 bg-[#0b0e14] px-3 py-2 text-xs font-bold text-white"
            >
              {Object.entries(CURRENCIES).map(([code, meta]) => (
                <option key={code} value={code}>
                  {meta.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => handleSaveFinancialConfig()}
              disabled={savingRates}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#cc0000] hover:bg-red-700 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-950/40 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingRates ? 'Syncing...' : 'Save Rates'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportFinancialCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* 3 Role Rate Inputs + Live Role Cost Subtotals */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['Management', 'QC', 'Production'] as const).map((roleName) => {
            const rData = financials.roleMap[roleName];
            const sharePct =
              financials.grandTotalCost > 0
                ? Math.round((rData.cost / financials.grandTotalCost) * 100)
                : 0;
            const badgeColor =
              roleName === 'Management'
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : roleName === 'QC'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-sky-500/30 bg-sky-500/10 text-sky-300';

            return (
              <div
                key={roleName}
                className="rounded-xl border border-slate-800 bg-[#0d1119] p-4 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-md border px-2.5 py-0.5 font-heading text-xs font-bold uppercase tracking-wider ${badgeColor}`}
                  >
                    {roleName} Role
                  </span>
                  <span className="font-mono-tabular text-xs text-slate-400">
                    {sharePct}% of total cost
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Hourly Rate ({curSymbol}/hr)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono-tabular text-xs font-bold text-slate-400">
                        {curSymbol}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={rates[roleName]}
                        onChange={(e) =>
                          setRates((prev) => ({
                            ...prev,
                            [roleName]: Math.max(0, Number(e.target.value)),
                          }))
                        }
                        className="w-full rounded-xl border border-slate-700 bg-[#121620] pl-8 pr-3 py-2 font-mono-tabular text-sm font-bold text-white focus:border-[#cc0000] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Role Labor Cost
                    </div>
                    <div className="font-mono-tabular text-base font-extrabold text-emerald-400 mt-1">
                      {formatMoney(rData.cost)}
                    </div>
                    <div className="font-mono-tabular text-[11px] text-slate-400">
                      {rData.hours.toFixed(2)} hrs logged
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial Executive Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-[#121620] p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Actual Labor Cost</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-1.5 font-mono-tabular text-2xl font-black text-emerald-400">
            {formatMoney(financials.grandTotalCost)}
          </div>
          <div className="mt-1 font-mono-tabular text-[11px] text-slate-400">
            Across {financials.grandTotalHours.toFixed(2)} total billable hours
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#121620] p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Projected Portfolio Budget</span>
            <Briefcase className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-1.5 font-mono-tabular text-2xl font-black text-white">
            {formatMoney(financials.totalAllocatedBudget)}
          </div>
          <div className="mt-1 font-mono-tabular text-[11px] text-sky-400">
            {financials.totalAllocatedBudget > 0
              ? `${Math.round(
                  (financials.grandTotalCost / financials.totalAllocatedBudget) *
                    1000
                ) / 10}% budget utilized`
              : '0% utilized'}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#121620] p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Projected Net Profit Margin</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div
            className={`mt-1.5 font-mono-tabular text-2xl font-black ${
              financials.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {formatMoney(financials.totalNetProfit)}
          </div>
          <div className="mt-1 font-mono-tabular text-[11px] text-slate-400">
            Portfolio Margin:{' '}
            <strong className="text-white">{financials.portfolioMarginPct}%</strong> (Blended{' '}
            {formatMoney(financials.blendedRate)}/hr)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#121620] p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Highest Labor Spend</span>
            <PieChart className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-1.5 font-heading text-lg font-extrabold text-white truncate">
            {financials.projectList[0]?.project || '—'}
          </div>
          <div className="mt-1 font-mono-tabular text-[11px] text-red-400 font-bold">
            {financials.projectList[0]
              ? `${formatMoney(
                  financials.projectList[0].totalCost
                )} (${financials.projectList[0].totalHours.toFixed(1)}h)`
              : 'No hours logged'}
          </div>
        </div>
      </div>

      {/* Project Profitability Visual Comparison Chart (Shown when Project Profitability toggle is ON) */}
      {showProfitabilityComparison && (
        <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3.5 mb-4">
            <div>
              <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#cc0000]" />
                Project Profitability Comparison (Projected Budget vs. Actual Labor Cost)
              </h3>
              <p className="text-[11px] text-slate-400">
                Real-time comparison of allocated project budgets against role-weighted labor costs and remaining profit margin
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono-tabular">
              <span className="text-slate-400">
                Net Portfolio Variance:{' '}
                <strong
                  className={
                    financials.totalNetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {formatMoney(financials.totalNetProfit)} ({financials.portfolioMarginPct}%)
                </strong>
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={financials.projectList.map((p) => ({
                  project: p.project,
                  Budget: Number(p.budget.toFixed(2)),
                  ActualCost: Number(p.totalCost.toFixed(2)),
                  NetProfit: Number(Math.max(0, p.netProfit).toFixed(2)),
                }))}
                margin={{ top: 10, right: 20, left: 10, bottom: 20 }}
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
                  tickFormatter={(v) => `${curSymbol}${v}`}
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
                  formatter={(value: any, name: any) => [
                    formatMoney(Number(value || 0)),
                    name === 'Budget'
                      ? 'Projected Budget'
                      : name === 'ActualCost'
                      ? 'Actual Labor Cost'
                      : 'Net Profit Remaining',
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  formatter={(value) =>
                    value === 'Budget'
                      ? 'Projected Budget'
                      : value === 'ActualCost'
                      ? 'Actual Labor Cost'
                      : 'Net Profit Margin'
                  }
                />
                <Bar
                  dataKey="Budget"
                  fill="#3b82f6"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
                <Bar
                  dataKey="ActualCost"
                  fill="#cc0000"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
                <Bar
                  dataKey="NetProfit"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Project-Level Labor Cost, Budget & Profitability Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3.5 mb-4">
          <div>
            <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
              {showProfitabilityComparison
                ? 'Project Profitability & Budget Variance Matrix'
                : 'Project Labor Cost Breakdown & Role Distribution'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {showProfitabilityComparison
                ? 'Compares projected project budgets against actual labor costs (logged hours × role pay rates)'
                : 'Calculated from logged hours multiplied by each contributor’s role hourly rate'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            <button
              type="button"
              onClick={() => setShowProfitabilityComparison(!showProfitabilityComparison)}
              className="rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200 cursor-pointer"
            >
              {showProfitabilityComparison
                ? 'Switch to Role Split View'
                : 'Switch to Profitability View'}
            </button>
            <span className="inline-flex items-center gap-1.5 text-red-300">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#cc0000]" /> Management
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <span className="h-2.5 w-2.5 rounded-xs bg-amber-400" /> QC
            </span>
            <span className="inline-flex items-center gap-1.5 text-sky-300">
              <span className="h-2.5 w-2.5 rounded-xs bg-sky-400" /> Production
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3">Project</th>
                <th className="py-2.5 px-3 text-right">Total Hrs</th>
                <th className="py-2.5 px-3 text-right">Mgmt Cost</th>
                <th className="py-2.5 px-3 text-right">QC Cost</th>
                <th className="py-2.5 px-3 text-right">Prod Cost</th>
                <th className="py-2.5 px-3 text-right">Actual Labor Cost</th>
                <th className="py-2.5 px-3 text-right">Projected Budget</th>
                {showProfitabilityComparison ? (
                  <>
                    <th className="py-2.5 px-3 text-right">Net Profit / Variance</th>
                    <th className="py-2.5 px-3 text-right">Profit Margin</th>
                    <th className="py-2.5 px-3">Status</th>
                  </>
                ) : (
                  <th className="py-2.5 px-3 w-44">Role Cost Split</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {financials.projectList.map((p) => {
                const mgmtPct =
                  p.totalCost > 0
                    ? Math.round((p.costByRole.Management / p.totalCost) * 100)
                    : 0;
                const qcPct =
                  p.totalCost > 0
                    ? Math.round((p.costByRole.QC / p.totalCost) * 100)
                    : 0;
                const prodPct = Math.max(0, 100 - mgmtPct - qcPct);

                const isOverBudget = p.netProfit < 0;
                const isTight = !isOverBudget && p.profitMarginPct < 25;

                return (
                  <tr key={p.project} className="hover:bg-slate-800/30">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{p.project}</span>
                        {p.liveHours > 0 && (
                          <span className="rounded bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 font-mono-tabular text-[9px] text-emerald-300">
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {p.contributors.size} member(s) · {p.sessionsCount} session(s)
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono-tabular font-bold text-slate-200">
                      {p.totalHours.toFixed(2)}h
                    </td>

                    <td className="py-3 px-3 text-right font-mono-tabular text-slate-300">
                      <div>{formatMoney(p.costByRole.Management)}</div>
                      <div className="text-[10px] text-slate-500">
                        {p.hoursByRole.Management.toFixed(1)}h
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono-tabular text-slate-300">
                      <div>{formatMoney(p.costByRole.QC)}</div>
                      <div className="text-[10px] text-slate-500">
                        {p.hoursByRole.QC.toFixed(1)}h
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono-tabular text-slate-300">
                      <div>{formatMoney(p.costByRole.Production)}</div>
                      <div className="text-[10px] text-slate-500">
                        {p.hoursByRole.Production.toFixed(1)}h
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono-tabular text-sm font-extrabold text-amber-300">
                      {formatMoney(p.totalCost)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono-tabular">
                      {editingBudgetProject === p.project ? (
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            value={editingBudgetVal}
                            onChange={(e) => setEditingBudgetVal(e.target.value)}
                            className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-right font-mono-tabular text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const nextBudgets = {
                                ...projectBudgets,
                                [p.project]: Math.max(0, Number(editingBudgetVal)),
                              };
                              setProjectBudgets(nextBudgets);
                              setEditingBudgetProject(null);
                              handleSaveFinancialConfig(nextBudgets);
                            }}
                            className="rounded bg-emerald-600 p-1 text-white"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-slate-200 font-semibold">
                            {formatMoney(p.budget)}
                          </span>
                          {currentUser.role === 'Management' && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBudgetProject(p.project);
                                setEditingBudgetVal(String(p.budget));
                              }}
                              className="text-slate-500 hover:text-white cursor-pointer"
                              title="Edit Projected Project Budget"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {showProfitabilityComparison ? (
                      <>
                        <td
                          className={`py-3 px-3 text-right font-mono-tabular text-sm font-extrabold ${
                            p.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {p.netProfit >= 0
                            ? `+${formatMoney(p.netProfit)}`
                            : formatMoney(p.netProfit)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-tabular">
                          <div
                            className={`font-bold ${
                              p.profitMarginPct >= 0
                                ? 'text-emerald-300'
                                : 'text-red-400'
                            }`}
                          >
                            {p.profitMarginPct}%
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Burn: {p.burnRatePct}%
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${
                              isOverBudget
                                ? 'border-red-500/40 bg-red-500/15 text-red-300'
                                : isTight
                                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                                : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            }`}
                          >
                            {isOverBudget
                              ? 'Over Budget'
                              : isTight
                              ? 'Tight Margin'
                              : 'Profitable'}
                          </span>
                        </td>
                      </>
                    ) : (
                      <td className="py-3 px-3">
                        <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden flex">
                          {mgmtPct > 0 && (
                            <div
                              style={{ width: `${mgmtPct}%` }}
                              className="bg-[#cc0000]"
                              title={`Management: ${mgmtPct}%`}
                            />
                          )}
                          {qcPct > 0 && (
                            <div
                              style={{ width: `${qcPct}%` }}
                              className="bg-amber-400"
                              title={`QC: ${qcPct}%`}
                            />
                          )}
                          {prodPct > 0 && (
                            <div
                              style={{ width: `${prodPct}%` }}
                              className="bg-sky-400"
                              title={`Production: ${prodPct}%`}
                            />
                          )}
                        </div>
                        <div className="mt-1 flex justify-between font-mono-tabular text-[10px] text-slate-400">
                          <span>M:{mgmtPct}%</span>
                          <span>Q:{qcPct}%</span>
                          <span>P:{prodPct}%</span>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Labor Cost Contribution Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#121620] p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-red-400" />
            <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-white">
              Individual Contributor Labor Cost Ledger
            </h3>
          </div>
          <span className="font-mono-tabular text-xs text-slate-400">
            {financials.employeeList.length} Active Contributors
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3">Employee</th>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Projects Contributed</th>
                <th className="py-2.5 px-3 text-right">Role Rate</th>
                <th className="py-2.5 px-3 text-right">Completed Hrs</th>
                <th className="py-2.5 px-3 text-right">Live Timer Hrs</th>
                <th className="py-2.5 px-3 text-right">Total Labor Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {financials.employeeList.map((e) => (
                <tr key={e.username} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 font-bold text-white">{e.username}</td>
                  <td className="py-2.5 px-3">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-300">
                      {e.role}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {Array.from(e.projects).join(', ')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-300">
                    {formatMoney(e.rate)}/hr
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-200">
                    {e.loggedHours.toFixed(2)}h
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-400">
                    {e.liveHours > 0 ? `+${e.liveHours.toFixed(2)}h` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-tabular text-sm font-extrabold text-emerald-400">
                    {formatMoney(e.totalCost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
