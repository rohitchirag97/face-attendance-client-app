import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  ErrorText,
  Field,
  PageHeader,
  Spinner,
} from "@/components/form-kit";
import {
  formatDateTime,
  inputClass,
  toNumberOrNull,
  toTextOrNull,
} from "@/lib/form-utils";
import { employeesQuery } from "@/hooks/use-api";
import LoanNoc from "@/components/loan-noc";
import {
  recoverablesQuery,
  repaymentsQuery,
  useCreateRecoverable,
  useCreateRepayment,
  useUpdateRecoverableStatus,
  useReviewRepayment,
  type PaymentMethod,
  type Recoverable,
} from "@/hooks/use-payroll-api";
import { canManageEmployees, getActiveOrganizationId } from "@/lib/session";

const typeLabel = { loan: "Loan", salary_advance: "Salary advance" } as const;
const PAGE_SIZE = 10;
const statusLabel = (status: string) =>
  status === "completed" ? "Closed (fully paid)" : status.charAt(0).toUpperCase() + status.slice(1);

const RequestForm: React.FC<{ organizationId: string; isManager: boolean }> = ({
  organizationId,
  isManager,
}) => {
  const { data: employees = [] } = useQuery({
    ...employeesQuery(organizationId),
    enabled: isManager,
  });
  const create = useCreateRecoverable(organizationId);
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<"loan" | "salary_advance">("salary_advance");
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState("");
  const [installment, setInstallment] = useState("");
  const [interest, setInterest] = useState("0");
  const [years, setYears] = useState("");

  const autoFill = (next: { amount?: string; interest?: string; years?: string }) => {
    const principal = toNumberOrNull(next.amount ?? amount);
    const rate = toNumberOrNull(next.interest ?? interest) ?? 0;
    const periodYears = toNumberOrNull(next.years ?? years);
    if (!principal || principal <= 0 || !periodYears || periodYears <= 0 || rate < 0) return;
    const months = Math.max(1, Math.round(periodYears * 12));
    const monthlyRate = rate / 100 / 12;
    const payment =
      monthlyRate === 0
        ? principal / months
        : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
    setCount(String(months));
    setInstallment(payment.toFixed(2));
  };
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const principal = toNumberOrNull(amount);
    const installments = toNumberOrNull(count);
    const installmentAmount = toNumberOrNull(installment);
    if (!principal || principal <= 0) return setError("Enter a valid amount.");
    if ((installments === null) !== (installmentAmount === null)) {
      return setError("Provide both the number of installments and the installment amount, or neither.");
    }
    const rate = isManager ? toNumberOrNull(interest) : 0;
    if (rate === null || rate < 0 || rate > 100) {
      return setError("Enter an interest rate between 0 and 100 (use 0 for no interest).");
    }
    create.mutate(
      {
        employeeId: isManager && employeeId ? employeeId : undefined,
        type,
        principalAmount: principal,
        annualInterestRate: rate ?? undefined,
        installmentCount: installments ?? undefined,
        installmentAmount: installmentAmount ?? undefined,
        description: toTextOrNull(description) ?? undefined,
      },
      {
        onSuccess: () => {
          setAmount("");
          setCount("");
          setInstallment("");
          setInterest("0");
          setYears("");
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" noValidate>
      {isManager && (
        <div className="sm:col-span-2">
          <Field label="Employee" hint="Leave empty to create it for yourself.">
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
      <Field label="Type">
        {(id) => (
          <select id={id} value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputClass}>
            <option value="salary_advance">Salary advance</option>
            <option value="loan">Loan</option>
          </select>
        )}
      </Field>
      <Field label="Amount">
        {(id) => <input id={id} type="number" min="0" step="0.01" value={amount} onChange={(e) => { setAmount(e.target.value); autoFill({ amount: e.target.value }); }} className={inputClass} />}
      </Field>
      <Field label="Repayment period in years (optional)" hint="Fills installments and amount (monthly).">
        {(id) => <input id={id} type="number" min="0" step="0.1" value={years} onChange={(e) => { setYears(e.target.value); autoFill({ years: e.target.value }); }} className={inputClass} />}
      </Field>
      <Field label="Installments (optional)">
        {(id) => <input id={id} type="number" min="1" step="1" value={count} onChange={(e) => setCount(e.target.value)} className={inputClass} />}
      </Field>
      <Field label="Installment amount (optional)">
        {(id) => <input id={id} type="number" min="0" step="0.01" value={installment} onChange={(e) => setInstallment(e.target.value)} className={inputClass} />}
      </Field>
      {isManager && (
        <Field label="Interest rate % per year" hint="Leave at 0 for no interest.">
          {(id) => <input id={id} type="number" required min="0" max="100" step="0.01" value={interest} onChange={(e) => { setInterest(e.target.value); autoFill({ interest: e.target.value }); }} className={inputClass} />}
        </Field>
      )}
      <div className="sm:col-span-2">
        <Field label="Reason (optional)">
          {(id) => <input id={id} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} className={inputClass} />}
        </Field>
      </div>
      <div className="space-y-2 sm:col-span-2 sm:text-right">
        <ErrorText message={error} />
        <Button type="submit" className="h-10" disabled={create.isPending}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {isManager ? "Create" : "Request"}
        </Button>
      </div>
    </form>
  );
};

const Repayments: React.FC<{ organizationId: string; item: Recoverable; isManager: boolean }> = ({
  organizationId,
  item,
  isManager,
}) => {
  const { data: repayments, isLoading } = useQuery(repaymentsQuery(organizationId, item.id));
  const add = useCreateRepayment(organizationId, item.id);
  const review = useReviewRepayment(organizationId, item.id);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<string | null>(null);
  const canRepay = item.status === "disbursed" || item.status === "active";

  const handleReview = (id: string, status: "confirmed" | "rejected") => {
    setError(null);
    review.mutate({ id, status }, { onError: (e) => setError(e.message) });
  };

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const value = toNumberOrNull(amount);
    if (!value || value <= 0) return setError("Enter a valid amount.");
    add.mutate(
      { amount: value, paymentMethod: method, reference: toTextOrNull(reference) ?? undefined },
      {
        onSuccess: () => {
          setAmount("");
          setReference("");
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <div className="space-y-3 border-t bg-muted/30 p-3">
      {isLoading ? (
        <Spinner />
      ) : !repayments?.length ? (
        <p className="text-sm text-muted-foreground">No repayments recorded.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {repayments.map((repayment) => (
            <li key={repayment.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {formatDateTime(repayment.paidAt)}
                {repayment.paymentMethod && ` · ${repayment.paymentMethod.replace("_", " ")}`}
                {repayment.reference && ` · ${repayment.reference}`}
                {repayment.status !== "confirmed" && (
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs capitalize ${repayment.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                    {repayment.status === "pending" ? "pending" : "rejected"}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-medium">
                  {repayment.amount} {repayment.currencyCode}
                </span>
                {isManager && repayment.status === "pending" && (
                  <>
                    <Button size="sm" disabled={review.isPending} onClick={() => handleReview(repayment.id, "confirmed")}>
                      Confirm
                    </Button>
                    <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => handleReview(repayment.id, "rejected")}>
                      Reject
                    </Button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canRepay && (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2" noValidate>
          <Field label={isManager ? "Repayment amount" : "Amount paid"}>
            {(id) => <input id={id} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Payment method">
            {(id) => (
              <select id={id} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={inputClass}>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            )}
          </Field>
          <Field label={isManager ? "Reference (optional)" : "Transaction ID / receipt no. (optional)"}>
            {(id) => <input id={id} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} className={inputClass} />}
          </Field>
          <Button type="submit" className="h-10" disabled={add.isPending}>
            {add.isPending && <Loader2 className="animate-spin" />}
            {isManager ? "Record repayment" : "Submit payment"}
          </Button>
        </form>
      )}
      {canRepay && !isManager && (
        <p className="text-xs text-muted-foreground">
          Your payment stays pending until an admin approves it, and only then counts toward the balance.
        </p>
      )}
      <ErrorText message={error} />
    </div>
  );
};

const LoanList: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const isManager = canManageEmployees(organizationId);
  const { data: items, isLoading, error: loadError } = useQuery(recoverablesQuery(organizationId));
  const updateStatus = useUpdateRecoverableStatus(organizationId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  const changeStatus = (
    id: string,
    status: "approved" | "rejected" | "cancelled" | "disbursed",
    annualInterestRate?: number,
  ) => {
    setError(null);
    updateStatus.mutate({ id, status, annualInterestRate }, { onError: (e) => setError(e.message) });
  };

  const approve = (id: string, currentRate: string) => {
    const raw = rates[id];
    const rate = raw === undefined || raw === "" ? Number(currentRate) : Number(raw);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      setError("Interest rate must be between 0 and 100");
      return;
    }
    changeStatus(id, "approved", rate);
  };

  const myId = (JSON.parse(localStorage.getItem("user") ?? "{}") as { id?: string }).id;

  const query = search.trim().toLowerCase();
  const filtered = (items ?? []).filter((item) => {
    if (statusFilter === "active" && item.status !== "disbursed" && item.status !== "active") return false;
    if (statusFilter === "closed" && item.status !== "rejected" && item.status !== "cancelled") return false;
    if (["pending", "approved", "completed"].includes(statusFilter) && item.status !== statusFilter) return false;
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (!query) return true;
    return `${item.employeeName} ${item.description ?? ""} ${item.principalAmount}`
      .toLowerCase()
      .includes(query);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const resetPage = () => setPage(1);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="All loans & advances"
        description={
          isManager
            ? "Search, filter and review every loan and advance. Record disbursements and repayments."
            : "Track your loans and advances and submit repayments."
        }
      />

      <ErrorText message={error ?? loadError?.message} />

      {isLoading ? (
        <Spinner />
      ) : !items?.length ? (
        <EmptyState text="No loans or advances yet." />
      ) : (
        <>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-md border bg-background px-3 focus-within:ring-2 focus-within:ring-ring/30">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              aria-label="Search loans"
              placeholder={isManager ? "Search by employee, note or amount" : "Search by note or amount"}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetPage();
              }}
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              resetPage();
            }}
            className={`${inputClass} sm:w-44`}
          >
            <option value="all">All statuses</option>
            <option value="active">Active (disbursed)</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="completed">Closed (fully paid)</option>
            <option value="closed">Rejected / cancelled</option>
          </select>
          <select
            aria-label="Filter by type"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              resetPage();
            }}
            className={`${inputClass} sm:w-40`}
          >
            <option value="all">All types</option>
            <option value="loan">Loans</option>
            <option value="salary_advance">Salary advances</option>
          </select>
        </div>
        {!filtered.length ? (
          <EmptyState text="No loans match your search or filters." />
        ) : (
        <div className="overflow-hidden rounded-xl border">
        <ul className="divide-y">
          {visible.map((item) => {
            const open = expanded === item.id;
            const canCancelOwn = !isManager && item.status === "pending" && item.employeeId === myId;
            return (
              <li key={item.id}>
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : item.id)}
                  >
                    <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {typeLabel[item.type]} · {item.principalAmount} {item.currencyCode}
                        {Number(item.annualInterestRate) > 0 && ` @ ${Number(item.annualInterestRate)}%`}
                        {isManager && ` · ${item.employeeName}`}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {statusLabel(item.status)} · repaid {item.totalRepaid} · outstanding {item.outstanding} ·{" "}
                        {formatDateTime(item.requestedAt)}
                      </span>
                    </span>
                  </button>
                  {isManager && item.status === "pending" && (
                    <>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        Interest %
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          className="h-8 w-20 rounded-md border bg-background px-2 text-sm text-foreground"
                          value={rates[item.id] ?? String(Number(item.annualInterestRate))}
                          onChange={(e) => setRates((r) => ({ ...r, [item.id]: e.target.value }))}
                        />
                      </label>
                      <Button size="sm" disabled={updateStatus.isPending} onClick={() => approve(item.id, item.annualInterestRate)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => changeStatus(item.id, "rejected")}>
                        Reject
                      </Button>
                    </>
                  )}
                  {isManager && item.status === "approved" && (
                    <Button size="sm" disabled={updateStatus.isPending} onClick={() => changeStatus(item.id, "disbursed")}>
                      Mark disbursed
                    </Button>
                  )}
                  {(canCancelOwn || (isManager && (item.status === "pending" || item.status === "approved"))) && (
                    <Button size="sm" variant="outline" disabled={updateStatus.isPending} onClick={() => changeStatus(item.id, "cancelled")}>
                      Cancel
                    </Button>
                  )}
                </div>
                {open && <Repayments organizationId={organizationId} item={item} isManager={isManager} />}
                {open && item.status === "completed" && (
                  <LoanNoc organizationId={organizationId} recoverableId={item.id} />
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {pageStart + 1}–{pageStart + visible.length} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              <ChevronLeft /> Prev
            </Button>
            <span className="text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
              Next <ChevronRight />
            </Button>
          </div>
        </div>
        </div>
        )}
        </>
      )}
    </div>
  );
};

export const LoanListPage = LoanList;

const Loans: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const isManager = canManageEmployees(organizationId);
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader
        title="Loans & advances"
        description={
          isManager
            ? "Create a loan or salary advance for an employee. Review them in All loans."
            : "Request a loan or salary advance. Track it in All loans."
        }
      />
      <RequestForm organizationId={organizationId} isManager={isManager} />
    </div>
  );
};

export default Loans;
