import type { EmployeeStatutoryInput } from "@/hooks/use-statutory";

export type StatutoryValues = {
  uan: string;
  esiNumber: string;
  pan: string;
  taxRegime: "new" | "old";
  declaredDeductions: string;
  pfApplicable: boolean;
  esiApplicable: boolean;
};

export const emptyStatutoryValues: StatutoryValues = {
  uan: "",
  esiNumber: "",
  pan: "",
  taxRegime: "new",
  declaredDeductions: "",
  pfApplicable: true,
  esiApplicable: true,
};

export const statutoryValuesToInput = (values: StatutoryValues): EmployeeStatutoryInput => ({
  uan: values.uan.trim(),
  esiNumber: values.esiNumber.trim(),
  pfApplicable: values.pfApplicable,
  esiApplicable: values.esiApplicable,
  taxRegime: values.taxRegime,
  declaredDeductions: values.taxRegime === "old" ? Number(values.declaredDeductions) || 0 : 0,
  ...(values.pan.trim() ? { pan: values.pan.toUpperCase().trim() } : {}),
});
