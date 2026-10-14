import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { CalendarDays, ChevronDown } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, Spinner } from "@/components/form-kit";
import {
  dailyAttendanceQuery,
  mySlipsQuery,
  type DailyAttendance,
} from "@/hooks/use-payroll-api";

const COLORS = {
  present: "#38bd8b",
  half_day: "#a879f5",
  absent: "#ee6d7b",
  incomplete: "#94a3b8",
  on_leave: "#f3ad43",
  leave: "#8b5cf6",
  net: "#6246e5",
};

const STATUS_LABELS: Record<DailyAttendance["status"], string> = {
  present: "Present",
  half_day: "Half day",
  absent: "Absent",
  incomplete: "Incomplete",
  on_leave: "On leave",
};

const pad = (value: number) => String(value).padStart(2, "0");
const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

const monthDateRange = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const from = new Date(year, monthNumber - 1, 1);
  const to = new Date(year, monthNumber, 0);
  return {
    from: toDateKey(from),
    to: toDateKey(to),
  };
};

const formatMonthLabel = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  }).replace(" ", "-");
};

const lastDays = (count: number) => {
  const days: string[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (count - 1));
  for (let i = 0; i < count; i += 1) {
    days.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const ChartCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({
  title,
  subtitle,
  children,
}) => (
  <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
    <h2 className="text-sm font-semibold">{title}</h2>
    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    <div className="mt-3 h-64">{children}</div>
  </section>
);

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
};

const Donut: React.FC<{ data: { name: string; value: number; color: string }[] }> = ({ data }) => {
  const visible = data.filter((slice) => slice.value > 0);
  if (!visible.length) return <EmptyState text="Nothing to show yet." />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={visible} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
          {visible.map((slice) => (
            <Cell key={slice.name} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const AdminCharts: React.FC<{
  organizationId: string;
}> = ({ organizationId }) => {
  const [month, setMonth] = React.useState(currentMonthKey);
  const monthRange = React.useMemo(() => monthDateRange(month), [month]);
  const daily = useQuery(dailyAttendanceQuery(organizationId, monthRange));
  const rows = daily.data ?? [];
  const counts = (Object.keys(STATUS_LABELS) as DailyAttendance["status"][]).map((status) => ({
    name: STATUS_LABELS[status],
    value: rows.filter((row) => row.status === status).length,
    color: COLORS[status],
  }));
  const total = counts.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-primary" />
          Attendance Overview
        </h2>
        <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40">
          <span>{formatMonthLabel(month)}</span>
          <ChevronDown className="size-3.5" />
          <input
            type="month"
            aria-label="Attendance month"
            value={month}
            max={currentMonthKey()}
            onChange={(event) => {
              if (event.target.value) setMonth(event.target.value);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
      {daily.isLoading ? (
        <div className="flex h-48 items-center justify-center"><Spinner /></div>
      ) : (
        <div className="grid items-center gap-3 sm:grid-cols-[minmax(130px,0.85fr)_1.15fr]">
          <div className="relative mx-auto size-36">
            {total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={counts.filter((item) => item.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="68%"
                    outerRadius="92%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {counts.filter((item) => item.value > 0).map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-3 rounded-full border-[18px] border-muted" />
            )}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tracking-tight">{total.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
          </div>
          <div className="space-y-3">
            {counts.map((item) => {
              const percentage = total ? (item.value / total) * 100 : 0;
              return (
                <div key={item.name} className="flex items-center gap-1.5 text-xs">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="min-w-0 flex-1 text-muted-foreground">{item.name}</span>
                  <span className="font-medium tabular-nums">{item.value.toLocaleString()}</span>
                  <span className="w-12 text-right text-[11px] text-muted-foreground">({percentage.toFixed(1)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="mt-4 border-t border-border pt-3 text-center">
        <Link to="/reports" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          View Attendance Report
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
};

export const EmployeeCharts: React.FC<{ organizationId: string; userId: string }> = ({
  organizationId,
  userId,
}) => {
  const days = React.useMemo(() => lastDays(30), []);
  const daily = useQuery(
    dailyAttendanceQuery(organizationId, { from: days[0], to: days[days.length - 1], employeeId: userId }),
  );
  const slips = useQuery(mySlipsQuery(organizationId));

  const counts = (Object.keys(STATUS_LABELS) as DailyAttendance["status"][]).map((status) => ({
    name: STATUS_LABELS[status],
    value: (daily.data ?? []).filter((row) => row.status === status).length,
    color: COLORS[status],
  }));

  const slipData = [...(slips.data ?? [])]
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .slice(-6)
    .map((slip) => ({
      label: new Date(`${slip.periodStart.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        year: "2-digit",
      }),
      Net: Number(slip.netPay),
    }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="My attendance, last 30 days" subtitle="Days by status">
        {daily.isLoading ? <Spinner /> : <Donut data={counts} />}
      </ChartCard>
      <ChartCard title="My net pay" subtitle="From your finalized salary slips">
        {slips.isLoading ? (
          <Spinner />
        ) : !slipData.length ? (
          <EmptyState text="No salary slips yet." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={slipData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={48} stroke="var(--muted-foreground)" />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.15)" }} />
              <Bar dataKey="Net" fill={COLORS.net} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
};
