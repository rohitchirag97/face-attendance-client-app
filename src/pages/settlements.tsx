import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { Calculator, CheckCircle2, Download, Loader2, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import {
  isDeduction,
  SETTLEMENT_STATUS,
  settlementQuery,
  settlementsQuery,
  statementPath,
  useDiscardSettlement,
  useFinalizeSettlement,
  useMarkSettlementPaid,
  useSaveSettlementDraft,
  type SettlementInputs,
  type SettlementLine,
  type SettlementView,
} from "@/hooks/use-settlements";
import { apiDownload } from "@/lib/api";
import { inputClass } from "@/lib/form-utils";
import { formatMoney } from "@/lib/payroll-format";
import { getActiveOrganizationId } from "@/lib/session";

const LinesTable: React.FC<{ lines: SettlementLine[]; currency: string; totals: { totalEarnings: string; totalDeductions: string; netPayable: string } }> = ({
  lines,
  currency,
  totals,
}) => {
  const m = (value: string | number) => formatMoney(value, currency);
  const net = Number(totals.netPayable);
  const section = (title: string, rows: SettlementLine[], total: string) => (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">None</p> : rows.map((line, index) => (
        <div key={index} className="flex justify-between gap-4 py-1 text-sm"><span>{line.label}</span><span className="shrink-0">{m(line.amount)}</span></div>
      ))}
      <div className="mt-1 flex justify-between border-t pt-1 text-sm font-semibold"><span>Total</span><span>{m(total)}</span></div>
    </div>
  );
  return (
    <div className="space-y-4">
      {section("Earnings", lines.filter((line) => !isDeduction(line.kind)), totals.totalEarnings)}
      {section("Deductions and recoveries", lines.filter((line) => isDeduction(line.kind)), totals.totalDeductions)}
      <div className={`flex justify-between rounded-lg px-4 py-3 text-base font-bold ${net >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
        <span>{net >= 0 ? "Net payable to employee" : "Employee owes the company"}</span>
        <span>{m(Math.abs(net))}</span>
      </div>
    </div>
  );
};

const InputsForm: React.FC<{ view: SettlementView; employeeId: string; organizationId: string; initial: SettlementInputs }> = ({
  view,
  employeeId,
  organizationId,
  initial,
}) => {
  const save = useSaveSettlementDraft(organizationId, employeeId);
  const [inputs, setInputs] = useState<SettlementInputs>(initial);
  const set = <K extends keyof SettlementInputs>(field: K, value: SettlementInputs[K]) => setInputs((current) => ({ ...current, [field]: value }));
  const leaveTotal = view.leaveBalances.reduce((sum, item) => sum + item.remainingDays, 0);
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <h3 className="font-semibold">Settlement inputs</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Final salary from" hint={`Up to the last working day, ${view.exit?.lastWorkingDay}`}>
          {(id) => <input id={id} type="date" value={inputs.salaryFrom} onChange={(e) => set("salaryFrom", e.target.value)} className={inputClass} />}
        </Field>
        <Field label="Leave days to encash" hint={view.leaveBalances.length ? `Unused paid leave: ${view.leaveBalances.map((b) => `${b.name} ${b.remainingDays}`).join(", ")} (${leaveTotal})` : "No paid leave types with an allowance"}>
          {(id) => <input id={id} type="number" min={0} step="0.5" value={inputs.encashDays} onChange={(e) => set("encashDays", Number(e.target.value || 0))} className={inputClass} />}
        </Field>
        <Field label="Daily rate" hint="Default: monthly basic ÷ 26">
          {(id) => <input id={id} type="number" min={0} step="0.01" value={inputs.dailyRate} onChange={(e) => set("dailyRate", Number(e.target.value || 0))} className={inputClass} />}
        </Field>
      </div>
      <div className="space-y-2 text-sm">
        <label className={`flex items-start gap-2 ${view.gratuity?.eligible ? "" : "opacity-60"}`}>
          <input type="checkbox" className="mt-0.5 accent-primary" disabled={!view.gratuity?.eligible} checked={inputs.includeGratuity && !!view.gratuity?.eligible} onChange={(e) => set("includeGratuity", e.target.checked)} />
          <span>Pay gratuity <span className="text-muted-foreground">({view.gratuity?.reason}{view.gratuity?.eligible ? `: ${formatMoney(view.gratuity.amount, view.currencyCode)}` : ""})</span></span>
        </label>
        {view.exit?.exitType === "resignation" && (
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 accent-primary" checked={inputs.waiveNoticeRecovery} onChange={(e) => set("waiveNoticeRecovery", e.target.checked)} />
            <span>Waive recovery for notice not served <span className="text-muted-foreground">({view.exit.noticeDays} days' notice from {view.exit.resignationDate})</span></span>
          </label>
        )}
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium">Extra lines</span>
        {inputs.extraLines.map((line, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <select aria-label="Type" value={line.kind} onChange={(e) => set("extraLines", inputs.extraLines.map((l, i) => (i === index ? { ...l, kind: e.target.value as typeof l.kind } : l)))} className={`${inputClass} w-36`}>
              <option value="other_earning">Earning</option>
              <option value="other_deduction">Deduction</option>
            </select>
            <input aria-label="Description" value={line.label} maxLength={120} placeholder="e.g. Performance bonus, laptop damage" onChange={(e) => set("extraLines", inputs.extraLines.map((l, i) => (i === index ? { ...l, label: e.target.value } : l)))} className={`${inputClass} min-w-48 flex-1`} />
            <input aria-label="Amount" type="number" min={0} step="0.01" value={line.amount} onChange={(e) => set("extraLines", inputs.extraLines.map((l, i) => (i === index ? { ...l, amount: Number(e.target.value || 0) } : l)))} className={`${inputClass} w-32`} />
            <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => set("extraLines", inputs.extraLines.filter((_, i) => i !== index))}><Trash2 /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => set("extraLines", [...inputs.extraLines, { kind: "other_earning", label: "", amount: 0 }])}><Plus /> Add line</Button>
      </div>
      <ErrorText message={save.error?.message ?? null} />
      <Button disabled={save.isPending} onClick={() => save.mutate({ ...inputs, extraLines: inputs.extraLines.filter((line) => line.label.trim() && line.amount > 0) })}>
        {save.isPending ? <Loader2 className="animate-spin" /> : <Calculator />} Calculate and save draft
      </Button>
    </div>
  );
};

const PayForm: React.FC<{ organizationId: string; employeeId: string }> = ({ organizationId, employeeId }) => {
  const pay = useMarkSettlementPaid(organizationId, employeeId);
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <Field label="Paid by">
        {(id) => (
          <select id={id} value={method} onChange={(e) => setMethod(e.target.value)} className={`${inputClass} w-40`}>
            <option value="bank_transfer">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        )}
      </Field>
      <Field label="Reference">{(id) => <input id={id} value={reference} maxLength={120} placeholder="UTR / cheque no." onChange={(e) => setReference(e.target.value)} className={`${inputClass} w-44`} />}</Field>
      <Field label="Paid on">{(id) => <input id={id} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className={`${inputClass} w-40`} />}</Field>
      <Button disabled={pay.isPending} onClick={() => pay.mutate({ paymentMethod: method, paymentReference: reference || undefined, paidOn })}>
        {pay.isPending ? <Loader2 className="animate-spin" /> : <Wallet />} Mark paid
      </Button>
      <div className="basis-full"><ErrorText message={pay.error?.message ?? null} /></div>
    </div>
  );
};

const SettlementEditor: React.FC<{ organizationId: string; employeeId: string }> = ({ organizationId, employeeId }) => {
  const { data: view, isLoading, error } = useQuery(settlementQuery(organizationId, employeeId));
  const finalize = useFinalizeSettlement(organizationId, employeeId);
  const discard = useDiscardSettlement(organizationId, employeeId);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  if (isLoading) return <Spinner />;
  if (!view) return <ErrorText message={error?.message ?? "Could not load the settlement."} />;
  if (!view.exit) {
    return <EmptyState text={`${view.employeeName} has no exit recorded. Record their resignation or termination on their profile first.`} />;
  }
  const s = view.settlement;
  const status = s ? SETTLEMENT_STATUS[s.status] : null;
  const shown = s ?? view.preview;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">{view.employeeName}</h2>
          <p className="text-sm text-muted-foreground">
            {view.exit.exitType[0].toUpperCase() + view.exit.exitType.slice(1)} · last working day {view.exit.lastWorkingDay}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span> : <span className="text-xs text-muted-foreground">Not started: suggested figures below</span>}
          {s && (
            <Button variant="outline" size="sm" onClick={() => { setDownloadError(null); apiDownload(statementPath(organizationId, employeeId)).catch((e: Error) => setDownloadError(e.message)); }}>
              <Download /> Statement
            </Button>
          )}
        </div>
      </div>
      <ErrorText message={downloadError} />

      {view.assetsHeld.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">{view.employeeName} still holds {view.assetsHeld.length} company asset(s)</p>
          <ul className="mt-1 list-disc pl-5">
            {view.assetsHeld.map((a) => (
              <li key={a.assetTag}>{a.name} ({a.assetTag}), since {a.assignedOn}{a.purchaseCost ? `, cost ${formatMoney(a.purchaseCost, view.currencyCode)}` : ""}</li>
            ))}
          </ul>
          <p className="mt-1">Take them back on the <Link to="/assets" className="underline">Assets</Link> page, or add a deduction line below to recover their value.</p>
        </div>
      )}

      {(!s || s.status === "draft") && (
        <InputsForm key={s?.id ?? "new"} view={view} employeeId={employeeId} organizationId={organizationId} initial={(s ?? view.preview)!.inputs} />
      )}

      {shown && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="mb-3 font-semibold">{s ? "Settlement" : "Suggested settlement (not saved yet)"}</h3>
          <LinesTable lines={shown.lines} currency={view.currencyCode} totals={shown} />
          {s?.notes && <p className="mt-3 text-sm text-amber-700">{s.notes}</p>}
          {s?.paidAt && <p className="mt-3 text-sm text-muted-foreground">Paid {s.paidAt.slice(0, 10)} by {s.paymentMethod?.replace("_", " ")}{s.paymentReference ? `, ref ${s.paymentReference}` : ""}.</p>}
        </div>
      )}

      {s?.status === "draft" && (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={finalize.isPending}
            onClick={() => {
              if (window.confirm("Finalize this settlement? Loan recoveries will be recorded, expense claims marked paid, and payroll will stop paying this employee from the salary start date. It can no longer be edited.")) finalize.mutate(undefined);
            }}
          >
            {finalize.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Finalize settlement
          </Button>
          <Button variant="ghost" disabled={discard.isPending} onClick={() => discard.mutate(undefined)}>Discard draft</Button>
        </div>
      )}
      {s?.status === "finalized" && <PayForm organizationId={organizationId} employeeId={employeeId} />}
      <ErrorText message={finalize.error?.message ?? discard.error?.message ?? null} />
    </section>
  );
};

/** Leavers' full & final settlements: final salary, leave encashment, gratuity, recoveries. Owners and admins. */
const SettlementsPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const [params, setParams] = useSearchParams();
  const selected = params.get("employee");
  const { data, isLoading, error } = useQuery(settlementsQuery(organizationId));
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Full & final settlements"
        description="Settle everything owed to or by an employee who is leaving: final salary, leave encashment, gratuity, notice, loans and expense claims."
      />
      {isLoading ? (
        <Spinner />
      ) : !data ? (
        <ErrorText message={error?.message ?? "Could not load settlements."} />
      ) : data.length === 0 && !selected ? (
        <EmptyState text="No one is leaving. Record a resignation or termination on an employee's profile (Exit & notice period) to start a settlement." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <ul className="h-fit divide-y rounded-xl border bg-card">
            {data.map((row) => {
              const status = row.settlementStatus ? SETTLEMENT_STATUS[row.settlementStatus] : null;
              return (
                <li key={row.employeeId}>
                  <button type="button" onClick={() => setParams({ employee: row.employeeId })}
                    className={`w-full px-4 py-3 text-left hover:bg-muted/50 ${selected === row.employeeId ? "bg-primary/5" : ""}`}>
                    <span className="block text-sm font-medium">{row.employeeName}</span>
                    <span className="block text-xs text-muted-foreground">Leaves {row.lastWorkingDay}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs">
                      {status ? <span className={`rounded-full px-2 py-0.5 ${status.className}`}>{status.label}</span> : <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">To prepare</span>}
                      {row.netPayable && row.currencyCode && <span className="text-muted-foreground">{formatMoney(row.netPayable, row.currencyCode)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {selected ? (
            <SettlementEditor key={selected} organizationId={organizationId} employeeId={selected} />
          ) : (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Choose a leaver to prepare or review their settlement.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SettlementsPage;
