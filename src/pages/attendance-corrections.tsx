import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import { inputClass } from "@/lib/form-utils";
import {
  regularizationsQuery,
  useCreateRegularization,
  useUpdateRegularizationStatus,
  type RegularizationStatus,
} from "@/hooks/use-regularization";
import { canManagePeople, getActiveOrganizationId } from "@/lib/session";

const statusStyle: Record<RegularizationStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};

const todayLocal = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const clock = (value: string | null) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

const RequestForm: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [params] = useSearchParams();
  const create = useCreateRegularization(organizationId);
  const [date, setDate] = useState(params.get("date") ?? "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!date) return setError("Choose the date to correct.");
    if (!checkIn && !checkOut) return setError("Enter the check-in time, the check-out time, or both.");
    if (checkIn && checkOut && checkOut <= checkIn) return setError("Check-out must be after check-in.");
    if (reason.trim().length < 3) return setError("Please give a reason.");
    create.mutate(
      { date, checkIn: checkIn || undefined, checkOut: checkOut || undefined, reason: reason.trim() },
      {
        onSuccess: () => {
          setDate("");
          setCheckIn("");
          setCheckOut("");
          setReason("");
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border bg-background p-4 shadow-sm sm:grid-cols-3" noValidate>
      <div className="sm:col-span-3">
        <h2 className="text-sm font-semibold">Request a correction</h2>
        <p className="text-xs text-muted-foreground">
          Missed or wrong punch? Enter the times that should have been recorded. Only the last 31 days can be corrected.
        </p>
      </div>
      <Field label="Date">
        {(id) => <input id={id} type="date" max={todayLocal()} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />}
      </Field>
      <Field label="Check-in time">
        {(id) => <input id={id} type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={inputClass} />}
      </Field>
      <Field label="Check-out time">
        {(id) => <input id={id} type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputClass} />}
      </Field>
      <div className="sm:col-span-3">
        <Field label="Reason">
          {(id) => (
            <input
              id={id}
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Forgot to punch out, kiosk was offline"
              className={inputClass}
            />
          )}
        </Field>
      </div>
      <div className="sm:col-span-3 space-y-2">
        <ErrorText message={error} />
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </form>
  );
};

const PAGE_SIZE = 10;

const AttendanceCorrections: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const isManager = canManagePeople(organizationId);
  const { data: items, isLoading, error: loadError } = useQuery(regularizationsQuery(organizationId));
  const update = useUpdateRegularizationStatus(organizationId);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | RegularizationStatus>("all");
  const [page, setPage] = useState(1);
  const myId = (JSON.parse(localStorage.getItem("user") ?? "{}") as { id?: string }).id;

  const change = (id: string, next: "approved" | "rejected" | "cancelled") => {
    setError(null);
    update.mutate({ id, status: next }, { onError: (e) => setError(e.message) });
  };

  const filtered = (items ?? []).filter((item) => status === "all" || item.status === status);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Attendance corrections"
        description={
          isManager
            ? "Approve or reject missed and wrong punch corrections, or request your own."
            : "Ask for a missed or wrong punch to be corrected."
        }
      />

      <RequestForm organizationId={organizationId} />

      <div className="flex justify-end">
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "all" | RegularizationStatus);
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
        <EmptyState text="No correction requests yet." />
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-background shadow-sm">
            {visible.map((item) => {
              const isOwn = item.employeeId === myId;
              const pending = item.status === "pending";
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {item.date}
                      {isManager && ` · ${item.employeeName}`}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusStyle[item.status]}`}>
                        {item.status}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      In {clock(item.requestedCheckIn)} · Out {clock(item.requestedCheckOut)} · {item.reason}
                      {item.reviewNote && ` · Note: ${item.reviewNote}`}
                    </p>
                  </div>
                  {isManager && pending && (
                    <>
                      <Button size="sm" disabled={update.isPending} onClick={() => change(item.id, "approved")}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => change(item.id, "rejected")}>
                        Reject
                      </Button>
                    </>
                  )}
                  {isOwn && pending && (
                    <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => change(item.id, "cancelled")}>
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

export default AttendanceCorrections;
