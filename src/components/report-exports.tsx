import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Loader2, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Field } from "@/components/form-kit";
import { inputClass } from "@/lib/form-utils";
import { apiDownload } from "@/lib/api";
import { payrollRunsQuery } from "@/hooks/use-payroll-api";
import { statutoryEmployeesQuery } from "@/hooks/use-statutory";
import { branchesQuery } from "@/hooks/use-branches";

type ReportType = "attendance" | "muster" | "leave" | "payroll" | "wages" | "bank" | "loans" | "pf" | "esi" | "pt" | "tds" | "form16";

const TYPES: { value: ReportType; label: string; hint: string }[] = [
  { value: "attendance", label: "Attendance", hint: "Daily status, punch times, hours, late and early minutes (max 93 days)." },
  { value: "muster", label: "Muster roll (attendance register)", hint: "One row per employee, one column per day: P, A, HD, L, WO, H. Up to 31 days; inspectors ask for one month." },
  { value: "leave", label: "Leave", hint: "Leave requests overlapping the dates, with type, days and status." },
  { value: "payroll", label: "Payroll", hint: "Per-employee days, gross, deductions and net pay for one payroll run." },
  { value: "wages", label: "Register of wages", hint: "Days worked, earnings, each deduction and net pay for one run, with a signature column." },
  { value: "bank", label: "Salary bank transfer (NEFT)", hint: "One transfer per employee for a finalized run: CSV for your bank's bulk upload, plus Excel and a signable PDF." },
  { value: "loans", label: "Loans & advances", hint: "Principal, repaid and outstanding balances as of today." },
  { value: "pf", label: "Provident fund (PF)", hint: "Contributions and challan totals for one run. The ECR text file is also available." },
  { value: "esi", label: "ESI", hint: "Employee and employer ESI contributions for one run." },
  { value: "pt", label: "Professional tax", hint: "Professional tax deducted for one run." },
  { value: "tds", label: "TDS on salary", hint: "Income tax deducted for one run." },
  { value: "form16", label: "Annual tax statement (Form 16 style)", hint: "One employee's year of salary, deductions and tax. Not the TRACES Form 16." },
];

const RUN_TYPES: ReportType[] = ["payroll", "wages", "bank", "pf", "esi", "pt", "tds"];
// Reports HR and branch managers may download; the rest need an admin role.
const PEOPLE_TYPES: ReportType[] = ["attendance", "muster", "leave"];

const iso = (d: Date) => d.toLocaleDateString("en-CA");

const defaultFy = (now: Date) => {
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
};

const ReportExports: React.FC<{ organizationId: string; sensitiveReportsAllowed: boolean }> = ({ organizationId, sensitiveReportsAllowed }) => {
  const now = new Date();
  // The sidebar's "Export reports" opens /reports#export and lands here.
  const { hash } = useLocation();
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (hash === "#export") sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);
  const [chosenType, setType] = useState<ReportType>("attendance");
  // Without an admin role only the people reports are offered.
  const type: ReportType = sensitiveReportsAllowed || PEOPLE_TYPES.includes(chosenType) ? chosenType : "attendance";
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [runId, setRunId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [fy, setFy] = useState(defaultFy(now));
  const [branchId, setBranchId] = useState("");
  // Attendance, leave and payroll reports can be narrowed to one branch.
  const branchable = type === "attendance" || type === "muster" || type === "leave" || type === "payroll";
  const { data: branchData } = useQuery(branchesQuery(organizationId));
  const branches = (branchData?.branches ?? []).filter((b) => b.manageable);
  const [busy, setBusy] = useState<"xlsx" | "pdf" | "ecr" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsRun = sensitiveReportsAllowed && RUN_TYPES.includes(type);
  const runs = useQuery({ ...payrollRunsQuery(organizationId), enabled: needsRun });
  const employees = useQuery({ ...statutoryEmployeesQuery(organizationId), enabled: sensitiveReportsAllowed && type === "form16" });

  const needsDates = type === "attendance" || type === "muster" || type === "leave";
  const current = TYPES.find((t) => t.value === type)!;
  const visibleTypes = sensitiveReportsAllowed
    ? TYPES
    : TYPES.filter((item) => PEOPLE_TYPES.includes(item.value));

  const download = async (format: "xlsx" | "pdf" | "ecr" | "csv") => {
    setError(null);
    if (!sensitiveReportsAllowed && !PEOPLE_TYPES.includes(type)) {
      return setError("This report requires an admin role.");
    }
    if (needsRun && !runId) return setError("Choose a payroll run.");
    if (type === "form16" && (!employeeId || !/^\d{4}-\d{2}$/.test(fy))) {
      return setError("Choose an employee and a financial year like 2026-27.");
    }
    if (needsDates && from > to) return setError("The from date must be before the to date.");
    if (type === "muster" && (Date.parse(to) - Date.parse(from)) / 86_400_000 > 30) {
      return setError("A muster roll covers at most one month (31 days).");
    }
    const params = new URLSearchParams({
      organizationId,
      type,
      format,
      utcOffsetMinutes: String(-new Date().getTimezoneOffset()),
    });
    if (needsDates) {
      params.set("from", from);
      params.set("to", to);
    }
    if (needsRun) params.set("runId", runId);
    if (branchable && branchId) params.set("branchId", branchId);
    if (type === "form16") {
      params.set("employeeId", employeeId);
      params.set("fy", fy);
    }
    setBusy(format);
    try {
      await apiDownload(`/report/download?${params}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the report");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id="export" ref={sectionRef} className="scroll-mt-20 space-y-4 rounded-xl border bg-background p-5 shadow-sm">
      <div>
        <h2 className="font-semibold">Export reports</h2>
        <p className="text-sm text-muted-foreground">
          Excel or PDF: attendance, muster roll, leave, payroll, register of wages, salary bank transfer, PF, ESI, PT, TDS and Form 16.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Report" hint={current.hint}>
          {(id) => (
            <select
              id={id}
              value={type}
              onChange={(e) => setType(e.target.value as ReportType)}
              className={inputClass}
            >
              {visibleTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        {needsDates && (
          <>
            <Field label="From">
              {(id) => (
                <input id={id} type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
              )}
            </Field>
            <Field label="To">
              {(id) => (
                <input id={id} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={inputClass} />
              )}
            </Field>
          </>
        )}
        {needsRun && (
          <Field label="Payroll run">
            {(id) => (
              <select id={id} value={runId} onChange={(e) => setRunId(e.target.value)} className={inputClass}>
                <option value="">Select a run…</option>
                {(runs.data ?? []).map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.periodStart} to {run.periodEnd} ({run.status})
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        {branchable && branches.length > 0 && (
          <Field label="Branch">
            {(id) => (
              <select id={id} value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
                <option value="">{branchData?.limitedTo ? "All my branches" : "All branches"}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
          </Field>
        )}
        {type === "form16" && (
          <>
            <Field label="Employee">
              {(id) => (
                <select id={id} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
                  <option value="">Select an employee…</option>
                  {(employees.data ?? []).map((emp) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.employeeName}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Financial year" hint="For example 2026-27 (April to March).">
              {(id) => <input id={id} value={fy} maxLength={7} onChange={(e) => setFy(e.target.value)} className={inputClass} />}
            </Field>
          </>
        )}
      </div>
      <ErrorText message={error} />
      <div className="flex flex-wrap gap-2">
        <Button className="h-10" disabled={busy !== null} onClick={() => download("xlsx")}>
          {busy === "xlsx" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Download Excel
        </Button>
        <Button variant="outline" className="h-10" disabled={busy !== null} onClick={() => download("pdf")}>
          {busy === "pdf" ? <Loader2 className="animate-spin" /> : <FileText />} Download PDF
        </Button>
        {type === "bank" && (
          <Button variant="outline" className="h-10" disabled={busy !== null} onClick={() => download("csv")}>
            {busy === "csv" ? <Loader2 className="animate-spin" /> : <FileCode />} Bank upload CSV
          </Button>
        )}
        {type === "pf" && (
          <Button variant="outline" className="h-10" disabled={busy !== null} onClick={() => download("ecr")}>
            {busy === "ecr" ? <Loader2 className="animate-spin" /> : <FileCode />} EPFO ECR file
          </Button>
        )}
      </div>
    </section>
  );
};

export default ReportExports;
