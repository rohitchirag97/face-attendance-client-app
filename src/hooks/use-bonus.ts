import { queryOptions } from "@tanstack/react-query";
import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type BonusRunStatus = "draft" | "approved" | "paid";
export type BonusPayout = "payroll" | "direct";

export type BonusRun = {
  id: string;
  financialYear: string;
  status: BonusRunStatus;
  percentage: string;
  eligibilityCeiling: string;
  calculationCeiling: string;
  payout: BonusPayout;
  totalAmount: string;
  approvedAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  updatedAt: string;
};

export type BonusItem = {
  id: string;
  userOrganizationId: string;
  employeeName: string;
  eligible: boolean;
  reason: string | null;
  monthlyWage: string;
  daysWorked: string;
  bonusWages: string;
  calculatedAmount: string;
  finalAmount: string;
  included: boolean;
  paidInPayrollRunId: string | null;
  paidAt: string | null;
};

export type BonusRunDetail = { run: BonusRun; items: BonusItem[]; currencyCode: string; payrollMonths: number };

export type BonusCalculateInput = {
  financialYear: string;
  percentage: number;
  eligibilityCeiling: number;
  calculationCeiling: number;
  payout: BonusPayout;
};

export type GratuityRow = {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  departmentName: string | null;
  hireDate: string | null;
  monthlyBasic: number;
  serviceYears: number;
  serviceMonths: number;
  countedYears: number;
  eligible: boolean;
  eligibleFrom: string | null;
  eligibleSoon: boolean;
  amount: number;
  note: string | null;
};

export type GratuityReport = {
  asOf: string;
  currencyCode: string;
  totalLiability: number;
  payableNow: number;
  eligibleCount: number;
  eligibleSoonCount: number;
  employees: GratuityRow[];
};

const key = (organizationId: string) => ["bonus", organizationId] as const;

export const bonusRunsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "runs"] as const,
    queryFn: () => request<{ runs: BonusRun[]; currentFinancialYear: string; currencyCode: string }>("/bonus/runs", organizationId),
    enabled: !!organizationId,
  });

export const bonusRunQuery = (organizationId: string, runId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "run", runId] as const,
    queryFn: () => request<BonusRunDetail>(`/bonus/runs/${runId}`, organizationId),
    enabled: !!organizationId && !!runId,
  });

export const gratuityQuery = (organizationId: string, asOf: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "gratuity", asOf] as const,
    queryFn: () => request<GratuityReport>("/bonus/gratuity", organizationId, undefined, undefined, `&asOf=${asOf}`),
    enabled: !!organizationId && !!asOf,
  });

const invalidate = (organizationId: string) => [key(organizationId)];

export const useCalculateBonus = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (body: BonusCalculateInput) =>
    request<BonusRunDetail>("/bonus/runs", organizationId, "POST", body),
  );

export const useUpdateBonusItem = (organizationId: string, runId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), ({ itemId, ...body }: { itemId: string; finalAmount?: number; included?: boolean }) =>
    request<BonusRunDetail>(`/bonus/runs/${runId}/items/${itemId}`, organizationId, "PATCH", body),
  );

export const useApproveBonus = (organizationId: string, runId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), () =>
    request<BonusRunDetail>(`/bonus/runs/${runId}/approve`, organizationId, "POST"),
  );

export const useMarkBonusPaid = (organizationId: string, runId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (body: { paymentReference?: string; paidOn?: string }) =>
    request<BonusRunDetail>(`/bonus/runs/${runId}/paid`, organizationId, "POST", body),
  );

export const useDeleteBonusRun = (organizationId: string, runId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), () =>
    request<null>(`/bonus/runs/${runId}`, organizationId, "DELETE"),
  );

export const BONUS_STATUS: Record<BonusRunStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved, to pay", className: "bg-sky-100 text-sky-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
};

/** The financial year label before the given one: 2026-27 -> 2025-26. */
export const previousFinancialYear = (label: string) => {
  const start = Number(label.slice(0, 4)) - 1;
  return `${start}-${String(start + 1).slice(2)}`;
};

/** Downloads the gratuity report as an Excel sheet. */
export const downloadGratuityExcel = async (report: GratuityReport) => {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Gratuity liability");
  sheet.addRow([`Gratuity liability as of ${report.asOf}`]).font = { bold: true, size: 13 };
  sheet.addRow([`Total liability: ${report.totalLiability}`, `Payable now: ${report.payableNow}`, `Currency: ${report.currencyCode}`]);
  sheet.addRow([]);
  const header = sheet.addRow(["Employee", "Code", "Department", "Hire date", "Service", "Years counted", "Monthly basic", "Gratuity accrued", "Payable now", "Payable from", "Note"]);
  header.font = { bold: true };
  for (const row of report.employees) {
    sheet.addRow([
      row.employeeName,
      row.employeeCode ?? "",
      row.departmentName ?? "",
      row.hireDate ?? "",
      row.hireDate ? `${row.serviceYears}y ${row.serviceMonths}m` : "",
      row.countedYears,
      row.monthlyBasic,
      row.amount,
      row.eligible ? "Yes" : "No",
      row.eligible ? "" : row.eligibleFrom ?? "",
      row.note ?? "",
    ]);
  }
  sheet.columns.forEach((column, index) => {
    column.width = [24, 10, 16, 12, 10, 8, 14, 16, 10, 13, 22][index];
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `gratuity-liability-${report.asOf}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
};
