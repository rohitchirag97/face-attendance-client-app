import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  HandCoins,
  Plane,
  Sun,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { ErrorText } from "@/components/form-kit";
import OnboardingChecklist from "@/components/onboarding-checklist";
import { AdminCharts, EmployeeCharts } from "@/components/dashboard-charts";
import { employeesQuery } from "@/hooks/use-api";
import {
  attendanceQuery,
  holidaysQuery,
  leaveRequestsQuery,
  recoverablesQuery,
  type AttendanceLog,
  type Holiday,
  type LeaveRequest,
} from "@/hooks/use-payroll-api";

import {
  canManageEmployees,
  canManagePeople,
  getActiveOrganization,
  hasManagerRole,
  getUser,
} from "@/lib/session";

const StatCard: React.FC<{
  label: string;
  value: string | number;
  hint?: string;
  to: string;
  icon: React.ElementType;
  tone: string;
}> = ({ label, value, hint, to, icon: Icon, tone }) => (
  <Link
    to={to}
    className="group rounded-xl border bg-card p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-5"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 truncate text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{value}</p>
      </div>
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="size-5" />
      </span>
    </div>
    {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
  </Link>
);

const Panel: React.FC<{
  title: string;
  icon: React.ElementType;
  action?: { label: string; to: string };
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon: Icon, action, children, className = "" }) => (
  <section className={`min-w-0 rounded-xl border bg-card p-4 shadow-sm sm:p-5 ${className}`}>
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 shrink-0 text-primary" />
        <span className="truncate">{title}</span>
      </h2>
      {action && (
        <Link to={action.to} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
          {action.label}
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
    {children}
  </section>
);

const formatDate = (date: string) =>
  new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });

const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

const LeaveRequests: React.FC<{ requests: LeaveRequest[] }> = ({ requests }) => {
  const recent = [...requests]
    .filter((item) => item.status === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  if (!recent.length) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No pending leave requests.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {recent.map((request) => (
        <li key={request.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Plane className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{request.employeeName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {request.leaveTypeName} · {formatDate(request.startDate)} – {formatDate(request.endDate)}
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">Pending</span>
        </li>
      ))}
    </ul>
  );
};

const RecentAttendance: React.FC<{ logs: AttendanceLog[] }> = ({ logs }) => {
  const recent = logs.slice(0, 4);
  if (!recent.length) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No attendance activity yet today.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {recent.map((log) => {
        const checkedIn = log.eventType === "check_in";
        return (
          <li key={log.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${checkedIn ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600"}`}>
              {checkedIn ? <CheckCircle2 className="size-4" /> : <Clock3 className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{log.employeeName}</p>
              <p className="text-xs text-muted-foreground">{checkedIn ? "Checked in" : "Checked out"}</p>
            </div>
            <time className="shrink-0 text-xs text-muted-foreground">{formatTime(log.occurredAt)}</time>
          </li>
        );
      })}
    </ul>
  );
};

type UpcomingEvent = {
  id: string;
  date: string;
  title: string;
  detail: string;
  icon: React.ElementType;
  tone: string;
};

const UpcomingEvents: React.FC<{ events: UpcomingEvent[] }> = ({ events }) => {
  if (!events.length) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No upcoming events in the next 30 days.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {events.map((event) => {
        const daysUntil = Math.round(
          (new Date(`${event.date}T00:00:00`).getTime() - new Date(`${localDateKey(new Date())}T00:00:00`).getTime()) /
            86_400_000,
        );
        const Icon = event.icon;
        return (
          <li key={event.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${event.tone}`}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{event.title}</p>
              <p className="truncate text-xs text-muted-foreground">{event.detail}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium">{formatDate(event.date)}</p>
              <p className="text-[11px] text-muted-foreground">{daysUntil === 0 ? "Today" : `In ${daysUntil} days`}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const localDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const QuickAccess: React.FC<{ isManager: boolean; isFinanceManager: boolean }> = ({
  isManager,
  isFinanceManager,
}) => {
  const actions = [
    ...(isManager ? [{ label: "Add employee", to: "/employees/new", icon: UserPlus, tone: "bg-violet-50 text-violet-600" }] : []),
    { label: "Apply for leave", to: "/leave", icon: Plane, tone: "bg-amber-50 text-amber-600" },
    { label: "Attendance", to: "/attendance", icon: CalendarDays, tone: "bg-emerald-50 text-emerald-600" },
    ...(isFinanceManager
      ? [{ label: "Payroll", to: "/payroll", icon: Wallet, tone: "bg-sky-50 text-sky-600" }]
      : [{ label: "My profile", to: "/profile", icon: UserRound, tone: "bg-indigo-50 text-indigo-600" }]),
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map(({ label, to, icon: Icon, tone }) => (
        <Link
          key={label}
          to={to}
          className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-border/70 bg-background/70 p-3 text-center transition hover:border-primary/30 hover:bg-accent"
        >
          <span className={`flex size-9 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="size-4" />
          </span>
          <span className="text-xs font-medium">{label}</span>
        </Link>
      ))}
    </div>
  );
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

const Dashboard: React.FC = () => {
  const organization = getActiveOrganization();
  const organizationId = organization?.id ?? "";
  const isManager = canManagePeople(organizationId);
  const isFinanceManager = canManageEmployees(organizationId);
  const user = getUser();
  const today = React.useMemo(() => startOfToday(), []);

  const employees = useQuery({ ...employeesQuery(organizationId), enabled: isManager });
  const todayLogs = useQuery(attendanceQuery(organizationId, { from: today }));
  const loansQ = useQuery(recoverablesQuery(organizationId));
  const leavesQ = useQuery(leaveRequestsQuery(organizationId));
  const holidaysQ = useQuery(holidaysQuery(organizationId));

  // Managers receive everyone's records; in "My view" only the user's own should count.
  const ownOnly = <T extends { employeeId: string }>(rows: T[] | undefined) =>
    isManager || !user ? rows : rows?.filter((row) => row.employeeId === user.id);
  const loans = { data: ownOnly(loansQ.data), error: loansQ.error };
  const leaves = { data: ownOnly(leavesQ.data), error: leavesQ.error };

  const todayDate = React.useMemo(() => {
    return localDateKey(new Date());
  }, []);
  const pendingLeave = leaves.data?.filter((item) => item.status === "pending").length ?? 0;
  const onLeaveToday =
    leaves.data?.filter(
      (item) =>
        item.status === "approved" &&
        item.startDate.slice(0, 10) <= todayDate &&
        item.endDate.slice(0, 10) >= todayDate,
    ).length ?? 0;
  const upcomingLeave =
    leaves.data?.filter(
      (item) => item.status === "approved" && item.endDate.slice(0, 10) >= todayDate,
    ).length ?? 0;
  const activeEmployees = employees.data?.filter((employee) => employee.isActive).length ?? 0;

  // Logs are newest first, so the first log per employee is their latest event today.
  const presentNow = new Set<string>();
  const seen = new Set<string>();
  const visibleLogs = ownOnly(todayLogs.data) ?? [];
  for (const log of visibleLogs) {
    if (seen.has(log.employeeId)) continue;
    seen.add(log.employeeId);
    if (log.eventType === "check_in") presentNow.add(log.employeeId);
  }

  const openLoans =
    loans.data?.filter((item) => ["pending", "approved", "disbursed", "active"].includes(item.status)) ?? [];
  const pending = loans.data?.filter((item) => item.status === "pending").length ?? 0;
  const outstanding = openLoans
    .filter((item) => item.status === "disbursed" || item.status === "active")
    .reduce((sum, item) => sum + Number(item.outstanding), 0);

  const eventWindowEnd = React.useMemo(() => {
    const end = new Date(`${todayDate}T00:00:00`);
    end.setDate(end.getDate() + 30);
    return localDateKey(end);
  }, [todayDate]);
  const events: UpcomingEvent[] = [
    ...(holidaysQ.data ?? [])
      .filter((holiday: Holiday) => holiday.date >= todayDate && holiday.date <= eventWindowEnd)
      .map((holiday) => ({
        id: `holiday-${holiday.id}`,
        date: holiday.date,
        title: holiday.name,
        detail: "Company holiday",
        icon: Sun,
        tone: "bg-amber-50 text-amber-600",
      })),
    ...(leaves.data ?? [])
      .filter((leave) => leave.status === "approved" && leave.endDate.slice(0, 10) >= todayDate)
      .filter((leave) => leave.startDate.slice(0, 10) <= eventWindowEnd)
      .map((leave) => ({
        id: `leave-${leave.id}`,
        date: leave.startDate.slice(0, 10) < todayDate ? todayDate : leave.startDate.slice(0, 10),
        title: `${leave.employeeName} · ${leave.leaveTypeName}`,
        detail: `Approved leave · ${formatDate(leave.startDate)} – ${formatDate(leave.endDate)}`,
        icon: Plane,
        tone: "bg-violet-50 text-violet-600",
      })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  const firstError = todayLogs.error ?? loans.error ?? leaves.error ?? holidaysQ.error ?? employees.error;

  return (
    <div className="mx-auto w-full max-w-360 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
            {organization?.name ?? "People overview"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back{user?.fname ? `, ${user.fname}` : ""} — here&apos;s what&apos;s happening today.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground shadow-sm">
          <CalendarDays className="size-4 text-primary" />
          {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
        </div>
      </div>

      <ErrorText message={firstError?.message} />

      {/* Setup matters in either view, so this follows the role rather than Manage / My view. */}
      {organizationId && hasManagerRole(organizationId) && (
        <OnboardingChecklist key={organizationId} organizationId={organizationId} />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {isManager ? (
          <>
            <StatCard label="Active employees" value={activeEmployees.toLocaleString()} to="/employees" icon={Users} tone="bg-violet-50 text-violet-600" />
            <StatCard
              label="Present today"
              value={presentNow.size}
              hint={`${seen.size} with activity today`}
              to="/attendance"
              icon={UserCheck}
              tone="bg-emerald-50 text-emerald-600"
            />
            <StatCard label="On leave today" value={onLeaveToday} to="/history" icon={Plane} tone="bg-amber-50 text-amber-600" />
            <StatCard label="Pending leave" value={pendingLeave} to="/leave/applications" icon={CalendarDays} tone="bg-rose-50 text-rose-600" />
            {isFinanceManager && (
              <>
                <StatCard label="Loan requests" value={pending} hint="Awaiting review" to="/loans/all" icon={HandCoins} tone="bg-sky-50 text-sky-600" />
              </>
            )}
          </>
        ) : (
          <>
            <StatCard
              label="Today"
              value={presentNow.size > 0 ? "Checked in" : seen.size > 0 ? "Checked out" : "No activity"}
              to="/attendance"
              icon={UserCheck}
              tone="bg-emerald-50 text-emerald-600"
            />
            <StatCard label="Open loans & advances" value={openLoans.length} to="/loans" icon={HandCoins} tone="bg-sky-50 text-sky-600" />
            <StatCard label="Outstanding balance" value={outstanding.toFixed(2)} to="/loans" icon={Wallet} tone="bg-violet-50 text-violet-600" />
            <StatCard label="Pending leave" value={pendingLeave} to="/leave" icon={Plane} tone="bg-amber-50 text-amber-600" />
            <StatCard label="Upcoming approved leave" value={upcomingLeave} to="/history" icon={CalendarDays} tone="bg-rose-50 text-rose-600" />
          </>
        )}
      </div>

      {isManager ? (
        <>
          <div className="grid items-stretch gap-4 xl:grid-cols-3">
            <AdminCharts organizationId={organizationId} />
            <Panel title="Upcoming events" icon={CalendarDays} action={{ label: "Holidays", to: "/holidays" }}>
              <UpcomingEvents events={events} />
            </Panel>
            <Panel title="Leave requests" icon={Plane} action={{ label: "Review", to: "/leave/applications" }}>
              <LeaveRequests requests={leaves.data ?? []} />
            </Panel>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Recent attendance" icon={Clock3} action={{ label: "View attendance", to: "/attendance" }}>
              <RecentAttendance logs={visibleLogs} />
            </Panel>
            <Panel title="Quick access" icon={ArrowRight}>
              <QuickAccess isManager={isManager} isFinanceManager={isFinanceManager} />
            </Panel>
          </div>
        </>
      ) : (
        <>
          {user && <EmployeeCharts organizationId={organizationId} userId={user.id} />}
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel title="Recent attendance" icon={Clock3} action={{ label: "View attendance", to: "/attendance" }}>
              <RecentAttendance logs={visibleLogs} />
            </Panel>
            <Panel title="Upcoming events" icon={CalendarDays} action={{ label: "Holidays", to: "/holidays" }}>
              <UpcomingEvents events={events} />
            </Panel>
            <Panel title="Quick access" icon={ArrowRight}>
              <QuickAccess isManager={isManager} isFinanceManager={isFinanceManager} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
