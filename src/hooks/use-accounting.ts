import { queryOptions } from "@tanstack/react-query";
import { request, useOrgMutation } from "@/hooks/use-payroll-api";
import { apiDownload } from "@/lib/api";

export type AccountingSplit = "none" | "branch" | "department";

export type AccountingSettings = {
  ledgers: Record<string, string>;
  splitBy: AccountingSplit;
  definitions: { key: string; label: string; defaultName: string; group: string }[];
};

export type JournalVoucher = {
  key: string;
  kind: "payroll" | "settlement" | "bonus";
  number: string;
  date: string;
  narration: string;
  total: number;
  balanced: boolean;
  lines: { ledger: string; debit: number; credit: number; costCentre: string | null }[];
  lastExport: { at: string; format: string } | null;
};

export type ExportFormat = "tally" | "csv" | "xlsx";

const key = (organizationId: string) => ["accounting", organizationId] as const;

export const accountingSettingsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "settings"] as const,
    queryFn: () => request<AccountingSettings>("/accounting/settings", organizationId),
    enabled: !!organizationId,
  });

export const journalQuery = (organizationId: string, from: string, to: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "journal", from, to] as const,
    queryFn: () =>
      request<{ splitBy: AccountingSplit; vouchers: JournalVoucher[] }>("/accounting/journal", organizationId, undefined, undefined, `&from=${from}&to=${to}`),
    enabled: !!organizationId && !!from && !!to && from <= to,
  });

export const useSaveAccountingSettings = (organizationId: string) =>
  useOrgMutation(organizationId, [key(organizationId)], (body: { ledgers: Record<string, string>; splitBy: AccountingSplit }) =>
    request<AccountingSettings>("/accounting/settings", organizationId, "PUT", body),
  );

/** Downloads the journal file; the export is logged, so the preview is refreshed to show it. */
export const useExportJournal = (organizationId: string) =>
  useOrgMutation(organizationId, [key(organizationId)], (body: { from: string; to: string; format: ExportFormat; keys: string[]; includeLedgers: boolean }) =>
    apiDownload(`/accounting/journal/export?organizationId=${encodeURIComponent(organizationId)}`, body),
  );

export const VOUCHER_KIND: Record<JournalVoucher["kind"], string> = {
  payroll: "Payroll",
  settlement: "Full & final",
  bonus: "Bonus",
};

export const FORMAT_LABEL: Record<string, string> = { tally: "Tally XML", csv: "CSV", xlsx: "Excel" };
