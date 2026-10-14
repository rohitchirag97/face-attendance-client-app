import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import { formatDateTime, inputClass, toNumberOrNull, toTextOrNull } from "@/lib/form-utils";
import { employeesQuery } from "@/hooks/use-api";
import {
  leaveBalancesQuery,
  leaveRequestsQuery,
  leaveTypesQuery,
  useCreateLeaveRequest,
  useSaveLeaveType,
  useUpdateLeaveStatus,
  type LeaveStatus,
} from "@/hooks/use-payroll-api";
import { canManagePeople, getActiveOrganizationId } from "@/lib/session";

const statusStyle: Record<LeaveStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};

const StatusBadge: React.FC<{ status: LeaveStatus }> = ({ status }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyle[status]}`}>
    {status}
  </span>
);

const RequestForm: React.FC<{ organizationId: string; isManager: boolean }> = ({
  organizationId,
  isManager,
}) => {
  const { data: types = [] } = useQuery(leaveTypesQuery(organizationId));
  const { data: employees = [] } = useQuery({
    ...employeesQuery(organizationId),
    enabled: isManager,
  });
  const create = useCreateLeaveRequest(organizationId);
  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeTypes = types.filter((t) => t.isActive);

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const typeId = leaveTypeId || activeTypes[0]?.id;
    if (!typeId) return setError("No leave types are available yet.");
    if (!startDate) return setError("Choose a start date.");
    const end = isHalfDay || !endDate ? startDate : endDate;
    if (end < startDate) return setError("End date cannot be before start date.");
    create.mutate(
      {
        employeeId: isManager && employeeId ? employeeId : undefined,
        leaveTypeId: typeId,
        startDate,
        endDate: end,
        isHalfDay,
        reason: toTextOrNull(reason) ?? undefined,
      },
      {
        onSuccess: () => {
          setStartDate("");
          setEndDate("");
          setIsHalfDay(false);
          setReason("");
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border bg-background p-4 shadow-sm sm:grid-cols-2" noValidate>
      {isManager && (
        <div className="sm:col-span-2">
          <Field label="Employee" hint="Leave empty to apply for yourself.">
            {(id) => (
              <select id={id} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
                <option value="">Myself</option>
                {employees
                  .filter((employee) => employee.isActive)
                  .map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fname} {employee.lname}
                    </option>
                  ))}
              </select>
            )}
          </Field>
        </div>
      )}
      <Field label="Leave type">
        {(id) => (
          <select id={id} value={leaveTypeId || activeTypes[0]?.id || ""} onChange={(e) => setLeaveTypeId(e.target.value)} className={inputClass}>
            {activeTypes.length === 0 && <option value="">No leave types</option>}
            {activeTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.isPaid ? "" : " (unpaid)"}
              </option>
            ))}
          </select>
        )}
      </Field>
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input type="checkbox" checked={isHalfDay} onChange={(e) => setIsHalfDay(e.target.checked)} />
        Half day
      </label>
      <Field label={isHalfDay ? "Date" : "From"}>
        {(id) => <input id={id} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />}
      </Field>
      {!isHalfDay && (
        <Field label="To">
          {(id) => <input id={id} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />}
        </Field>
      )}
      <div className="sm:col-span-2">
        <Field label="Reason (optional)">
          {(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={inputClass} />}
        </Field>
      </div>
      <div className="space-y-2 sm:col-span-2 sm:text-right">
        <ErrorText message={error} />
        <Button type="submit" className="h-10" disabled={create.isPending}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {isManager ? "Create" : "Apply for leave"}
        </Button>
      </div>
    </form>
  );
};

const Balances: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { data = [] } = useQuery(leaveBalancesQuery(organizationId));
  if (data.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((b) => (
        <div key={b.leaveTypeId} className="rounded-xl border border-l-4 border-l-primary bg-background p-3 shadow-sm">
          <p className="text-sm text-muted-foreground">{b.name}</p>
          <p className="mt-1 text-xl font-semibold">
            {b.remainingDays === null ? "Unlimited" : `${b.remainingDays} left`}
          </p>
          <p className="text-xs text-muted-foreground">
            {b.usedDays} used{b.allowanceDays !== null && ` of ${b.allowanceDays}`} this year
          </p>
        </div>
      ))}
    </div>
  );
};

const LeaveTypes: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { data: types = [] } = useQuery(leaveTypesQuery(organizationId));
  const save = useSaveLeaveType(organizationId);
  const [name, setName] = useState("");
  const [allowance, setAllowance] = useState("");
  const [isPaid, setIsPaid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const add = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Enter a name.");
    save.mutate(
      { name: name.trim(), isPaid, annualAllowanceDays: toNumberOrNull(allowance) },
      {
        onSuccess: () => {
          setName("");
          setAllowance("");
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <section className="space-y-3 rounded-xl border bg-background p-4 shadow-sm">
      <h2 className="font-semibold">Leave types</h2>
      <ul className="divide-y text-sm">
        {types.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className={t.isActive ? "" : "text-muted-foreground line-through"}>
              {t.name} Â· {t.isPaid ? "paid" : "unpaid"} Â·{" "}
              {t.annualAllowanceDays === null ? "no limit" : `${t.annualAllowanceDays} days/year`}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={save.isPending}
              onClick={() => save.mutate({ id: t.id, isActive: !t.isActive })}
            >
              {t.isActive ? "Deactivate" : "Activate"}
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-4" noValidate>
        <Field label="Name">
          {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={inputClass} />}
        </Field>
        <Field label="Days per year">
          {(id) => <input id={id} type="number" min="0" step="0.5" placeholder="No limit" value={allowance} onChange={(e) => setAllowance(e.target.value)} className={inputClass} />}
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} />
          Paid
        </label>
        <div className="flex items-end">
          <Button type="submit" className="h-10" disabled={save.isPending}>
            Add type
          </Button>
        </div>
      </form>
      <ErrorText message={error} />
    </section>
  );
};

const PAGE_SIZE = 10;

export const LeaveApplicationsPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const isManager = canManagePeople(organizationId);
  const { data: items, isLoading, error: loadError } = useQuery(leaveRequestsQuery(organizationId));
  const updateStatus = useUpdateLeaveStatus(organizationId);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | LeaveStatus>("all");
  const [page, setPage] = useState(1);
  const myId = (JSON.parse(localStorage.getItem("user") ?? "{}") as { id?: string }).id;

  const change = (id: string, next: "approved" | "rejected" | "cancelled") => {
    setError(null);
    updateStatus.mutate({ id, status: next }, { onError: (e) => setError(e.message) });
  };

  const term = search.trim().toLowerCase();
  const filtered = (items ?? []).filter(
    (item) =>
      (status === "all" || item.status === status) &&
      (!term ||
        [item.employeeName, item.leaveTypeName, item.reason ?? "", item.startDate, item.endDate]
          .join(" ")
          .toLowerCase()
          .includes(term)),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Leave applications"
        description={isManager ? "Review and search all leave applications." : "Track your leave applications."}
      />

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          aria-label="Search leave applications"
          placeholder={isManager ? "Search by employee, type, reason or date" : "Search by type, reason or date"}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className={`${inputClass} min-w-56 flex-1`}
        />
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "all" | LeaveStatus);
            setPage(1);
          }}
          className={`${inputClass} w-44`}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <ErrorText message={error ?? loadError?.message} />

      {isLoading ? (
        <Spinner />
      ) : !filtered.length ? (
        <EmptyState text={items?.length ? "No applications match your search." : "No leave applications yet."} />
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-background shadow-sm">
            {visible.map((item) => {
              const isOwn = item.employeeId === myId;
              const canReview = isManager && item.status === "pending";
              const canCancel =
                (isOwn && item.status === "pending") ||
                (isManager && (item.status === "pending" || item.status === "approved"));
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {item.leaveTypeName} · {item.days} {Number(item.days) === 1 ? "day" : "days"}
                      {isManager && ` · ${item.employeeName}`}
                      <StatusBadge status={item.status} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.startDate === item.endDate ? item.startDate : `${item.startDate} → ${item.endDate}`}
                      {item.isHalfDay && " (half day)"}
                      {item.reason && ` · ${item.reason}`}
                      {item.reviewedAt && ` · reviewed ${formatDateTime(item.reviewedAt)}`}
                    </p>
                  </div>
                  {canReview && (
                    <>
                      <Button size="sm" disabled={updateStatus.isPending} onClick={() => change(item.id, "approved")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => change(item.id, "rejected")}>
                        Reject
                      </Button>
                    </>
                  )}
                  {canCancel && (
                    <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => change(item.id, "cancelled")}>
                      Cancel
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                Prev
              </Button>
              <span>
                Page {current} of {pageCount}
              </span>
              <Button size="sm" variant="outline" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const Leave: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const isManager = canManagePeople(organizationId);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Leave"
        description={isManager ? "Apply for leave and manage leave types." : "Apply for leave and check your balances."}
      />

      <Balances organizationId={organizationId} />
      <RequestForm organizationId={organizationId} isManager={isManager} />
      {isManager && <LeaveTypes organizationId={organizationId} />}
    </div>
  );
};

export default Leave;

