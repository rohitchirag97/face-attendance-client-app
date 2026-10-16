import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { Calculator, CheckCircle2, Download, Loader2, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import {
  BONUS_STATUS,
  bonusRunQuery,
  bonusRunsQuery,
  downloadGratuityExcel,
  gratuityQuery,
  previousFinancialYear,
  useApproveBonus,
  useCalculateBonus,
  useDeleteBonusRun,
  useMarkBonusPaid,
  useUpdateBonusItem,
  type BonusCalculateInput,
  type BonusItem,
  type BonusRun,
} from "@/hooks/use-bonus";
import { inputClass } from "@/lib/form-utils";
import { formatMoney } from "@/lib/payroll-format";
import { getActiveOrganizationId } from "@/lib/session";

const CalculateForm: React.FC<{ organizationId: string; currentFinancialYear: string; existing?: BonusRun; onDone: (runId: string) => void }> = ({
  organizationId,
  currentFinancialYear,
  existing,
  onDone,
}) => {
  const calculate = useCalculateBonus(organizationId);
  const [input, setInput] = useState<BonusCalculateInput>({
    financialYear: existing?.financialYear ?? previousFinancialYear(currentFinancialYear),
    percentage: existing ? Number(existing.percentage) : 8.33,
    eligibilityCeiling: existing ? Number(existing.eligibilityCeiling) : 21000,
    calculationCeiling: existing ? Number(existing.calculationCeiling) : 7000,
    payout: existing?.payout ?? "payroll",
  });
  const set = <K extends keyof BonusCalculateInput>(field: K, value: BonusCalculateInput[K]) => setInput((current) => ({ ...current, [field]: value }));
  const years = [currentFinancialYear, previousFinancialYear(currentFinancialYear), previousFinancialYear(previousFinancialYear(currentFinancialYear))];
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <h3 className="font-semibold">{existing ? `Recalculate ${existing.financialYear}` : "Calculate a year's bonus"}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Financial year" hint={input.financialYear === currentFinancialYear ? "Still running: only the payroll finalized so far counts" : "April to March"}>
          {(id) => (
            <select id={id} value={input.financialYear} disabled={!!existing} onChange={(e) => set("financialYear", e.target.value)} className={inputClass}>
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          )}
        </Field>
        <Field label="Bonus %" hint="8.33% minimum, 20% maximum under the Act">
          {(id) => <input id={id} type="number" min={8.33} max={20} step="0.01" value={input.percentage} onChange={(e) => set("percentage", Number(e.target.value || 0))} className={inputClass} />}
        </Field>
        <Field label="Pay it" hint={input.payout === "payroll" ? "Added to the next payroll as a taxable earning" : "Paid outside payroll; you mark it paid"}>
          {(id) => (
            <select id={id} value={input.payout} onChange={(e) => set("payout", e.target.value as BonusCalculateInput["payout"])} className={inputClass}>
              <option value="payroll">With the next payroll</option>
              <option value="direct">Directly (bank transfer, cheque)</option>
            </select>
          )}
        </Field>
        <Field label="Covered up to (monthly basic + DA)" hint="Employees earning more are not covered">
          {(id) => <input id={id} type="number" min={1} step="1" value={input.eligibilityCeiling} onChange={(e) => set("eligibilityCeiling", Number(e.target.value || 0))} className={inputClass} />}
        </Field>
        <Field label="Monthly wage counted up to" hint="7,000, or your state's minimum wage if higher">
          {(id) => <input id={id} type="number" min={1} step="1" value={input.calculationCeiling} onChange={(e) => set("calculationCeiling", Number(e.target.value || 0))} className={inputClass} />}
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Worked out from finalized payroll: each month's basic pay plus any salary component named "DA" or "Dearness allowance". Employees need 30 days worked in the year; leavers are included.
        {existing ? " Recalculating resets any amounts you adjusted." : ""}
      </p>
      <ErrorText message={calculate.error?.message ?? null} />
      <Button disabled={calculate.isPending} onClick={() => calculate.mutate(input, { onSuccess: (detail) => onDone(detail.run.id) })}>
        {calculate.isPending ? <Loader2 className="animate-spin" /> : <Calculator />} {existing ? "Recalculate" : "Calculate"}
      </Button>
    </div>
  );
};

const AmountCell: React.FC<{ item: BonusItem; editable: boolean; onSave: (amount: number) => void }> = ({ item, editable, onSave }) => {
  const [value, setValue] = useState(item.finalAmount);
  if (!editable) return <>{Number(item.finalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</>;
  return (
    <input
      aria-label={`Bonus for ${item.employeeName}`}
      type="number"
      min={0}
      step="0.01"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => { if (Number(value) !== Number(item.finalAmount)) onSave(Number(value || 0)); }}
      className={`${inputClass} h-8 w-28 text-right`}
    />
  );
};

const RunView: React.FC<{ organizationId: string; runId: string; currentFinancialYear: string; onDeleted: () => void }> = ({
  organizationId,
  runId,
  currentFinancialYear,
  onDeleted,
}) => {
  const { data, isLoading, error } = useQuery(bonusRunQuery(organizationId, runId));
  const update = useUpdateBonusItem(organizationId, runId);
  const approve = useApproveBonus(organizationId, runId);
  const remove = useDeleteBonusRun(organizationId, runId);
  const pay = useMarkBonusPaid(organizationId, runId);
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [recalculating, setRecalculating] = useState(false);
  if (isLoading) return <Spinner />;
  if (!data) return <ErrorText message={error?.message ?? "Could not load the bonus run."} />;
  const { run, items, currencyCode, payrollMonths } = data;
  const m = (value: string | number) => formatMoney(value, currencyCode);
  const draft = run.status === "draft";
  const status = BONUS_STATUS[run.status];
  const included = items.filter((item) => item.included);
  const paidCount = included.filter((item) => item.paidAt).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Bonus {run.financialYear}</h2>
          <p className="text-sm text-muted-foreground">
            {Number(run.percentage)}% · {included.length} employee(s) · from {payrollMonths} month(s) of finalized payroll ·{" "}
            {run.payout === "payroll" ? "paid with the next payroll" : "paid directly"}
          </p>
          <p className="mt-1 text-xl font-bold">{m(run.totalAmount)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
      </div>

      {payrollMonths < 12 && draft && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Only {payrollMonths} of 12 months have finalized payroll. Months without payroll in Vetanly don't count; finalize them first or adjust amounts below.
        </p>
      )}
      {run.status === "approved" && run.payout === "payroll" && (
        <p className="rounded-lg bg-sky-50 px-4 py-2 text-sm text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
          {paidCount} of {included.length} paid. The rest are added to the next payroll you generate, as a "Bonus {run.financialYear}" earning (taxed that month, no PF, ESI or PT).
          A leaver's bonus is paid in their full & final settlement.
        </p>
      )}

      {draft && recalculating && (
        <CalculateForm organizationId={organizationId} currentFinancialYear={currentFinancialYear} existing={run} onDone={() => setRecalculating(false)} />
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              {draft && <th className="px-3 py-2">Pay</th>}
              <th className="px-3 py-2">Employee</th>
              <th className="px-3 py-2 text-right">Monthly wage</th>
              <th className="px-3 py-2 text-right">Days</th>
              <th className="px-3 py-2 text-right">Bonus wages</th>
              <th className="px-3 py-2 text-right">Calculated</th>
              <th className="px-3 py-2 text-right">Bonus</th>
              {!draft && <th className="px-3 py-2">Paid</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id} className={item.included ? "" : "text-muted-foreground"}>
                {draft && (
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={`Pay ${item.employeeName}`} className="accent-primary" checked={item.included}
                      onChange={(e) => update.mutate({ itemId: item.id, included: e.target.checked })} />
                  </td>
                )}
                <td className="px-3 py-2">
                  <span className="block font-medium">{item.employeeName}</span>
                  <span className="block text-xs text-muted-foreground">{item.reason}</span>
                </td>
                <td className="px-3 py-2 text-right">{m(item.monthlyWage)}</td>
                <td className="px-3 py-2 text-right">{Number(item.daysWorked)}</td>
                <td className="px-3 py-2 text-right">{m(item.bonusWages)}</td>
                <td className="px-3 py-2 text-right">{m(item.calculatedAmount)}</td>
                <td className="px-3 py-2 text-right">
                  {item.included ? (
                    <AmountCell key={item.finalAmount} item={item} editable={draft} onSave={(amount) => update.mutate({ itemId: item.id, finalAmount: amount })} />
                  ) : "—"}
                </td>
                {!draft && (
                  <td className="px-3 py-2 text-xs">
                    {!item.included ? "—" : item.paidAt ? (item.paidInPayrollRunId ? "In payroll" : `Paid ${item.paidAt.slice(0, 10)}`) : "Pending"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorText message={update.error?.message ?? null} />

      {draft && (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={approve.isPending || included.length === 0}
            onClick={() => {
              if (window.confirm(`Approve the ${run.financialYear} bonus of ${m(run.totalAmount)}? Amounts can no longer be changed and employees are notified.`)) approve.mutate(undefined);
            }}
          >
            {approve.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Approve bonus
          </Button>
          {!recalculating && <Button variant="outline" onClick={() => setRecalculating(true)}><Calculator /> Change % or recalculate</Button>}
          <Button variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate(undefined, { onSuccess: onDeleted })}><Trash2 /> Delete draft</Button>
        </div>
      )}

      {run.status === "approved" && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
          <p className="basis-full text-sm text-muted-foreground">
            {run.payout === "payroll" ? "Paying it outside payroll instead? Record the payment for everyone not paid yet:" : "Once transferred, record the payment:"}
          </p>
          <Field label="Reference">{(id) => <input id={id} value={reference} maxLength={120} placeholder="Batch / UTR no." onChange={(e) => setReference(e.target.value)} className={`${inputClass} w-44`} />}</Field>
          <Field label="Paid on">{(id) => <input id={id} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={`${inputClass} w-40`} />}</Field>
          <Button variant={run.payout === "payroll" ? "outline" : "default"} disabled={pay.isPending} onClick={() => pay.mutate({ paymentReference: reference || undefined, paidOn })}>
            {pay.isPending ? <Loader2 className="animate-spin" /> : <Wallet />} Mark paid
          </Button>
        </div>
      )}
      {run.status === "paid" && (
        <p className="text-sm text-muted-foreground">Paid {run.paidAt?.slice(0, 10)}{run.paymentReference ? `, ref ${run.paymentReference}` : ""}.</p>
      )}
      <ErrorText message={approve.error?.message ?? remove.error?.message ?? pay.error?.message ?? null} />
    </section>
  );
};

const BonusTab: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [params, setParams] = useSearchParams();
  const selected = params.get("run");
  const { data, isLoading, error } = useQuery(bonusRunsQuery(organizationId));
  if (isLoading) return <Spinner />;
  if (!data) return <ErrorText message={error?.message ?? "Could not load bonus runs."} />;
  const select = (runId: string | null) => setParams(runId ? { tab: "bonus", run: runId } : { tab: "bonus" });
  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="h-fit space-y-2">
        <Button variant={selected ? "outline" : "default"} className="w-full" onClick={() => select(null)}><Calculator /> New bonus run</Button>
        {data.runs.length > 0 && (
          <ul className="divide-y rounded-xl border bg-card">
            {data.runs.map((run) => (
              <li key={run.id}>
                <button type="button" onClick={() => select(run.id)} className={`w-full px-4 py-3 text-left hover:bg-muted/50 ${selected === run.id ? "bg-primary/5" : ""}`}>
                  <span className="block text-sm font-medium">FY {run.financialYear}</span>
                  <span className="mt-1 flex items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${BONUS_STATUS[run.status].className}`}>{BONUS_STATUS[run.status].label}</span>
                    <span className="text-muted-foreground">{formatMoney(run.totalAmount, data.currencyCode)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected ? (
        <RunView key={selected} organizationId={organizationId} runId={selected} currentFinancialYear={data.currentFinancialYear} onDeleted={() => select(null)} />
      ) : (
        <CalculateForm
          organizationId={organizationId}
          currentFinancialYear={data.currentFinancialYear}
          onDone={(runId) => select(runId)}
        />
      )}
    </div>
  );
};

const GratuityTab: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [exportError, setExportError] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery(gratuityQuery(organizationId, asOf));
  const m = (value: number) => formatMoney(value, data?.currencyCode ?? "INR");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="As of">{(id) => <input id={id} type="date" value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} className={`${inputClass} w-44`} />}</Field>
        {data && (
          <Button variant="outline" onClick={() => { setExportError(null); downloadGratuityExcel(data).catch((e: Error) => setExportError(e.message)); }}>
            <Download /> Excel
          </Button>
        )}
      </div>
      <ErrorText message={exportError} />
      {isLoading ? (
        <Spinner />
      ) : !data ? (
        <ErrorText message={error?.message ?? "Could not load the gratuity report."} />
      ) : data.employees.length === 0 ? (
        <EmptyState text="No active employees on payroll." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase text-muted-foreground">Total liability</p>
              <p className="text-xl font-bold">{m(data.totalLiability)}</p>
              <p className="text-xs text-muted-foreground">Gratuity earned so far by everyone, at today's basic</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase text-muted-foreground">Payable now</p>
              <p className="text-xl font-bold">{m(data.payableNow)}</p>
              <p className="text-xs text-muted-foreground">{data.eligibleCount} employee(s) with 5 years' service (4 years 240 days)</p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase text-muted-foreground">Becoming payable in 6 months</p>
              <p className="text-xl font-bold">{data.eligibleSoonCount}</p>
              <p className="text-xs text-muted-foreground">employee(s)</p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Hire date</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2 text-right">Monthly basic</th>
                  <th className="px-3 py-2 text-right">Gratuity</th>
                  <th className="px-3 py-2">Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.employees.map((row) => (
                  <tr key={row.employeeId}>
                    <td className="px-3 py-2">
                      <span className="block font-medium">{row.employeeName}</span>
                      <span className="block text-xs text-muted-foreground">{[row.employeeCode, row.departmentName].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="px-3 py-2">{row.hireDate ?? "—"}</td>
                    <td className="px-3 py-2">{row.hireDate && row.hireDate <= data.asOf ? `${row.serviceYears}y ${row.serviceMonths}m` : "—"}</td>
                    <td className="px-3 py-2 text-right">{row.monthlyBasic > 0 ? m(row.monthlyBasic) : "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{m(row.amount)}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.note ? (
                        <span className="text-amber-700 dark:text-amber-400">{row.note}</span>
                      ) : row.eligible ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">Yes</span>
                      ) : (
                        <span className={row.eligibleSoon ? "font-medium text-sky-700 dark:text-sky-400" : "text-muted-foreground"}>From {row.eligibleFrom}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            15 days' basic (monthly basic × 15 ÷ 26) per year of service; 6 months or more counts as a full year. Capped at ₹20 lakh. Paid when an employee leaves with 5 years' service, through their full & final settlement.
          </p>
        </>
      )}
    </div>
  );
};

/** Statutory bonus runs and the gratuity liability report. Owners and admins. */
const BonusPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "gratuity" ? "gratuity" : "bonus";
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Bonus & gratuity"
        description="The yearly statutory bonus (Payment of Bonus Act) and the gratuity your company owes its employees so far."
      />
      <div className="flex gap-1 border-b">
        {(["bonus", "gratuity"] as const).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setParams({ tab: name })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === name ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {name === "bonus" ? "Statutory bonus" : "Gratuity liability"}
          </button>
        ))}
      </div>
      {tab === "bonus" ? <BonusTab organizationId={organizationId} /> : <GratuityTab organizationId={organizationId} />}
    </div>
  );
};

export default BonusPage;
