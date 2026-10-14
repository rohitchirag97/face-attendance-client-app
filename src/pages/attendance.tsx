import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorText,
  Field,
  PageHeader,
  Spinner,
} from "@/components/form-kit";
import { TimeInput } from "@/components/time-input";
import { formatDateTime, formatTime12Hour, inputClass } from "@/lib/form-utils";
import { employeesQuery } from "@/hooks/use-api";
import { attendanceQuery, dailyAttendanceQuery, leaveRequestsQuery, leaveTypesQuery, useBulkManualAttendance, useManualAttendance } from "@/hooks/use-payroll-api";
import { canManagePeople, getActiveOrganizationId } from "@/lib/session";

const toIso = (localValue: string) => (localValue ? new Date(localValue).toISOString() : undefined);
const toLocalDateTimeInput = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const ManualEntry: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { data: employees = [] } = useQuery(employeesQuery(organizationId));
  const { data: leaves = [] } = useQuery(leaveRequestsQuery(organizationId));
  const record = useManualAttendance(organizationId);
  const [employeeId, setEmployeeId] = useState("");
  const [eventType, setEventType] = useState<"check_in" | "check_out">("check_in");
  const [entryDateValue, setEntryDateValue] = useState("");
  const [entryTime, setEntryTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const occurredAt = entryDateValue ? `${entryDateValue}T${entryTime}` : "";

  // Full-day approved leave on the chosen date (today if none chosen) blocks the entry.
  const entryDate = entryDateValue || new Date().toLocaleDateString("en-CA");
  const onLeave = new Set(
    leaves
      .filter(
        (leave) =>
          leave.status === "approved" &&
          !leave.isHalfDay &&
          leave.startDate <= entryDate &&
          entryDate <= leave.endDate,
      )
      .map((leave) => leave.employeeId),
  );

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    const iso = toIso(occurredAt);
    if (!employeeId || !iso) return setError("Choose an employee and a date and time.");
    if (onLeave.has(employeeId)) return setError("This employee is on approved leave on that date.");
    record.mutate(
      { employeeId, eventType, occurredAt: iso, utcOffsetMinutes: -new Date().getTimezoneOffset() },
      {
        onSuccess: () => {
          setEntryDateValue("");
          setSuccess(
            `${eventType === "check_in" ? "Check-in" : "Check-out"} recorded for ${entryDate} at ${formatTime12Hour(entryTime)}.`,
          );
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3 sm:items-end" noValidate>
      <Field label="Employee">
        {(id) => (
          <select id={id} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
            <option value="">Select…</option>
            {employees
              .filter((employee) => employee.isActive)
              .map((employee) => (
                <option
                  key={employee.id}
                  value={employee.id}
                  disabled={onLeave.has(employee.id)}
                  className={onLeave.has(employee.id) ? "text-muted-foreground" : undefined}
                >
                  {employee.fname} {employee.lname}
                  {onLeave.has(employee.id) ? " — On leave" : ""}
                </option>
              ))}
          </select>
        )}
      </Field>
      <Field label="Event">
        {(id) => (
          <select
            id={id}
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value as typeof eventType);
              if (!entryDateValue) {
                const now = toLocalDateTimeInput();
                setEntryDateValue(now.slice(0, 10));
                setEntryTime(now.slice(11, 16));
              }
            }}
            className={inputClass}
          >
            <option value="check_in">Check in</option>
            <option value="check_out">Check out</option>
          </select>
        )}
      </Field>
      <Field label="Date">
        {(id) => (
          <input id={id} type="date" value={entryDateValue} onChange={(e) => setEntryDateValue(e.target.value)} className={inputClass} />
        )}
      </Field>
      <TimeInput label="Time" value={entryTime} onChange={setEntryTime} />
      <Button type="submit" className="h-10" disabled={record.isPending}>
        {record.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
        Add entry
      </Button>
      <div className="sm:col-span-3">
        <ErrorText message={error} />
        {success && <p role="status" className="text-sm text-emerald-700">{success}</p>}
      </div>
    </form>
  );
};

type RegisterStatus = "present" | "half_day" | "on_leave" | "absent";
const REGISTER_OPTIONS: { value: RegisterStatus; label: string; active: string; idle: string }[] = [
  { value: "present", label: "Present", active: "border-emerald-600 bg-emerald-600 text-white", idle: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" },
  { value: "half_day", label: "Half day", active: "border-amber-500 bg-amber-500 text-white", idle: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" },
  { value: "on_leave", label: "On leave", active: "border-sky-600 bg-sky-600 text-white", idle: "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100" },
  { value: "absent", label: "Absent", active: "border-red-600 bg-red-600 text-white", idle: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100" },
];

const BulkEntry: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { data: employees = [] } = useQuery(employeesQuery(organizationId));
  const { data: leaveTypes = [] } = useQuery(leaveTypesQuery(organizationId));
  const bulk = useBulkManualAttendance(organizationId);
  const today = new Date().toLocaleDateString("en-CA");
  const [date, setDate] = useState(today);
  const { data: daily = [] } = useQuery({
    ...dailyAttendanceQuery(organizationId, { from: date, to: date }),
    enabled: Boolean(date),
    refetchInterval: 5_000,
  });
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [marks, setMarks] = useState<Record<string, RegisterStatus>>({});
  const [overtime, setOvertime] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ done: number; failures: string[] } | null>(null);

  const people = employees.filter((e) => e.isActive);
  const existing = new Map(daily.map((d) => [d.employeeId, d]));
  // Anything other than "absent" means a punch or leave already exists for that day.
  const isLocked = (id: string) => {
    const status = existing.get(id)?.status;
    return Boolean(status && status !== "absent");
  };
  const editable = people.filter((p) => !isLocked(p.id));
  const nameOf = (id: string) => {
    const e = employees.find((x) => x.id === id);
    return e ? `${e.fname} ${e.lname}` : id;
  };
  const marked = editable.filter((p) => marks[p.id]);
  const allSelected = editable.length > 0 && editable.every((p) => selected.has(p.id));

  const changeDate = (value: string) => {
    setDate(value);
    setMarks({});
    setOvertime({});
    setSelected(new Set());
    setOutcome(null);
  };
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const setMark = (id: string, status: RegisterStatus) =>
    setMarks((prev) => ({ ...prev, [id]: status }));
  const applyToSelected = (status: RegisterStatus) =>
    setMarks((prev) => ({
      ...prev,
      ...Object.fromEntries([...selected].filter((id) => !isLocked(id)).map((id) => [id, status])),
    }));

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setOutcome(null);
    if (marked.length === 0) return setError("Mark at least one employee.");
    if (marked.some((p) => marks[p.id] === "on_leave") && !leaveTypeId) {
      return setError("Choose a leave type for employees marked on leave.");
    }
    bulk.mutate(
      {
        date,
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
        ...(leaveTypeId ? { leaveTypeId } : {}),
        entries: marked.map((p) => {
          const status = marks[p.id]!;
          const hours = Number(overtime[p.id] ?? 0);
          return {
            employeeId: p.id,
            status,
            overtimeMinutes: status === "present" && hours > 0 ? Math.round(hours * 60) : 0,
          };
        }),
      },
      {
        onSuccess: (results) => {
          setOutcome({
            done: results.filter((r) => r.ok).length,
            failures: results
              .filter((r) => !r.ok)
              .map((r) => `${nameOf(r.employeeId)}: ${r.message ?? "failed"}`),
          });
          setMarks({});
          setOvertime({});
          setSelected(new Set());
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border p-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <Field label="Date">
        {(id) => <input id={id} type="date" max={today} value={date} onChange={(e) => changeDate(e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Leave type (for On leave)">
          {(id) => (
            <select id={id} value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} className={inputClass}>
              <option value="">Select…</option>
              {leaveTypes.filter((t) => t.isActive).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => setMarks(Object.fromEntries(editable.map((p) => [p.id, "present" as RegisterStatus])))}
        >
          Mark all present
        </Button>
        <p className="self-center text-xs text-muted-foreground sm:col-span-1">
          Pick a past date to see what was recorded that day.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Present and Half day use the employee's shift times. Absent records nothing. Overtime (hours) extends the check-out.
      </p>

      <div className="overflow-hidden rounded-lg border">
        <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm">
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => setSelected(e.target.checked ? new Set(editable.map((p) => p.id)) : new Set())}
            />
            Select all ({selected.size} selected)
          </label>
          <span className="ml-auto text-xs text-muted-foreground">Mark selected as:</span>
          {REGISTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={selected.size === 0}
              onClick={() => applyToSelected(option.value)}
              className={`rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-40 ${option.idle}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <ul className="max-h-96 divide-y overflow-auto">
          {people.map((p) => {
            const current = marks[p.id];
            const record = existing.get(p.id);
            const locked = isLocked(p.id);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  aria-label={`Select ${p.fname} ${p.lname}`}
                  disabled={locked}
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span className="min-w-32 flex-1 truncate font-medium">{p.fname} {p.lname}</span>
                {locked && record ? (
                  <span className="whitespace-nowrap rounded-md bg-muted px-2 py-1 text-xs">
                    Already recorded: {record.status.replace("_", " ")}
                    {record.firstCheckIn ? ` · ${formatTime12Hour(new Date(record.firstCheckIn).toTimeString().slice(0, 5))}` : ""}
                    {record.lastCheckOut ? ` – ${formatTime12Hour(new Date(record.lastCheckOut).toTimeString().slice(0, 5))}` : ""}
                  </span>
                ) : (
                  <>
                    <div className="inline-flex shrink-0 gap-1">
                      {REGISTER_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={current === option.value}
                          onClick={() => setMark(p.id, option.value)}
                          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                            current === option.value ? option.active : option.idle
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={12}
                      step={0.25}
                      placeholder="OT hrs"
                      aria-label={`Overtime hours for ${p.fname} ${p.lname}`}
                      disabled={current !== "present"}
                      value={overtime[p.id] ?? ""}
                      onChange={(e) => setOvertime((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="h-9 w-20 shrink-0 rounded-md border bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-40"
                    />
                  </>
                )}
              </li>
            );
          })}
          {people.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">No employees available on this date.</li>}
        </ul>
      </div>

      <Button type="submit" disabled={bulk.isPending}>
        {bulk.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
        Save attendance for {marked.length} employee{marked.length === 1 ? "" : "s"}
      </Button>
      <ErrorText message={error} />
      {outcome && (
        <div role="status" className="space-y-1 text-sm">
          <p className="text-emerald-700">{outcome.done} entries recorded.</p>
          {outcome.failures.length > 0 && (
            <ul className="list-disc pl-5 text-destructive">
              {outcome.failures.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
};

const ManualSection: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [mode, setMode] = useState<"single" | "bulk">("bulk");
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg border p-1">
        {(["bulk", "single"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {value === "bulk" ? "Bulk entry" : "Single entry"}
          </button>
        ))}
      </div>
      {mode === "bulk" ? <BulkEntry organizationId={organizationId} /> : <ManualEntry organizationId={organizationId} />}
    </div>
  );
};

const dateInput = (offsetDays = 0) => {
  const date = new Date(Date.now() - offsetDays * 86_400_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const hoursText = (minutes: number | null) =>
  minutes === null ? "–" : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;

const timeText = (value: string | null) =>
  value
    ? new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "–";

const dayStatusStyle = {
  present: "bg-green-100 text-green-800",
  half_day: "bg-amber-100 text-amber-800",
  absent: "bg-red-100 text-red-800",
  incomplete: "bg-muted text-muted-foreground",
  on_leave: "bg-violet-100 text-violet-800",
};

const dayStatusLabel = {
  present: "Present",
  half_day: "Half day",
  absent: "Absent",
  on_leave: "On leave",
  incomplete: "Incomplete",
};

const DailySummary: React.FC<{ organizationId: string; isManager: boolean }> = ({
  organizationId,
  isManager,
}) => {
  const [from, setFrom] = useState(dateInput(6));
  const [to, setTo] = useState(dateInput());
  const [status, setStatus] = useState("");
  const { data, isLoading, error } = useQuery({
    ...dailyAttendanceQuery(organizationId, { from, to }),
    enabled: Boolean(from && to && from <= to),
    refetchInterval: 5_000,
  });
  const rows = (data ?? []).filter((row) => !status || row.status === status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="From">
          {(id) => <input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />}
        </Field>
        <Field label="To">
          {(id) => <input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Status">
          {(id) => (
            <select id={id} value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="">All</option>
              {Object.entries(dayStatusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <ErrorText message={error?.message} />
      {isLoading ? (
        <Spinner />
      ) : !rows.length ? (
        <EmptyState text="No attendance for this period." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Date</th>
                {isManager && <th className="p-3">Employee</th>}
                <th className="p-3">In</th>
                <th className="p-3">Out</th>
                <th className="p-3">Worked</th>
                <th className="p-3">Expected</th>
                <th className="p-3">Late / early</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={`${row.employeeId}-${row.date}`}>
                  <td className="p-3">{row.date}</td>
                  {isManager && <td className="p-3">{row.employeeName}</td>}
                  <td className="p-3">{timeText(row.firstCheckIn)}</td>
                  <td className="p-3">{timeText(row.lastCheckOut)}</td>
                  <td className="p-3">{hoursText(row.workedMinutes)}</td>
                  <td className="p-3">{hoursText(row.expectedMinutes)}</td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {row.lateMinutes > 0 && `Late ${row.lateMinutes}m`}
                    {row.lateMinutes > 0 && row.earlyLeaveMinutes > 0 && " · "}
                    {row.earlyLeaveMinutes > 0 && `Left ${row.earlyLeaveMinutes}m early`}
                    {row.lateMinutes === 0 && row.earlyLeaveMinutes === 0 && "–"}
                  </td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${dayStatusStyle[row.status]}`}>
                      {dayStatusLabel[row.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Attendance: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const isManager = canManagePeople(organizationId);
  const [view, setView] = useState<"daily" | "logs">("daily");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: logs, isLoading, error } = useQuery({
    ...attendanceQuery(organizationId, {
      from: toIso(from),
      to: to ? toIso(`${to}T23:59:59`) : undefined,
    }),
    refetchInterval: 5_000,
  });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Attendance"
        description={
          isManager
            ? "Attendance logs from kiosks and manual entries. Logs cannot be edited or deleted."
            : "Your attendance history."
        }
      />

      {isManager && <ManualSection organizationId={organizationId} />}

      <div className="inline-flex rounded-lg border p-1">
        {(["daily", "logs"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              view === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {value === "daily" ? "Daily summary" : "Raw logs"}
          </button>
        ))}
      </div>

      {view === "daily" ? (
        <DailySummary organizationId={organizationId} isManager={isManager} />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
        <Field label="From">
          {(id) => <input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value ? `${e.target.value}T00:00:00` : "")} className={inputClass} />}
        </Field>
        <Field label="To">
          {(id) => <input id={id} type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />}
        </Field>
      </div>
      <ErrorText message={error?.message} />

      {isLoading ? (
        <Spinner />
      ) : !logs?.length ? (
        <EmptyState text="No attendance records found." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3">Event</th>
                <th className="p-3">Time</th>
                <th className="p-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="p-3">{log.employeeName}</td>
                  <td className="p-3">{log.eventType === "check_in" ? "Check in" : "Check out"}</td>
                  <td className="p-3">{formatDateTime(log.occurredAt)}</td>
                  <td className="p-3 capitalize">{log.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default Attendance;
