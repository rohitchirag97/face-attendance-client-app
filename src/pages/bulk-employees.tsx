import React, { useRef, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { checkBulkEmployees, useBulkCreateEmployees, type BulkCheckResult } from "@/hooks/use-api";
import { departmentsQuery, request, saveEmployment, shiftsQuery } from "@/hooks/use-payroll-api";
import {
  downloadEmployeeTemplate,
  parseEmployeeSheet,
  type BulkEmployeeRow,
  type SheetLookups,
} from "@/lib/employee-excel";
import { getActiveOrganizationId, getOrganizations, hasManagerRole } from "@/lib/session";

const STATUS_TEXT: Record<string, string> = {
  created: "Created",
  added: "Added to organization",
  "already-member": "Already a member",
  forbidden: "Not allowed",
  "duplicate-in-file": "Duplicate in file",
  failed: "Failed",
  "details-failed": "Added, but job/pay details not saved - edit the employee",
};

/** What the import will do with a row, decided by the server check before anything is written. */
type RowPlan = { action: "import" | "skip" | "blocked"; note: string; kind?: "new" | "existing" | "reactivated" };

const planRows = (rows: BulkEmployeeRow[], check: BulkCheckResult): Record<number, RowPlan> => {
  const plans: Record<number, RowPlan> = {};
  for (const row of rows) {
    if (row.error) continue;
    const found = check.phones[row.phone];
    const status = found?.status ?? "new";
    const code = row.employment.employeeCode;
    const codeHolder = code ? check.takenCodes[code] : undefined;
    const who = found?.name ? ` (${found.name})` : "";

    if (status === "member") {
      plans[row.row] = { action: "skip", note: `Already in this organization${who} - skipped` };
    } else if (status === "not-allowed") {
      plans[row.row] = { action: "blocked", note: `You can't add or change this person${who}` };
    } else if (codeHolder && codeHolder !== row.phone) {
      plans[row.row] = { action: "blocked", note: `Employee code "${code}" is already used by +${codeHolder}` };
    } else if (status === "existing-user") {
      plans[row.row] = { action: "import", kind: "existing", note: `Has a HazriPro account${who} - will be added` };
    } else if (status === "inactive-member") {
      plans[row.row] = { action: "import", kind: "reactivated", note: `Former employee${who} - will be reactivated` };
    } else {
      plans[row.row] = { action: "import", kind: "new", note: "New employee" };
    }
  }
  return plans;
};

const BulkEmployees: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? getOrganizations()[0]?.id ?? "";
  const canAssignElevated = hasManagerRole(organizationId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BulkEmployeeRow[]>([]);
  const [plans, setPlans] = useState<Record<number, RowPlan>>({});
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const bulk = useBulkCreateEmployees();
  const queryClient = useQueryClient();
  const [savingDetails, setSavingDetails] = useState(false);

  const importRows = rows.filter((row) => !row.error && plans[row.row]?.action === "import");
  const count = (action: RowPlan["action"]) => Object.values(plans).filter((p) => p.action === action).length;
  const formatErrors = rows.filter((row) => row.error).length;
  const alreadyMembers = count("skip");
  const blocked = count("blocked");
  const ofKind = (kind: RowPlan["kind"]) => importRows.filter((row) => plans[row.row]?.kind === kind).length;
  const reactivated = ofKind("reactivated");
  const existingAccounts = ofKind("existing");
  const brandNew = ofKind("new");

  const loadLookups = async (): Promise<SheetLookups> => {
    const [departments, shifts] = await Promise.all([
      queryClient.fetchQuery(departmentsQuery(organizationId)),
      queryClient.fetchQuery(shiftsQuery(organizationId)),
    ]);
    return {
      departments: departments.filter((d) => d.isActive),
      shifts: shifts.filter((s) => s.isActive),
    };
  };

  const handleDownload = async () => {
    setError(null);
    try {
      await downloadEmployeeTemplate(canAssignElevated, await loadLookups());
    } catch {
      setError("Could not create the template.");
    }
  };

  const handleFile = async (file: File | undefined) => {
    setError(null);
    setResults({});
    setRows([]);
    setPlans({});
    if (!file) return;
    setFileName(file.name);
    setBusy(true);
    try {
      const parsed = await parseEmployeeSheet(file, canAssignElevated, await loadLookups());
      setRows(parsed);
      const valid = parsed.filter((row) => !row.error);
      if (valid.length > 0) {
        const codes = valid.flatMap((row) => (row.employment.employeeCode ? [row.employment.employeeCode] : []));
        try {
          const check = await checkBulkEmployees(organizationId, valid.map((row) => row.phone), codes);
          setPlans(planRows(parsed, check));
        } catch (checkError) {
          setError(
            `Could not compare the sheet with your existing employees, so nothing can be imported yet. ${
              checkError instanceof Error ? checkError.message : ""
            } Upload the file again to retry.`,
          );
        }
      }
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Could not read the file.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleImport = () => {
    setError(null);
    bulk.mutate(
      {
        organizationId,
        employees: importRows.map(({ fname, lname, phone, role }) => ({ fname, lname, phone, role })),
      },
      {
        onSuccess: async (data) => {
          const byRow: Record<number, string> = {};
          setSavingDetails(true);
          for (const result of data) {
            const source = importRows[result.row - 1];
            if (!source) continue;
            let status = result.status;
            if (result.employeeId && (status === "created" || status === "added")) {
              try {
                if (Object.keys(source.employment).length > 0) {
                  await saveEmployment(organizationId, result.employeeId, source.employment);
                }
                if (source.statutory) {
                  await request(
                    `/statutory/employees/${result.employeeId}`,
                    organizationId,
                    "PUT",
                    source.statutory,
                  );
                }
              } catch {
                status = "details-failed";
              }
            }
            byRow[source.row] = status;
          }
          setSavingDetails(false);
          setResults(byRow);
        },
        onError: (importError) =>
          setError(importError instanceof Error ? importError.message : "Import failed."),
      },
    );
  };

  const imported = Object.values(results).filter(
    (s) => s === "created" || s === "added" || s === "details-failed",
  ).length;
  const done = Object.keys(results).length > 0;
  const checked = Object.keys(plans).length > 0;

  const rowResult = (row: BulkEmployeeRow): { text: string; tone: "error" | "muted" | "default" } => {
    const result = results[row.row];
    if (result) {
      const failed = ["forbidden", "failed", "duplicate-in-file", "details-failed"].includes(result);
      return { text: STATUS_TEXT[result] ?? result, tone: failed ? "error" : "default" };
    }
    if (row.error) return { text: row.error, tone: "error" };
    const plan = plans[row.row];
    if (!plan) return { text: busy ? "Checking…" : "Not checked", tone: "muted" };
    return { text: plan.note, tone: plan.action === "blocked" ? "error" : plan.action === "skip" ? "muted" : "default" };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bulk upload employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Download the Excel template, fill in one employee per row, then upload it. We check every row against your
          existing employees before anything is imported.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border p-4">
        <Button variant="outline" onClick={() => void handleDownload()}>
          <Download />
          Download template
        </Button>
        <Button onClick={() => fileInput.current?.click()} disabled={busy || bulk.isPending || savingDetails}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />}
          Upload filled sheet
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".xlsx"
          className="hidden"
          aria-label="Upload filled employee sheet"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
        {fileName && <span className="self-center text-sm text-muted-foreground">{fileName}</span>}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {rows.length > 0 && checked && !done && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-semibold">{importRows.length}</p>
            <p className="text-sm font-medium">To be imported</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {brandNew} new · {existingAccounts} with an existing HazriPro account · {reactivated} reactivated
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-2xl font-semibold">{alreadyMembers}</p>
            <p className="text-sm font-medium">Already in this organization</p>
            <p className="mt-1 text-xs text-muted-foreground">Skipped. Edit them from the employee list instead.</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className={`text-2xl font-semibold ${formatErrors + blocked > 0 ? "text-destructive" : ""}`}>
              {formatErrors + blocked}
            </p>
            <p className="text-sm font-medium">Need fixing</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Not imported. Fix these rows in the sheet and upload it again.
            </p>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              {rows.length} rows
              {done && ` · ${imported} added`}
            </span>
            <div className="flex gap-2">
              <Button
                disabled={importRows.length === 0 || busy || bulk.isPending || savingDetails || done}
                onClick={handleImport}
              >
                {(bulk.isPending || savingDetails) && <Loader2 className="animate-spin" />}
                Import {importRows.length} employee{importRows.length === 1 ? "" : "s"}
              </Button>
              {done && <Button variant="outline" render={<Link to="/employees" />}>View employees</Button>}
            </div>
          </div>
          <div className="max-h-112 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => {
                  const result = rowResult(row);
                  return (
                    <tr key={row.row}>
                      <td className="px-3 py-2">{row.row}</td>
                      <td className="px-3 py-2">
                        {row.fname} {row.lname}
                      </td>
                      <td className="px-3 py-2">+{row.phone}</td>
                      <td className="px-3 py-2 capitalize">{row.role}</td>
                      <td
                        className={`px-3 py-2 ${
                          result.tone === "error"
                            ? "text-destructive"
                            : result.tone === "muted"
                              ? "text-muted-foreground"
                              : ""
                        }`}
                      >
                        {result.text}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkEmployees;
