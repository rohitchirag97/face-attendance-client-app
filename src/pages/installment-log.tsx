import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, PageHeader, Spinner } from "@/components/form-kit";
import { formatDateTime, inputClass } from "@/lib/form-utils";
import { allRepaymentsQuery, useReviewAnyRepayment } from "@/hooks/use-payroll-api";
import { getActiveOrganizationId } from "@/lib/session";

const STATUSES = ["all", "pending", "confirmed", "rejected"] as const;

const badgeStyle: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const InstallmentLog: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const { data, isLoading, error } = useQuery(allRepaymentsQuery(organizationId));
  const review = useReviewAnyRepayment(organizationId);
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("pending");
  const [employee, setEmployee] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const all = data ?? [];
  const employees = Array.from(new Map(all.map((item) => [item.employeeId, item.employeeName])));
  const term = search.trim().toLowerCase();
  const items = all.filter((item) => {
    const paid = item.paidAt.slice(0, 10);
    return (
      (status === "all" || item.status === status) &&
      (!employee || item.employeeId === employee) &&
      (!from || paid >= from) &&
      (!to || paid <= to) &&
      (!term ||
        item.employeeName.toLowerCase().includes(term) ||
        (item.reference ?? "").toLowerCase().includes(term))
    );
  });
  const pendingCount = all.filter((item) => item.status === "pending").length;
  const confirmedTotal = items
    .filter((item) => item.status === "confirmed")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const decide = (recoverableId: string, id: string, next: "confirmed" | "rejected") => {
    setActionError(null);
    review.mutate({ recoverableId, id, status: next }, { onError: (e) => setActionError(e.message) });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Installment log"
        description={`${pendingCount} payment${pendingCount === 1 ? "" : "s"} awaiting confirmation.`}
      />
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className={`${inputClass} w-40 capitalize`}
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All statuses" : value}
            </option>
          ))}
        </select>
        <select
          aria-label="Employee"
          value={employee}
          onChange={(e) => setEmployee(e.target.value)}
          className={`${inputClass} w-48`}
        >
          <option value="">All employees</option>
          {employees.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <input
          aria-label="From date"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={`${inputClass} w-40`}
        />
        <input
          aria-label="To date"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={`${inputClass} w-40`}
        />
        <input
          aria-label="Search"
          placeholder="Search name or reference"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} w-56`}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {items.length} shown · Confirmed total: {confirmedTotal.toFixed(2)}
      </p>
      <ErrorText message={error?.message ?? actionError} />
      {isLoading ? (
        <Spinner />
      ) : !items.length ? (
        <EmptyState text="No installment records match these filters." />
      ) : (
        <ul className="divide-y rounded-xl border">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {item.employeeName} · {item.amount} {item.currencyCode}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {item.type === "loan" ? "Loan" : "Salary advance"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(item.paidAt)} ·{" "}
                  {item.source === "employee" ? "submitted by employee" : item.source}
                  {item.paymentMethod && ` · ${item.paymentMethod.replace("_", " ")}`}
                  {item.reference && ` · ${item.reference}`}
                </p>
                {(item.reviewedAt || item.reviewNote || item.notes) && (
                  <p className="text-xs text-muted-foreground">
                    {item.reviewedAt && `Reviewed ${formatDateTime(item.reviewedAt)}`}
                    {item.reviewNote && ` · Note: ${item.reviewNote}`}
                    {item.notes && ` · ${item.notes}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badgeStyle[item.status] ?? "bg-muted"}`}
                >
                  {item.status}
                </span>
                {item.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      disabled={review.isPending}
                      onClick={() => decide(item.recoverableId, item.id, "confirmed")}
                    >
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={review.isPending}
                      onClick={() => decide(item.recoverableId, item.id, "rejected")}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InstallmentLog;
