import { queryOptions } from "@tanstack/react-query";
import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type TaxSection = "80C" | "80CCD1B" | "80D_SELF" | "80D_PARENTS" | "HRA" | "24B" | "80E" | "80TTA" | "PREVIOUS_EMPLOYER";
export type ItemStatus = "pending" | "accepted" | "rejected";
export type Regime = "new" | "old";
type Details = Record<string, string | number | boolean | null>;

/** Mirrors SECTIONS in server/src/services/tax-declaration-calc.ts (limits shown for guidance). */
export const SECTION_OPTIONS: { value: TaxSection; label: string; limit: string; kinds: { value: string; label: string }[]; oldOnly: boolean }[] = [
  { value: "80C", label: "Section 80C investments", limit: "Up to ₹1,50,000", oldOnly: true, kinds: [
    { value: "ppf", label: "Public Provident Fund (PPF)" }, { value: "elss", label: "ELSS mutual funds" },
    { value: "lic", label: "Life insurance premium" }, { value: "epf_vpf", label: "Voluntary PF (VPF)" },
    { value: "nsc", label: "National Savings Certificate" }, { value: "tuition_fees", label: "Children's tuition fees" },
    { value: "home_loan_principal", label: "Home loan principal" }, { value: "sukanya", label: "Sukanya Samriddhi" },
    { value: "tax_saver_fd", label: "5-year tax-saver FD" }, { value: "other", label: "Other 80C" },
  ] },
  { value: "80CCD1B", label: "NPS, section 80CCD(1B)", limit: "Up to ₹50,000", oldOnly: true, kinds: [{ value: "nps", label: "National Pension System" }] },
  { value: "80D_SELF", label: "Health insurance, self and family (80D)", limit: "₹25,000 (₹50,000 if you are 60+)", oldOnly: true, kinds: [
    { value: "health_insurance", label: "Health insurance premium" }, { value: "preventive_checkup", label: "Preventive health check-up" },
  ] },
  { value: "80D_PARENTS", label: "Health insurance, parents (80D)", limit: "₹25,000 (₹50,000 if parents are 60+)", oldOnly: true, kinds: [
    { value: "health_insurance", label: "Health insurance premium" }, { value: "preventive_checkup", label: "Preventive health check-up" },
  ] },
  { value: "HRA", label: "House rent (HRA exemption)", limit: "Worked out from your salary", oldOnly: true, kinds: [{ value: "rent", label: "Rent paid" }] },
  { value: "24B", label: "Home loan interest, section 24(b)", limit: "Up to ₹2,00,000", oldOnly: true, kinds: [{ value: "home_loan_interest", label: "Interest on self-occupied home loan" }] },
  { value: "80E", label: "Education loan interest (80E)", limit: "No limit", oldOnly: true, kinds: [{ value: "education_loan_interest", label: "Interest on education loan" }] },
  { value: "80TTA", label: "Savings account interest (80TTA)", limit: "Up to ₹10,000", oldOnly: true, kinds: [{ value: "savings_interest", label: "Savings bank interest" }] },
  { value: "PREVIOUS_EMPLOYER", label: "Previous employer this year", limit: "If you joined this year", oldOnly: false, kinds: [{ value: "salary_and_tds", label: "Salary and TDS from previous employer" }] },
];

export type DeclarationItem = {
  id: string;
  section: TaxSection;
  sectionLabel: string;
  kind: string;
  kindLabel: string;
  description: string | null;
  declaredAmount: string;
  details: Details;
  status: ItemStatus;
  verifiedAmount: string | null;
  reviewNote: string | null;
  hasProof: boolean;
  proofName: string | null;
};

export type DeclarationView = {
  financialYear: string;
  settings: { declarationClosesOn: string | null; proofDeadline: string };
  phase: "declaration" | "proofs" | "closed";
  declaration: { id: string; taxRegime: Regime; seniorSelf: boolean; seniorParents: boolean } | null;
  items: DeclarationItem[];
  totals: {
    deductions: number;
    oldRegimeDeductions: number;
    breakdown: { section: TaxSection; label: string; claimed: number; allowed: number }[];
    previousEmployer: { gross: number; tds: number };
  };
  projection: { old: number; new: number; cheaper: Regime; saving: number } | null;
  salaryKnown: boolean;
};

export type ReviewDetail = DeclarationView & { employeeId: string; employeeName: string; declarationId: string };

export type DeclarationSummary = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  taxRegime: Regime;
  itemCount: number;
  declaredTotal: string;
  awaitingReview: number;
  missingProofs: number;
};

/** "2026-27" for the financial year containing the date (April to March). */
export const financialYearOf = (date = new Date()) => {
  const start = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
};
export const previousFinancialYear = (label: string) => {
  const start = Number(label.slice(0, 4)) - 1;
  return `${start}-${String(start + 1).slice(2)}`;
};

const fyQuery = (financialYear: string) => `&financialYear=${financialYear}`;
const key = (organizationId: string) => ["tax-declarations", organizationId] as const;

export const myDeclarationQuery = (organizationId: string, financialYear: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "mine", financialYear] as const,
    queryFn: () => request<DeclarationView>("/tax-declarations/mine", organizationId, undefined, undefined, fyQuery(financialYear)),
    enabled: !!organizationId,
  });

export const declarationsQuery = (organizationId: string, financialYear: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "all", financialYear] as const,
    queryFn: () =>
      request<{ financialYear: string; settings: DeclarationView["settings"]; declarations: DeclarationSummary[] }>(
        "/tax-declarations",
        organizationId,
        undefined,
        undefined,
        fyQuery(financialYear),
      ),
    enabled: !!organizationId,
  });

export const reviewDetailQuery = (organizationId: string, declarationId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "detail", declarationId] as const,
    queryFn: () => request<ReviewDetail>(`/tax-declarations/${declarationId}`, organizationId),
    enabled: !!organizationId && !!declarationId,
  });

const invalidate = (organizationId: string) => [key(organizationId)];

export const useSaveDeclaration = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (body: { financialYear: string; taxRegime: Regime; seniorSelf: boolean; seniorParents: boolean }) =>
    request<DeclarationView>("/tax-declarations/mine", organizationId, "PUT", body),
  );

export type ItemInput = { section: TaxSection; kind: string; description?: string; declaredAmount: number; details: Details };

export const useAddDeclarationItem = (organizationId: string, financialYear: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (body: ItemInput) =>
    request<DeclarationView>("/tax-declarations/mine/items", organizationId, "POST", body, fyQuery(financialYear)),
  );

export const useDeleteDeclarationItem = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (itemId: string) =>
    request<DeclarationView>(`/tax-declarations/items/${itemId}`, organizationId, "DELETE"),
  );

export const useUploadProof = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (vars: { itemId: string; file: File }) => {
    const form = new FormData();
    form.set("proof", vars.file);
    return request<DeclarationView>(`/tax-declarations/items/${vars.itemId}/proof`, organizationId, "POST", form);
  });

export const useReviewItem = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (vars: { itemId: string; status: "accepted" | "rejected"; verifiedAmount?: number; note?: string }) =>
    request<ReviewDetail>(`/tax-declarations/items/${vars.itemId}/review`, organizationId, "PATCH", {
      status: vars.status,
      verifiedAmount: vars.verifiedAmount,
      note: vars.note || undefined,
    }),
  );

export const useSaveDeclarationSettings = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (body: { financialYear: string; declarationClosesOn: string | null; proofDeadline: string }) =>
    request("/tax-declarations/settings", organizationId, "PUT", body),
  );

export const openProof = async (organizationId: string, itemId: string) => {
  const { url } = await request<{ url: string }>(`/tax-declarations/items/${itemId}/proof`, organizationId);
  window.open(url, "_blank", "noopener,noreferrer");
};

export const form12bbPath = (organizationId: string, declarationId: string) =>
  `/tax-declarations/${declarationId}/form-12bb?organizationId=${encodeURIComponent(organizationId)}`;

export const rupees = (value: number | string) =>
  `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export const ITEM_STATUS: Record<ItemStatus, { label: string; className: string }> = {
  pending: { label: "Not verified yet", className: "bg-amber-100 text-amber-800" },
  accepted: { label: "Verified", className: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800" },
};

export const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
