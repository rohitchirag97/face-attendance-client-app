import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import { inputClass } from "@/lib/form-utils";
import { overtimeQuery, useReviewOvertime, type OvertimeRow, type OvertimeStatus } from "@/hooks/use-overtime";
import { getActiveOrganizationId } from "@/lib/session";

const statusStyle: Record<OvertimeStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  auto: "bg-muted text-muted-foreground",
};

const hm = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
const iso = (d: Date) => d.toLocaleDateString("en-CA");

const Row: React.FC<{
  row: OvertimeRow;
  required: boolean;
  busy: boolean;
  onReview: (status: "approved" | "rejected", minutes?: number) => void;
}> = ({ row, required, busy, onReview }) => {
  const [minutes, setMinutes] = useState(String(row.approvedMinutes || row.overtimeMinutes));
  return (
    <tr className="border-t">
      <td className="px-3 py-2 font-medium">{row.employeeName}</td>
      <td className="px-3 py-2">{row.date}</td>
      <td className="px-3 py-2">{hm(row.workedMinutes)} of {hm(row.expectedMinutes)}</td>
      <td className="px-3 py-2">{hm(row.overtimeMinutes)}</td>
      <td className="px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusStyle[row.status]}`}>
          {row.status === "auto" ? "Auto-approved" : row.status}
        </span>
        {row.status === "approved" && row.approvedMinutes !== row.overtimeMinutes && (
          <span className="ml-2 text-xs text-muted-foreground">{hm(row.approvedMinutes)} paid</span>
        )}
      </td>
      <td className="px-3 py-2">
        {required && (
          <div className="flex items-center justify-end gap-2">
            <input
              type="number"
              min={1}
              max={row.overtimeMinutes}
              aria-label={`Minutes to approve for ${row.employeeName} on ${row.date}`}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className={`${inputClass} h-8 w-20`}
            />
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onReview("approved", Math.min(Math.max(Number(minutes) || row.overtimeMinutes, 1), row.overtimeMinutes))}
            >
              <Check /> Approve
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onReview("rejected")}>
              <X /> Reject
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
};

const OvertimePage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const now = new Date();
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [filter, setFilter] = useState<"" | OvertimeStatus>("");
  const [error, setError] = useState<string | null>(null);
  const valid = from <= to && (Date.parse(to) - Date.parse(from)) / 86_400_000 <= 92;
  const list = useQuery({ ...overtimeQuery(organizationId, from, to), enabled: valid });
  const review = useReviewOvertime(organizationId);

  const required = list.data?.approvalRequired ?? false;
  const items = (list.data?.items ?? []).filter((row) => !filter || row.status === filter);
  const pending = (list.data?.items ?? []).filter((row) => row.status === "pending");

  const send = (entries: Parameters<typeof review.mutate>[0]) => {
    setError(null);
    review.mutate(entries, { onError: (e) => setError(e.message) });
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Overtime"
        description={
          required
            ? "Overtime is paid only after you approve it. Days left pending are not paid in payroll."
            : "Overtime approval is off, so all overtime is paid automatically. Turn it on in Payroll settings."
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="From">
          {(id) => <input id={id} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputClass} />}
        </Field>
        <Field label="To">
          {(id) => <input id={id} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Status">
          {(id) => (
            <select id={id} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className={inputClass}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          )}
        </Field>
      </div>
      {!valid && <p className="text-sm text-destructive">Choose a range of at most 93 days.</p>}
      <ErrorText message={error ?? list.error?.message} />
      {required && pending.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-amber-50 p-3 text-sm">
          <span>{pending.length} day{pending.length === 1 ? "" : "s"} waiting for approval.</span>
          <Button
            size="sm"
            disabled={review.isPending}
            onClick={() =>
              send(pending.map((row) => ({ employeeId: row.employeeId, date: row.date, status: "approved" as const })))
            }
          >
            Approve all pending
          </Button>
        </div>
      )}
      {list.isLoading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState text="No overtime days match this range." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Worked</th>
                <th className="px-3 py-2">Overtime</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <Row
                  key={`${row.employeeId}-${row.date}-${row.approvedMinutes}-${row.status}`}
                  row={row}
                  required={required}
                  busy={review.isPending}
                  onReview={(status, minutes) =>
                    send([{ employeeId: row.employeeId, date: row.date, status, approvedMinutes: minutes }])
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OvertimePage;
