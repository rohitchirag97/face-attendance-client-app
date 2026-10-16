import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Briefcase, CalendarHeart, Cake, Clock, HandCoins, LogOut, TrendingDown, Users } from "lucide-react";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import {
  attendanceInsightsQuery,
  costInsightsQuery,
  upcomingInsightsQuery,
  workforceInsightsQuery,
  type UpcomingInsights,
} from "@/hooks/use-insights";
import { inputClass } from "@/lib/form-utils";
import { formatMoney } from "@/lib/payroll-format";
import { getActiveOrganizationId, hasManagerRole } from "@/lib/session";

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "#94a3b8"];
const tooltipStyle = { borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)", color: "var(--popover-foreground)", fontSize: 12 };
const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
const inr = (value: number) => formatMoney(value, "INR");
const lakh = (value: number) => (value >= 100000 ? `₹${(value / 100000).toFixed(1)}L` : `₹${Math.round(value / 1000)}k`);

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; icon: React.ElementType }> = ({ label, value, hint, icon: Icon }) => (
  <div className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
    <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-5" /></span>
    <div>
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  </div>
);

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; tall?: boolean }> = ({ title, subtitle, children, tall }) => (
  <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
    <h2 className="text-sm font-semibold">{title}</h2>
    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    <div className={`mt-3 ${tall ? "h-72" : "h-60"}`}>{children}</div>
  </section>
);

const Donut: React.FC<{ data: { name: string; count: number }[] }> = ({ data }) =>
  data.length === 0 ? (
    <p className="text-sm text-muted-foreground">No data.</p>
  ) : (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="name" innerRadius="55%" outerRadius="85%" stroke="none">
          {data.map((slice, index) => <Cell key={slice.name} fill={PALETTE[index % PALETTE.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );

const HBars: React.FC<{ data: { name: string; value: number }[]; format?: (v: number) => string; color?: string }> = ({ data, format, color = "var(--chart-1)" }) =>
  data.length === 0 ? (
    <p className="text-sm text-muted-foreground">No data.</p>
  ) : (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" tick={axis} tickFormatter={format} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={axis} width={110} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => (format ? format(Number(v)) : v)} />
        <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

const WorkforceTab: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { data, isLoading, error } = useQuery(workforceInsightsQuery(organizationId));
  if (isLoading) return <Spinner />;
  if (!data) return <ErrorText message={error?.message ?? "Could not load workforce insights."} />;
  const a = data.attrition12Months;
  const trend = data.trend.map((row) => ({ ...row, label: monthLabel(row.month) }));
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Headcount" value={data.headcount} hint={`${data.joinedLast90Days} joined in the last 90 days`} />
        <Stat icon={TrendingDown} label="Attrition, 12 months" value={`${a.ratePercent}%`} hint={`${a.leavers} left (${a.voluntary} resigned) of ${a.averageHeadcount} on average`} />
        <Stat icon={Briefcase} label="Average tenure" value={data.averageTenureYears === null ? "—" : `${data.averageTenureYears} yrs`} hint="Of people with a hire date" />
        <Stat icon={LogOut} label="Serving notice" value={data.servingNotice} hint="Leaving soon" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Headcount" subtitle="At each month end, last 12 months" tall>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ left: -16, right: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={axis} />
              <YAxis tick={axis} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="headcount" name="Headcount" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Joiners and leavers" subtitle="By month" tall>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ left: -16, right: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={axis} />
              <YAxis tick={axis} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="joined" name="Joined" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="left" name="Left" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="By department"><HBars data={data.byDepartment.map((d) => ({ name: d.name, value: d.count }))} /></Card>
        {data.byBranch.length > 1 && <Card title="By branch"><HBars data={data.byBranch.map((d) => ({ name: d.name, value: d.count }))} color="var(--chart-5)" /></Card>}
        <Card title="Tenure"><Donut data={data.byTenure} /></Card>
        <Card title="Employment type"><Donut data={data.byEmploymentType} /></Card>
        <Card title="Gender" subtitle="From statutory details"><Donut data={data.byGender} /></Card>
        <Card title="Why people left" subtitle="Last 12 months"><Donut data={data.leaversByReason} /></Card>
      </div>
    </div>
  );
};

const iso = (date: Date) => date.toLocaleDateString("en-CA");

const AttendanceTab: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [range, setRange] = useState(() => {
    const to = new Date();
    to.setDate(to.getDate() - 1);
    const from = new Date(to);
    from.setDate(from.getDate() - 29);
    return { from: iso(from), to: iso(to) };
  });
  const { data, isLoading, error } = useQuery(attendanceInsightsQuery(organizationId, range.from, range.to));
  const s = data?.summary;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From">{(id) => <input id={id} type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} className={inputClass} />}</Field>
        <Field label="To">{(id) => <input id={id} type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} className={inputClass} />}</Field>
        <p className="pb-2 text-xs text-muted-foreground">Up to 93 days. Weekly offs and holidays are not counted.</p>
      </div>
      {isLoading ? (
        <Spinner />
      ) : !data || !s ? (
        <ErrorText message={error?.message ?? "Could not load attendance insights."} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={Users} label="Attendance rate" value={s.attendanceRatePercent === null ? "—" : `${s.attendanceRatePercent}%`} hint={`${s.present} present, ${s.halfDays} half days, ${s.absent} absent`} />
            <Stat icon={Clock} label="Late arrivals" value={s.lateArrivals} hint={s.lateArrivals ? `${s.averageLateMinutes} min late on average` : undefined} />
            <Stat icon={CalendarHeart} label="Leave days taken" value={data.leave.daysTaken} hint={`${s.onLeave} working days on leave`} />
            <Stat icon={Briefcase} label="Extra hours worked" value={s.overtimeHours} hint={s.incomplete ? `${s.incomplete} days missing a check-out` : "Beyond the shift"} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="By weekday" subtitle="A Monday or Friday spike in absences is worth a look">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byWeekday} margin={{ left: -16, right: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tick={axis} />
                  <YAxis tick={axis} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="absent" name="Absent" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" name="Late" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Attendance rate by department" subtitle="Lowest first">
              <HBars data={data.byDepartment.map((d) => ({ name: d.name, value: d.attendanceRatePercent ?? 0 }))} format={(v) => `${v}%`} color="var(--chart-2)" />
            </Card>
            <Card title="Leave by type" subtitle="Approved days starting in the period">
              <HBars data={data.leave.byType.map((d) => ({ name: d.name, value: d.days }))} color="var(--chart-3)" />
            </Card>
            <section className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-5">
              {[
                { title: "Most often late", rows: data.mostLate.map((r) => ({ id: r.employeeId, name: r.name, value: `${r.count}×, ${r.lateMinutes} min` })) },
                { title: "Most absent", rows: data.mostAbsent.map((r) => ({ id: r.employeeId, name: r.name, value: `${r.count} day(s)` })) },
              ].map((list) => (
                <div key={list.title}>
                  <h2 className="text-sm font-semibold">{list.title}</h2>
                  {list.rows.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No one.</p>
                  ) : (
                    <ol className="mt-2 space-y-1 text-sm">
                      {list.rows.map((row) => (
                        <li key={row.id} className="flex justify-between gap-2">
                          <Link to={`/employees/${row.id}/edit`} className="truncate hover:underline">{row.name}</Link>
                          <span className="shrink-0 text-muted-foreground">{row.value}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
};

const EVENT_ICON: Record<UpcomingInsights["events"][number]["type"], React.ElementType> = {
  birthday: Cake,
  anniversary: CalendarHeart,
  notice_ends: LogOut,
  gratuity_due: HandCoins,
};

const UpcomingTab: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { data, isLoading, error } = useQuery(upcomingInsightsQuery(organizationId));
  if (isLoading) return <Spinner />;
  if (!data) return <ErrorText message={error?.message ?? "Could not load upcoming events."} />;
  const p = data.pending;
  const todo = [
    { label: "Leave requests to review", count: p.leaveRequests, to: "/leave/applications" },
    { label: "Expense claims to review", count: p.expenseClaims, to: "/expenses/review" },
    { label: "Attendance corrections to review", count: p.attendanceCorrections, to: "/attendance/corrections" },
    { label: "Asset receipts not confirmed by employees", count: p.assetReceiptsUnconfirmed, to: "/assets" },
    { label: "Employees without a hire date (tenure, gratuity and anniversaries need it)", count: p.missingHireDates, to: "/employees" },
    { label: "Employees without a date of birth", count: p.missingBirthDates, to: "/employees" },
  ].filter((item) => item.count > 0);
  const when = (days: number) => (days < 0 ? `${-days} day(s) ago` : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Next 30 days</h2>
        {data.events.length === 0 ? (
          <EmptyState text="Nothing coming up. Add dates of birth and hire dates to see birthdays and work anniversaries." />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {data.events.map((event) => {
              const Icon = EVENT_ICON[event.type];
              return (
                <li key={`${event.type}-${event.employeeId}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <Link to={`/employees/${event.employeeId}/edit`} className="text-sm font-medium hover:underline">{event.name}</Link>
                    <p className="text-xs text-muted-foreground">{event.detail} · {new Date(`${event.date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</p>
                  </div>
                  <span className={`shrink-0 text-xs ${event.inDays <= 0 ? "font-medium text-primary" : "text-muted-foreground"}`}>{when(event.inDays)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Needs attention</h2>
        {todo.length === 0 ? (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">All clear.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {todo.map((item) => (
              <li key={item.label}>
                <Link to={item.to} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50">
                  <span>{item.label}</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{item.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

const CostTab: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { data, isLoading, error } = useQuery(costInsightsQuery(organizationId, true));
  if (isLoading) return <Spinner />;
  if (!data) return <ErrorText message={error?.message ?? "Could not load payroll cost."} />;
  const trend = data.trend.map((row) => ({ ...row, label: monthLabel(row.month) }));
  const year = data.trend.reduce((sum, row) => sum + row.totalCost, 0);
  const latest = [...data.trend].reverse().find((row) => row.employees > 0);
  return (
    <div className="space-y-5">
      {!latest ? (
        <EmptyState text="No finalized payroll in the last 12 months yet." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={HandCoins} label="Cost, last 12 months" value={lakh(year)} hint="Gross pay plus employer PF and ESI" />
            <Stat icon={HandCoins} label={`Cost, ${monthLabel(latest.month)}`} value={inr(latest.totalCost)} hint={`${latest.employees} employee(s)`} />
            <Stat icon={Users} label="Average cost per employee" value={inr(Math.round(latest.totalCost / Math.max(latest.employees, 1)))} hint={monthLabel(latest.month)} />
            <Stat icon={Clock} label="Overtime paid" value={inr(latest.overtime)} hint={monthLabel(latest.month)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Payroll cost by month" subtitle="Finalized payroll" tall>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={axis} />
                  <YAxis tick={axis} tickFormatter={lakh} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => inr(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="gross" name="Gross pay" stackId="cost" fill="var(--chart-1)" />
                  <Bar dataKey="employerContributions" name="Employer PF & ESI" stackId="cost" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title={`By department, ${monthLabel(latest.month)}`} tall><HBars data={data.byDepartment.map((d) => ({ name: d.name, value: d.cost }))} format={lakh} /></Card>
            {data.byBranch.length > 1 && <Card title={`By branch, ${monthLabel(latest.month)}`}><HBars data={data.byBranch.map((d) => ({ name: d.name, value: d.cost }))} format={lakh} color="var(--chart-5)" /></Card>}
            <Card title="Expense claims by category" subtitle="Approved, last 6 months"><HBars data={data.expensesLast6Months.map((d) => ({ name: d.name, value: d.amount }))} format={lakh} color="var(--chart-3)" /></Card>
          </div>
        </>
      )}
    </div>
  );
};

/** HR insights: workforce, attendance, what is coming up, and (for owners and admins) payroll cost. */
const InsightsPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const [params, setParams] = useSearchParams();
  const showCost = hasManagerRole(organizationId);
  const tabs = [
    { id: "workforce", label: "Workforce" },
    { id: "attendance", label: "Attendance & leave" },
    { id: "upcoming", label: "Upcoming" },
    ...(showCost ? [{ id: "cost", label: "Payroll cost" }] : []),
  ];
  const tab = tabs.some((t) => t.id === params.get("tab")) ? params.get("tab")! : "workforce";
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader title="HR insights" description="Headcount, attrition, attendance patterns, upcoming events and payroll cost, from the data already in Vetanly." />
      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setParams({ tab: t.id })}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "workforce" && <WorkforceTab organizationId={organizationId} />}
      {tab === "attendance" && <AttendanceTab organizationId={organizationId} />}
      {tab === "upcoming" && <UpcomingTab organizationId={organizationId} />}
      {tab === "cost" && showCost && <CostTab organizationId={organizationId} />}
    </div>
  );
};

export default InsightsPage;
