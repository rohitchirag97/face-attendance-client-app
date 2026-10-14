import { queryOptions } from "@tanstack/react-query";
import { request, useOrgMutation } from "@/hooks/use-payroll-api";

/** See server/src/services/billing-access.services.ts for how each state is reached. */
export type AccessState = "inactive" | "trial" | "paid" | "grace" | "read_only";

export type BillingPlan = {
  id: string;
  name: string;
  description: string | null;
  currencyCode: string;
  billingPeriod: "monthly" | "annual";
  priceAmount: string;
  includedEmployees: number;
  overagePrice: string;
  estimatedAmount: string;
};

export type BillingStatus = {
  state: AccessState;
  /** Null until the owner starts the trial. */
  trialEndsAt: string | null;
  paidUntil: string | null;
  accessEndsAt: string | null;
  graceEndsAt: string | null;
  daysLeft: number;
  isOwner: boolean;
  planName: string | null;
  owner?: {
    billableEmployees: number;
    upgradeRequestedAt: string | null;
    plans: BillingPlan[];
  };
};

export const billingStatusQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["billing-status", organizationId] as const,
    queryFn: () => request<BillingStatus>("/billing/status", organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
  });

export const useRequestUpgrade = (organizationId: string) =>
  useOrgMutation(organizationId, [["billing-status", organizationId]], () =>
    request<{ upgradeRequestedAt: string }>("/billing/upgrade-request", organizationId, "POST"),
  );

export const formatMoney = (amount: string | number, currency: string) =>
  `${currency === "INR" ? "₹" : `${currency} `}${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const formatDay = (iso: string | null) =>
  !iso ? "" :
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const useStartTrial = (organizationId: string) =>
  useOrgMutation(organizationId, [["billing-status", organizationId]], () =>
    request<unknown>("/billing/start-trial", organizationId, "POST"),
  );
