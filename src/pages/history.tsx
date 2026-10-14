import React, { useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { EmptyState, ErrorText, PageHeader, Spinner } from "@/components/form-kit";
import { formatDateTime, inputClass } from "@/lib/form-utils";
import {
  allRepaymentsQuery,
  leaveRequestsQuery,
  recoverablesQuery,
  repaymentsQuery,
  type LeaveRequest,
  type Recoverable,
} from "@/hooks/use-payroll-api";
import { canManageEmployees, canManagePeople, getActiveOrganizationId } from "@/lib/session";

const badgeStyle: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  disbursed: "bg-blue-100 text-blue-800",
  active: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};

const Badge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badgeStyle[status] ?? "bg-muted"}`}>
    {status}
  </span>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg border bg-background p-2">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold">{value}</p>
  </div>
);

const formatDate = (value: string) => new Date(value).toLocaleDateString();
const money = (value: number) => value.toFixed(2);

const LEAVE_FILTERS = ["all", "approved", "rejected", "pending", "cancelled"] as const;
const LOAN_FILTERS = ["all", "approved", "disbursed", "active", "completed", "rejected", "pending", "cancelled"] as const;

const LeaveLog: React.FC<{ organizationId: string; isManager: boolean }> = ({
  organizationId,
  isManager,
}) => {
  const { data, isLoading, error } = useQuery(leaveRequestsQuery(organizationId));
  const [filter, setFilter] = useState<(typeof LEAVE_FILTERS)[number]>("all");
  const items: LeaveRequest[] = (data ?? []).filter(
    (item) => filter === "all" || item.status === filter,
  );
  const approvedDays = (data ?? [])
    .filter((item) => item.status === "approved")
    .reduce((sum, item) => sum + Number(item.days), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          aria-label="Filter by status"
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className={`${inputClass} max-w-48 capitalize`}
        >
          {LEAVE_FILTERS.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All statuses" : value}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">Approved days (all time): {approvedDays}</p>
      </div>
      <ErrorText message={error?.message} />
      {isLoading ? (
        <Spinner />
      ) : !items.length ? (
        <EmptyState text="No leave records." />
      ) : (
        <ul className="divide-y rounded-xl border">
          {items.map((item) => (
            <li key={item.id} className="space-y-1 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {item.leaveTypeName}
                  {isManager && ` · ${item.employeeName}`}
                </p>
                <Badge status={item.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(item.startDate)}
                {item.startDate !== item.endDate && ` – ${formatDate(item.endDate)}`} · {item.days}{" "}
                {Number(item.days) === 1 ? "day" : "days"}
                {item.isHalfDay && " (half day)"} · {item.isPaid ? "Paid" : "Unpaid"}
              </p>
              {item.reason && <p className="text-xs">Reason: {item.reason}</p>}
              <p className="text-xs text-muted-foreground">
                Applied {formatDateTime(item.createdAt)}
                {item.reviewedAt && ` · Reviewed ${formatDateTime(item.reviewedAt)}`}
                {item.reviewNote && ` · Note: ${item.reviewNote}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const addMonths = (value: string, months: number) => {
  const date = new Date(value);
  date.setMonth(date.getMonth() + months);
  return date;
};

const LoanDetails: React.FC<{ organizationId: string; item: Recoverable }> = ({
  organizationId,
  item,
}) => {
  const { data: repayments, isLoading } = useQuery(repaymentsQuery(organizationId, item.id));
  const repaid = Number(item.totalRepaid);
  const count = item.installmentCount ?? 0;
  const amount = Number(item.installmentAmount ?? 0);
  const schedule = Array.from({ length: count }, (_, index) => {
    const upTo = amount * (index + 1);
    const status = repaid >= upTo - 0.005 ? "paid" : repaid > amount * index ? "partial" : "upcoming";
    return {
      number: index + 1,
      status,
      due: item.firstRepaymentDate ? addMonths(item.firstRepaymentDate, index) : null,
    };
  });

  return (
    <div className="space-y-4 border-t bg-muted/30 p-3">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Repayment structure</h3>
        {count > 0 ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              {count} installments of {item.installmentAmount} {item.currencyCode}
              {Number(item.annualInterestRate) > 0 && ` · ${Number(item.annualInterestRate)}% yearly interest`}
            </p>
            <ul className="grid gap-1 text-xs sm:grid-cols-2">
              {schedule.map((row) => (
                <li key={row.number} className="flex items-center justify-between rounded border bg-background px-2 py-1">
                  <span>
                    #{row.number}
                    {row.due && ` · ${row.due.toLocaleDateString()}`}
                  </span>
                  <span
                    className={
                      row.status === "paid"
                        ? "text-green-700"
                        : row.status === "partial"
                          ? "text-amber-700"
                          : "text-muted-foreground"
                    }
                  >
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">No installment plan set (repay any amount).</p>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Repayment history</h3>
        {isLoading ? (
          <Spinner />
        ) : !repayments?.length ? (
          <p className="text-xs text-muted-foreground">No repayments recorded.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {repayments.map((repayment) => (
              <li key={repayment.id} className="flex justify-between gap-3">
                <span>
                  {formatDateTime(repayment.paidAt)} · {repayment.source}
                  {repayment.paymentMethod && ` · ${repayment.paymentMethod.replace("_", " ")}`}
                  {repayment.reference && ` · ${repayment.reference}`}{" "}
                  {repayment.status !== "confirmed" && <Badge status={repayment.status} />}
                </span>
                <span className="font-medium">
                  {repayment.amount} {repayment.currencyCode}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const LoanLog: React.FC<{ organizationId: string; isManager: boolean }> = ({
  organizationId,
  isManager,
}) => {
  const { data, isLoading, error } = useQuery(recoverablesQuery(organizationId));
  const [filter, setFilter] = useState<(typeof LOAN_FILTERS)[number]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const items = (data ?? []).filter((item) => filter === "all" || item.status === filter);

  return (
    <div className="space-y-4">
      <select
        aria-label="Filter by status"
        value={filter}
        onChange={(e) => setFilter(e.target.value as typeof filter)}
        className={`${inputClass} max-w-48 capitalize`}
      >
        {LOAN_FILTERS.map((value) => (
          <option key={value} value={value}>
            {value === "all" ? "All statuses" : value}
          </option>
        ))}
      </select>
      <ErrorText message={error?.message} />
      {isLoading ? (
        <Spinner />
      ) : !items.length ? (
        <EmptyState text="No loan records." />
      ) : (
        <ul className="divide-y rounded-xl border">
          {items.map((item) => {
            const open = expanded === item.id;
            const principal = Number(item.principalAmount);
            const repaid = Number(item.totalRepaid);
            const started = ["disbursed", "active", "completed"].includes(item.status);
            const totalDue = repaid + Number(item.outstanding);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-3 p-3 text-left"
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : item.id)}
                >
                  <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.type === "loan" ? "Loan" : "Salary advance"} · {item.principalAmount} {item.currencyCode}
                      {isManager && ` · ${item.employeeName}`}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Requested {formatDate(item.requestedAt)}
                      {item.approvedAt && ` · Approved ${formatDate(item.approvedAt)}`}
                      {item.disbursedAt && ` · Disbursed ${formatDate(item.disbursedAt)}`}
                    </span>
                  </span>
                  <Badge status={item.status} />
                </button>
                <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-4">
                  <Stat label="Principal" value={money(principal)} />
                  <Stat label="Interest rate" value={`${Number(item.annualInterestRate)}%`} />
                  <Stat label="Repaid" value={started ? money(repaid) : "—"} />
                  <Stat label="Remaining" value={started ? money(Number(item.outstanding)) : "—"} />
                  {started && totalDue > principal && (
                    <Stat label="Total payable" value={money(totalDue)} />
                  )}
                </div>
                {item.description && (
                  <p className="px-3 pb-3 text-xs text-muted-foreground">Reason: {item.description}</p>
                )}
                {open && <LoanDetails organizationId={organizationId} item={item} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const PAYMENT_FILTERS = ["all", "pending", "confirmed", "rejected"] as const;

const InstallmentLog: React.FC<{ organizationId: string; isManager: boolean }> = ({
  organizationId,
  isManager,
}) => {
  const { data, isLoading, error } = useQuery(allRepaymentsQuery(organizationId));
  const [filter, setFilter] = useState<(typeof PAYMENT_FILTERS)[number]>("all");
  const [employee, setEmployee] = useState("");
  const all = data ?? [];
  const employees = Array.from(
    new Map(all.map((item) => [item.employeeId, item.employeeName])),
  );
  const items = all.filter(
    (item) =>
      (filter === "all" || item.status === filter) &&
      (!employee || item.employeeId === employee),
  );
  const confirmedTotal = items
    .filter((item) => item.status === "confirmed")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Filter by status"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className={`${inputClass} w-40 capitalize`}
          >
            {PAYMENT_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All statuses" : value}
              </option>
            ))}
          </select>
          {isManager && (
            <select
              aria-label="Filter by employee"
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
          )}
        </div>
        <p className="text-sm text-muted-foreground">Confirmed total: {money(confirmedTotal)}</p>
      </div>
      <ErrorText message={error?.message} />
      {isLoading ? (
        <Spinner />
      ) : !items.length ? (
        <EmptyState text="No installment records." />
      ) : (
        <ul className="divide-y rounded-xl border">
          {items.map((item) => (
            <li key={item.id} className="space-y-1 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {isManager && `${item.employeeName} · `}
                  {item.amount} {item.currencyCode}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {item.type === "loan" ? "Loan" : "Salary advance"}
                  </span>
                </p>
                <Badge status={item.status === "confirmed" ? "approved" : item.status} />
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(item.paidAt)} · {item.source === "employee" ? "submitted by employee" : item.source}
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const History: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const isAdmin = canManageEmployees(organizationId);
  const isPeopleManager = canManagePeople(organizationId);
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: "leave" | "loans" | "installments" =
    requested === "loans" || requested === "installments" ? requested : "leave";
  const setTab = (value: typeof tab) => setParams({ tab: value }, { replace: true });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Leave & loan logs"
        description={
          isAdmin
            ? "Every leave request and loan with its decision and repayment status."
            : isPeopleManager
              ? "Every leave request, plus your own loan and repayment history."
              : "Your leave requests and loans, including approved and rejected ones."
        }
      />
      <div className="inline-flex rounded-lg border p-1">
        {(["leave", "loans", "installments"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {value === "leave" ? "Leave log" : value === "loans" ? "Loan log" : "Installment log"}
          </button>
        ))}
      </div>
      {tab === "leave" ? (
        <LeaveLog organizationId={organizationId} isManager={isPeopleManager} />
      ) : tab === "loans" ? (
        <LoanLog organizationId={organizationId} isManager={isAdmin} />
      ) : (
        <InstallmentLog organizationId={organizationId} isManager={isAdmin} />
      )}
    </div>
  );
};

export default History;
