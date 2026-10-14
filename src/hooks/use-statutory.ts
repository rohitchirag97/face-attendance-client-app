import { queryOptions } from "@tanstack/react-query";

import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type PtState = "MH" | "KA" | "WB" | "GJ" | "TG" | "AP" | "FLAT";

export type StatutorySettings = {
  pfEnabled: boolean;
  pfWageCeiling: number;
  pfCapWages: boolean;
  pfEstablishmentCode: string | null;
  esiEnabled: boolean;
  esiWageCeiling: number;
  esiEstablishmentCode: string | null;
  ptEnabled: boolean;
  ptState: PtState | null;
  ptFlatAmount: number | null;
  tdsEnabled: boolean;
  tan: string | null;
  employerPan: string | null;
  employerAddress: string | null;
};

export type EmployeeStatutory = {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  uan: string | null;
  esiNumber: string | null;
  panMasked: string | null;
  gender: string | null;
  pfApplicable: boolean;
  esiApplicable: boolean;
  taxRegime: "new" | "old";
  declaredDeductions: number;
};

export type EmployeeStatutoryInput = {
  uan?: string;
  esiNumber?: string;
  pan?: string;
  gender?: "male" | "female" | "other" | "";
  pfApplicable?: boolean;
  esiApplicable?: boolean;
  taxRegime?: "new" | "old";
  declaredDeductions?: number;
};

export const PT_STATE_OPTIONS: { value: PtState; label: string }[] = [
  { value: "MH", label: "Maharashtra" },
  { value: "KA", label: "Karnataka" },
  { value: "WB", label: "West Bengal" },
  { value: "GJ", label: "Gujarat" },
  { value: "TG", label: "Telangana" },
  { value: "AP", label: "Andhra Pradesh" },
  { value: "FLAT", label: "Other (fixed monthly amount)" },
];

const settingsKey = (organizationId: string) => ["statutory-settings", organizationId] as const;
const employeesKey = (organizationId: string) => ["statutory-employees", organizationId] as const;

export const statutorySettingsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: settingsKey(organizationId),
    queryFn: () => request<StatutorySettings>("/statutory/settings", organizationId),
  });

export const statutoryEmployeesQuery = (organizationId: string) =>
  queryOptions({
    queryKey: employeesKey(organizationId),
    queryFn: () => request<EmployeeStatutory[]>("/statutory/employees", organizationId),
  });

export const useSaveStatutorySettings = (organizationId: string) =>
  useOrgMutation(organizationId, [[...settingsKey(organizationId)]], (body: StatutorySettings) =>
    request("/statutory/settings", organizationId, "PUT", body),
  );

export const useSaveEmployeeStatutory = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [[...employeesKey(organizationId)]],
    (vars: { employeeId: string; body: EmployeeStatutoryInput }) =>
      request(`/statutory/employees/${vars.employeeId}`, organizationId, "PUT", vars.body),
  );
