import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, PageHeader, Spinner } from "@/components/form-kit";
import {
  dailyAttendanceQuery,
  holidaysQuery,
  leaveRequestsQuery,
  payrollSettingsQuery,
  type DailyAttendance,
} from "@/hooks/use-payroll-api";
import { getActiveOrganizationId } from "@/lib/session";

type Kind = DailyAttendance["status"] | "holiday" | "weekly_off" | "none";

const kindStyle: Record<Kind, { label: string; className: string }> = {
  present: { label: "Present", className: "bg-green-100 text-green-800" },
  half_day: { label: "Half day", className: "bg-lime-100 text-lime-800" },
  incomplete: { label: "Incomplete", className: "bg-orange-100 text-orange-800" },
  absent: { label: "Absent", className: "bg-red-100 text-red-800" },
  on_leave: { label: "On leave", className: "bg-blue-100 text-blue-800" },
  holiday: { label: "Holiday", className: "bg-purple-100 text-purple-800" },
  weekly_off: { label: "Week off", className: "bg-muted text-muted-foreground" },
  none: { label: "", className: "" },
};

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

const clock = (value: string | null) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

const hours = (minutes: number | null) =>
  minutes === null ? "" : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

const MyAttendance: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const myId = (JSON.parse(localStorage.getItem("user") ?? "{}") as { id?: string }).id;
  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());

  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const from = dateKey(cursor.year, cursor.month, 1);
  const to = dateKey(cursor.year, cursor.month, daysInMonth);

  const daily = useQuery({ ...dailyAttendanceQuery(organizationId, { from, to, employeeId: myId }), enabled: !!myId });
  const { data: holidays = [] } = useQuery(holidaysQuery(organizationId));
  const { data: leaves = [] } = useQuery(leaveRequestsQuery(organizationId));
  const { data: settings } = useQuery(payrollSettingsQuery(organizationId));

  const weeklyOffDays = settings?.weeklyOffDays;

  const { cells, summary } = useMemo(() => {
    const weeklyOff = weeklyOffDays ?? [0];
    const byDate = new Map((daily.data ?? []).map((row) => [row.date, row]));
    const holidayByDate = new Map(holidays.map((holiday) => [holiday.date, holiday.name]));
    const myLeaves = leaves.filter((leave) => leave.employeeId === myId && leave.status === "approved");
    const counts = { present: 0, half_day: 0, absent: 0, on_leave: 0, late: 0, holidays: 0 };

    const result = Array.from({ length: daysInMonth }, (_, index) => {
      const date = dateKey(cursor.year, cursor.month, index + 1);
      const row = byDate.get(date);
      const weekday = new Date(cursor.year, cursor.month, index + 1).getDay();
      const holidayName = holidayByDate.get(date);
      const onLeave = myLeaves.some((leave) => leave.startDate <= date && date <= leave.endDate);

      let kind: Kind = "none";
      if (row) kind = row.status;
      else if (holidayName) kind = "holiday";
      else if (weeklyOff.includes(weekday)) kind = "weekly_off";
      else if (onLeave) kind = "on_leave";

      if (kind === "present" || kind === "incomplete") counts.present += 1;
      else if (kind === "half_day") counts.half_day += 1;
      else if (kind === "absent") counts.absent += 1;
      else if (kind === "on_leave") counts.on_leave += 1;
      else if (kind === "holiday") counts.holidays += 1;
      if (row && row.lateMinutes > 0) counts.late += 1;

      return { date, day: index + 1, weekday, kind, row, holidayName };
    });
    return { cells: result, summary: counts };
  }, [daily.data, holidays, leaves, myId, weeklyOffDays, cursor, daysInMonth]);

  const leading = new Date(cursor.year, cursor.month, 1).getDay();
  const title = new Date(cursor.year, cursor.month, 1).toLocaleDateString([], { month: "long", year: "numeric" });
  const step = (delta: number) => {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const stats = [
    ["Present", summary.present],
    ["Half days", summary.half_day],
    ["Absent", summary.absent],
    ["On leave", summary.on_leave],
    ["Late marks", summary.late],
    ["Holidays", summary.holidays],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="My attendance"
        description="Your present, absent, leave and holiday days with late marks."
        action={
          <Link
            to="/attendance/corrections"
            className="inline-flex h-8 items-center rounded-lg border px-3 text-sm font-medium hover:bg-muted"
          >
            Request a correction
          </Link>
        }
      />

      <div className="flex items-center justify-between">
        <Button size="icon" variant="outline" aria-label="Previous month" onClick={() => step(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button size="icon" variant="outline" aria-label="Next month" onClick={() => step(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-background p-3 text-center shadow-sm">
            <p className="text-xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <ErrorText message={daily.error?.message} />
      {daily.isLoading ? (
        <Spinner />
      ) : (
        <div className="rounded-xl border bg-background p-2 shadow-sm sm:p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => (
              <div key={name} className="py-1">
                {name}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leading }, (_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {cells.map((cell) => {
              const style = kindStyle[cell.kind];
              const canCorrect =
                cell.date <= todayKey &&
                (cell.kind === "absent" || cell.kind === "incomplete" || (cell.row?.lateMinutes ?? 0) > 0);
              const detail = [
                cell.holidayName,
                cell.row?.firstCheckIn && `In ${clock(cell.row.firstCheckIn)}`,
                cell.row?.lastCheckOut && `Out ${clock(cell.row.lastCheckOut)}`,
                cell.row?.workedMinutes != null && hours(cell.row.workedMinutes),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={cell.date}
                  title={detail || style.label}
                  className={`flex min-h-16 flex-col gap-0.5 rounded-lg border p-1 text-xs sm:min-h-20 sm:p-1.5 ${
                    cell.date === todayKey ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <span className="font-medium">{cell.day}</span>
                  {style.label && (
                    <span className={`truncate rounded px-1 py-0.5 text-[10px] font-medium sm:text-xs ${style.className}`}>
                      {style.label}
                    </span>
                  )}
                  {cell.row && cell.row.lateMinutes > 0 && (
                    <span className="truncate rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-800 sm:text-xs">
                      Late {cell.row.lateMinutes}m
                    </span>
                  )}
                  {cell.row?.firstCheckIn && (
                    <span className="hidden truncate text-[10px] text-muted-foreground sm:block">
                      {clock(cell.row.firstCheckIn)}–{clock(cell.row.lastCheckOut)}
                    </span>
                  )}
                  {canCorrect && (
                    <Link
                      to={`/attendance/corrections?date=${cell.date}`}
                      className="mt-auto truncate text-[10px] text-primary underline sm:text-xs"
                    >
                      Correct
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAttendance;
