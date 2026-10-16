import { queryOptions } from "@tanstack/react-query";
import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type SettlementLineKind =
  | "salary"
  | "leave_encashment"
  | "gratuity"
  | "reimbursement"
  | "other_earning"
  | "notice_recovery"
  | "loan_recovery"
  | "other_deduction";

export type SettlementLine = { kind: SettlementLineKind; label: string; amount: string };

export type SettlementInputs = {
  salaryFrom: string;
  encashDays: number;
  dailyRate: number;
  includeGratuity: boolean;
  waiveNoticeRecovery: boolean;
  extraLines: { kind: "other_earning" | "other_deduction"; label: string; amount: number }[];
  utcOffsetMinutes: number;
};

export type SettlementStatus = "draft" | "finalized" | "paid" | "cancelled";

export type Settlement = {
  id: string;
  status: SettlementStatus;
  lastWorkingDay: string;
  salaryFrom: string;
  currencyCode: string;
  inputs: SettlementInputs;
  lines: SettlementLine[];
  totalEarnings: string;
  totalDeductions: string;
  netPayable: string;
  notes: string | null;
  finalizedAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
};

export type SettlementView = {
  employeeName: string;
  exit: { exitType: string; status: string; resignationDate: string; noticeDays: number; lastWorkingDay: string } | null;
  currencyCode: string;
  leaveBalances: { name: string; remainingDays: number }[];
  gratuity: { eligible: boolean; years: number; amount: number; reason: string } | null;
  assetsHeld: { assetTag: string; name: string; category: string; purchaseCost: string | null; assignedOn: string }[];
  settlement: Settlement | null;
  preview: { inputs: SettlementInputs; lines: SettlementLine[]; notes: string[]; totalEarnings: string; totalDeductions: string; netPayable: string } | null;
};

export type SettlementSummary = {
  employeeId: string;
  employeeName: string;
  lastWorkingDay: string;
  exitStatus: string;
  settlementStatus: SettlementStatus | null;
  netPayable: string | null;
  currencyCode: string | null;
};

const key = (organizationId: string) => ["settlements", organizationId] as const;

export const settlementsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "list"] as const,
    queryFn: () => request<SettlementSummary[]>("/settlements", organizationId),
    enabled: !!organizationId,
  });

export const settlementQuery = (organizationId: string, employeeId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), employeeId] as const,
    queryFn: () => request<SettlementView>(`/settlements/${employeeId}`, organizationId),
    enabled: !!organizationId && !!employeeId,
  });

const invalidate = (organizationId: string) => [key(organizationId)];

export const useSaveSettlementDraft = (organizationId: string, employeeId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (inputs: SettlementInputs) =>
    request<SettlementView>(`/settlements/${employeeId}`, organizationId, "PUT", inputs),
  );

export const useFinalizeSettlement = (organizationId: string, employeeId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), () =>
    request<SettlementView>(`/settlements/${employeeId}/finalize`, organizationId, "POST"),
  );

export const useMarkSettlementPaid = (organizationId: string, employeeId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (body: { paymentMethod: string; paymentReference?: string; paidOn?: string }) =>
    request<SettlementView>(`/settlements/${employeeId}/paid`, organizationId, "POST", body),
  );

export const useDiscardSettlement = (organizationId: string, employeeId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), () =>
    request<SettlementView>(`/settlements/${employeeId}`, organizationId, "DELETE"),
  );

export const statementPath = (organizationId: string, employeeId: string) =>
  `/settlements/${employeeId}/statement?organizationId=${encodeURIComponent(organizationId)}`;

const DEDUCTIONS: SettlementLineKind[] = ["notice_recovery", "loan_recovery", "other_deduction"];
export const isDeduction = (kind: SettlementLineKind) => DEDUCTIONS.includes(kind);

export const SETTLEMENT_STATUS: Record<SettlementStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-amber-100 text-amber-800" },
  finalized: { label: "Finalized, to pay", className: "bg-sky-100 text-sky-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  cancelled: { label: "Discarded", className: "bg-muted text-muted-foreground" },
};
