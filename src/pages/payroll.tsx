import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams, useNavigate } from "react-router";
import { CheckCircle2, FileText, Loader2, Trash2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import { inputClass } from "@/lib/form-utils";
import { formatMoney, formatPeriod } from "@/lib/payroll-format";
import {
  payrollRunQuery,
  payrollRunsQuery,
  useDeletePayrollRun,
  useFinalizePayroll,
  useGeneratePayroll,
} from "@/hooks/use-payroll-api";
import { getActiveOrganizationId } from "@/lib/session";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const previousMonth = () => {
  const now = new Date();
  return {
    start: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    end: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
  };
};

const RunDetail: React.FC<{ organizationId: string; runId: string; skipped: string[] }> = ({
  organizationId,
  runId,
  skipped,
}) => {
  const { data, isLoading, error } = useQuery(payrollRunQuery(organizationId, runId));
  const finalize = useFinalizePayroll(organizationId);
  const remove = useDeletePayrollRun(organizationId);
  const [, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  // Payroll runs cover the whole organization; the view can be narrowed to one branch.
  const [branchName, setBranchName] = useState("");

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorText message={error?.message ?? "Payroll run not found"} />;

  const { run, items } = data;
  const isDraft = run.status === "draft";
  const incomplete = items.filter((i) => i.incompleteDays > 0);
  const offDayPending = items.filter((i) => Number(i.offDayPendingDays) > 0);
  const totals = items.reduce(
    (acc, i) => ({
      gross: acc.gross + Number(i.grossPay),
      deductions: acc.deductions + Number(i.totalDeductions),
      net: acc.net + Number(i.netPay),
    }),
    { gross: 0, deductions: 0, net: 0 },
  );
  const currency = items[0]?.currencyCode ?? "INR";

  const handleFinalize = () => {
    if (!window.confirm("Finalize this payroll? Loan installments will be recorded, expense claims in it will be marked paid, and the run can no longer be changed.")) return;
    setActionError(null);
    finalize.mutate(runId, { onError: (e) => setActionError(e.message) });
  };

  const branchNames = [...new Set(items.flatMap((i) => (i.branchName ? [i.branchName] : [])))].sort();
  const shown = branchName ? items.filter((i) => i.branchName === branchName) : items;
  const shownNet = shown.reduce((sum, i) => sum + Number(i.netPay), 0);

  const handleDelete = () => {
    if (!window.confirm("Delete this draft payroll?")) return;
    setActionError(null);
    remove.mutate(runId, {
      onSuccess: () => setParams({}),
      onError: (e) => setActionError(e.message),
    });
  };

  return (
    <section className="space-y-4 rounded-xl border bg-background p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{formatPeriod(run.periodStart, run.periodEnd)}</h2>
          <p className="text-sm text-muted-foreground">
            {isDraft ? "Draft – review before finalizing" : "Finalized"} · {items.length} employee
            {items.length === 1 ? "" : "s"}
          </p>
        </div>
        {isDraft && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDelete} disabled={remove.isPending}>
              <Trash2 /> Delete draft
            </Button>
            <Button onClick={handleFinalize} disabled={finalize.isPending || items.length === 0}>
              {finalize.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Finalize
            </Button>
          </div>
        )}
      </div>

      {skipped.length > 0 && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700">
          Skipped (no compensation set): {skipped.join(", ")}
        </p>
      )}
      {isDraft && incomplete.length > 0 && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700">
          Missing check-outs were counted as absent for: {incomplete.map((i) => i.employeeName).join(", ")}.
          Fix the attendance entries and regenerate if needed.
        </p>
      )}
      {isDraft && offDayPending.length > 0 && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700">
          Work on off days is waiting for a decision, so it is not paid in this run:{" "}
          {offDayPending.map((i) => `${i.employeeName} (${Number(i.offDayPendingDays)} day${Number(i.offDayPendingDays) === 1 ? "" : "s"})`).join(", ")}.{" "}
          <Link to="/leave" className="font-medium underline">Decide on the Leave page</Link>, then regenerate.
        </p>
      )}
      <ErrorText message={actionError} />

      {branchNames.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select aria-label="Branch" value={branchName} onChange={(e) => setBranchName(e.target.value)} className="h-9 rounded-md border bg-background px-2">
            <option value="">All branches</option>
            {branchNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          {branchName && shown[0] && (
            <span className="text-muted-foreground">{shown.length} employee(s) · net {formatMoney(shownNet, shown[0].currencyCode)}</span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Employee</th>
              <th className="px-3 font-medium">Days (P / H / L / A)</th>
              <th className="px-3 text-right font-medium">Gross</th>
              <th className="px-3 text-right font-medium">Fine</th>
              <th className="px-3 text-right font-medium">Loan</th>
              <th className="px-3 text-right font-medium">Reimbursed</th>
              <th className="px-3 text-right font-medium">Net pay</th>
              <th className="pl-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.id} className="border-b last:border-0">
                <td className="py-2 pr-3">
                  <div className="font-medium">{i.employeeName}</div>
                  <div className="text-xs text-muted-foreground">{[i.employeeCode ?? i.jobTitle, i.branchName].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="px-3 text-muted-foreground">
                  {i.presentDays} / {i.halfDays} / {Number(i.paidLeaveDays) + Number(i.unpaidLeaveDays)} / {i.absentDays}
                  <span className="text-xs"> of {i.workingDays}</span>
                </td>
                <td className="px-3 text-right">{formatMoney(i.grossPay, i.currencyCode)}</td>
                <td className="px-3 text-right">{formatMoney(i.lateFine, i.currencyCode)}</td>
                <td className="px-3 text-right">{formatMoney(i.loanDeduction, i.currencyCode)}</td>
                <td className="px-3 text-right">{Number(i.reimbursements) > 0 ? formatMoney(i.reimbursements, i.currencyCode) : "—"}</td>
                <td className="px-3 text-right font-semibold">{formatMoney(i.netPay, i.currencyCode)}</td>
                <td className="pl-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/salary-slip/${i.id}`)}>
                    <FileText /> Slip
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="py-2 pr-3">Total</td>
                <td />
                <td className="px-3 text-right">{formatMoney(totals.gross, currency)}</td>
                <td colSpan={2} className="px-3 text-right">{formatMoney(totals.deductions, currency)}</td>
                <td className="px-3 text-right">{formatMoney(totals.net, currency)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No employees with compensation details were found.</p>
      )}
    </section>
  );
};

const PayrollPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const [params, setParams] = useSearchParams();
  const runId = params.get("run") ?? "";
  const defaults = previousMonth();
  const [start, setStart] = useState(defaults.start);
  const [end, setEnd] = useState(defaults.end);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const runs = useQuery(payrollRunsQuery(organizationId));
  const generate = useGeneratePayroll(organizationId);

  const handleGenerate = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!start || !end || start > end) return setError("Choose a valid pay period.");
    generate.mutate(
      { periodStart: start, periodEnd: end, utcOffsetMinutes: -new Date().getTimezoneOffset() },
      {
        onSuccess: (detail) => {
          setSkipped(detail.skipped ?? []);
          setParams({ run: detail.run.id });
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Payroll"
        description="Calculate salaries from attendance, leave, overtime, fines and loan installments, then issue salary slips."
      />

      <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-4 rounded-xl border bg-background p-4 shadow-sm" noValidate>
        <Field label="Period start">
          {(id) => <input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Period end">
          {(id) => <input id={id} type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />}
        </Field>
        <Button type="submit" className="h-10" disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className="animate-spin" /> : <Calculator />}
          Calculate payroll
        </Button>
        <p className="w-full text-xs text-muted-foreground">
          Recalculating a period that is still a draft replaces its figures. Finalized periods are locked.
        </p>
      </form>
      <ErrorText message={error} />

      {runs.data && runs.data.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {runs.data.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setSkipped([]);
                setParams({ run: r.id });
              }}
              className={`rounded-md border px-3 py-1.5 text-sm ${r.id === runId ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >
              {formatPeriod(r.periodStart, r.periodEnd)}
              <span className="ml-2 text-xs opacity-80">{r.status}</span>
            </button>
          ))}
        </div>
      )}

      {runId && <RunDetail key={runId} organizationId={organizationId} runId={runId} skipped={skipped} />}
    </div>
  );
};

export default PayrollPage;
