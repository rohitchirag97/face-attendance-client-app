import { queryOptions } from "@tanstack/react-query";
import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type ExpenseCategory =
  | "travel"
  | "fuel"
  | "food"
  | "accommodation"
  | "phone_internet"
  | "office_supplies"
  | "client_meeting"
  | "medical"
  | "other";

export type ExpenseStatus = "pending" | "approved" | "rejected" | "cancelled" | "paid";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "travel", label: "Travel" },
  { value: "fuel", label: "Fuel" },
  { value: "food", label: "Food" },
  { value: "accommodation", label: "Accommodation" },
  { value: "phone_internet", label: "Phone & internet" },
  { value: "office_supplies", label: "Office supplies" },
  { value: "client_meeting", label: "Client meeting" },
  { value: "medical", label: "Medical" },
  { value: "other", label: "Other" },
];

export type ExpenseClaim = {
  id: string;
  employeeId: string;
  employeeName: string;
  category: ExpenseCategory;
  categoryLabel: string;
  amount: string;
  currencyCode: string;
  expenseDate: string;
  description: string;
  status: ExpenseStatus;
  hasReceipt: boolean;
  receiptName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  payrollRunId: string | null;
  paidAt: string | null;
  paymentNote: string | null;
  createdAt: string;
};

const key = (organizationId: string) => ["expenses", organizationId] as const;

export const myClaimsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "mine"] as const,
    queryFn: () => request<{ claims: ExpenseClaim[]; receiptsEnabled: boolean }>("/expenses/mine", organizationId),
    enabled: !!organizationId,
  });

export const claimsQuery = (organizationId: string, status?: ExpenseStatus) =>
  queryOptions({
    queryKey: [...key(organizationId), "all", status ?? "any"] as const,
    queryFn: () =>
      request<ExpenseClaim[]>("/expenses", organizationId, undefined, undefined, status ? `&status=${status}` : ""),
    enabled: !!organizationId,
  });

export const useCreateClaim = (organizationId: string) =>
  useOrgMutation(organizationId, [key(organizationId)], (form: FormData) =>
    request<ExpenseClaim>("/expenses", organizationId, "POST", form),
  );

export const useCancelClaim = (organizationId: string) =>
  useOrgMutation(organizationId, [key(organizationId)], (claimId: string) =>
    request<ExpenseClaim>(`/expenses/${claimId}/cancel`, organizationId, "POST"),
  );

export const useReviewClaim = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [key(organizationId)],
    (vars: { claimId: string; status: "approved" | "rejected"; note?: string }) =>
      request<ExpenseClaim>(`/expenses/${vars.claimId}/review`, organizationId, "PATCH", {
        status: vars.status,
        note: vars.note || undefined,
      }),
  );

export const useMarkClaimPaid = (organizationId: string) =>
  useOrgMutation(organizationId, [key(organizationId)], (vars: { claimId: string; note?: string }) =>
    request<ExpenseClaim>(`/expenses/${vars.claimId}/paid`, organizationId, "POST", { note: vars.note || undefined }),
  );

/** Opens the receipt in a new tab through a short-lived signed link. */
export const openReceipt = async (organizationId: string, claimId: string) => {
  const { url } = await request<{ url: string }>(`/expenses/${claimId}/receipt`, organizationId);
  window.open(url, "_blank", "noopener,noreferrer");
};

export const STATUS_STYLE: Record<ExpenseStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved", className: "bg-sky-100 text-sky-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};
