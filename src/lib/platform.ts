import { api } from "@/lib/api";

export type PlatformOrganizationStatus = "active" | "suspended" | "pending_deletion";

export type PlatformOrganization = {
  id: string;
  name: string;
  slug: string;
  status: PlatformOrganizationStatus;
  suspendedReason?: string | null;
  suspendedAt?: string | Date | null;
  createdAt: string | Date | null;
  owner: { id: string; name: string; phone: string; email: string | null } | null;
  usage: {
    activeEmployees: number;
    totalEmployees: number;
    activeAdmins: number;
    totalAdmins: number;
    loginsLast30Days: number;
    lastSignInAt: string | Date | null;
  };
};

export type PlatformOrganizationList = {
  items: PlatformOrganization[];
  page: number;
  pageSize: number;
  total: number;
};

export type PlatformOrganizationDetail = PlatformOrganization & {
  notes: Array<{ id: string; authorName: string; text: string; createdAt: string | Date }>;
};

export type PlatformOverview = {
  metrics: {
    totalOrganizations: number;
    activeOrganizations: number;
    suspendedOrganizations: number;
    newThisMonth: number;
    employees: number;
    organizationsWithSignIn30Days: number;
  };
  signupsByMonth: Array<{ month: string; label: string; organizations: number }>;
  recentOrganizations: PlatformOrganization[];
  reportingStartedAt: string;
  billing: {
    activeSubscriptions: number;
    openInvoices: number;
    outstandingAmount: string;
    /** Upgrade requests first, then trials or paid periods ending soon, grace and read-only. */
    attention: Array<{ id: string; name: string; upgradeRequestedAt: string | null; access: PlatformAccess }>;
  };
};

export type PlatformPlan = {
  id: string;
  name: string;
  description: string | null;
  currencyCode: string;
  priceAmount: string;
  billingPeriod: "monthly" | "annual";
  includedEmployees: number;
  overagePrice: string;
  features: string[];
  visibility: "public" | "custom";
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type PlatformBillingProfile = {
  organizationId: string;
  legalName: string;
  gstin: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  email: string | null;
  whatsappPhone: string | null;
  updatedAt: string | Date;
};

/** Mirrors OrganizationAccess in server/src/services/billing-access.services.ts. */
export type PlatformAccess = {
  state: "inactive" | "trial" | "paid" | "grace" | "read_only";
  trialEndsAt: string | null;
  paidUntil: string | null;
  accessEndsAt: string | null;
  graceEndsAt: string | null;
  daysLeft: number;
};

export type PlatformOrganizationBilling = {
  profile: PlatformBillingProfile | null;
  subscription: null | {
    id: string;
    status: "active" | "trial" | "past_due" | "cancelled";
    startsAt: string;
    nextBillingAt: string | null;
    paidUntil: string | null;
    planId: string;
    planName: string;
    priceAmount: string;
    currencyCode: string;
    billingPeriod: "monthly" | "annual";
  };
  access: PlatformAccess | null;
  billableEmployees: number;
  upgradeRequestedAt: string | null;
  /** Custom plans this organization's owner can see. */
  offeredPlanIds: string[];
};

/** One line describing where an organization stands, for the platform console. */
export const describeAccess = (access: PlatformAccess, upgradeRequestedAt?: string | null) => {
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  const state =
    access.state === "inactive"
      ? "Trial not started"
      : access.state === "trial"
      ? `Trial · ${days(access.daysLeft)} left`
      : access.state === "paid"
        ? `Paid until ${formatPlatformDate(access.accessEndsAt)}`
        : access.state === "grace"
          ? `Grace · read-only in ${days(access.daysLeft)}`
          : "Read-only";
  return upgradeRequestedAt ? `Upgrade requested ${formatPlatformDate(upgradeRequestedAt)} · ${state}` : state;
};

export type PlatformInvoice = {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  organizationName: string;
  status: "open" | "paid" | "void";
  currencyCode: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  issuedAt: string | Date;
  dueDate: string | null;
  paidAt: string | Date | null;
  whatsappStatus: "not_sent" | "queued" | "sent" | "failed";
  whatsappDestination?: string | null;
  whatsappSentAt: string | Date | null;
  whatsappError: string | null;
};

export type PlatformInvoiceDetail = PlatformInvoice & {
  taxRate: string;
  billTo: Record<string, string | null>;
  notes: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  items: Array<{ id: string; description: string; quantity: string; unitPrice: string; lineSubtotal: string; lineTax: string; lineTotal: string }>;
};

export type PlatformInvoiceList = { items: PlatformInvoice[]; page: number; pageSize: number; total: number };

export type PlatformAuditPage = {
  items: Array<{
    id: string;
    actorUserId: string;
    actorName: string;
    action: string;
    targetOrganizationId: string | null;
    targetOrganizationName: string | null;
    targetUserId: string | null;
    reason: string | null;
    beforeValues: Record<string, unknown> | null;
    afterValues: Record<string, unknown> | null;
    ipAddress: string | null;
    createdAt: string | Date;
  }>;
  page: number;
  pageSize: number;
  total: number;
};

export async function platformApi<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  const response = await api<{ data: T }>(`/platform${path}`, { ...options, auth: true });
  return response.data;
}

export const formatPlatformDate = (value: string | Date | null | undefined) => {
  if (!value) return "Unknown";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
};
