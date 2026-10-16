import { toNumberOrNull, toTextOrNull } from "@/lib/form-utils";
import type { Employment, EmploymentInput } from "@/hooks/use-payroll-api";

export type ComponentFormValue = {
  name: string;
  kind: "earning" | "deduction";
  calc: "fixed" | "percent_basic";
  value: string;
};

export type EmploymentSectionKey = "job" | "pay";

export type EmploymentFormValues = {
  employeeCode: string;
  jobTitle: string;
  departmentId: string;
  shiftId: string;
  branchId: string;
  employmentType: string;
  hireDate: string;
  compensationType: string;
  compensationAmount: string;
  compensationCurrency: string;
  payFrequency: string;
  salaryComponents: ComponentFormValue[];
};

export const emptyEmploymentValues: EmploymentFormValues = {
  employeeCode: "",
  jobTitle: "",
  departmentId: "",
  shiftId: "",
  branchId: "",
  employmentType: "",
  hireDate: "",
  compensationType: "",
  compensationAmount: "",
  compensationCurrency: "",
  payFrequency: "",
  salaryComponents: [],
};

export const hasEmploymentValues = (values: EmploymentFormValues) =>
  values.salaryComponents.length > 0 ||
  Object.values(values).some((value) => typeof value === "string" && value.trim() !== "");

export const employmentToValues = (employment: Employment): EmploymentFormValues => ({
  employeeCode: employment.employeeCode ?? "",
  jobTitle: employment.jobTitle ?? "",
  departmentId: employment.departmentId ?? "",
  shiftId: employment.shiftId ?? "",
  branchId: employment.branchId ?? "",
  employmentType: employment.employmentType ?? "",
  hireDate: employment.hireDate ?? "",
  compensationType: employment.compensationType ?? "",
  compensationAmount: employment.compensationAmount ?? "",
  compensationCurrency: employment.compensationCurrency ?? "",
  payFrequency: employment.payFrequency ?? "",
  salaryComponents: (employment.salaryComponents ?? []).map((c) => ({ ...c, value: String(c.value) })),
});

export const valuesToEmploymentInput = (
  values: EmploymentFormValues,
  section?: EmploymentSectionKey,
): { input: Partial<EmploymentInput> } | { error: string } => {
  const currency = values.compensationCurrency.trim();
  if (currency && !/^[A-Za-z]{3}$/.test(currency)) {
    return { error: "Currency must be a 3-letter code." };
  }

  const components: EmploymentInput["salaryComponents"] = [];
  for (const component of values.salaryComponents) {
    const name = component.name.trim();
    const value = Number(component.value);
    if (!name) return { error: "Every salary component needs a name." };
    if (component.value.trim() === "" || !Number.isFinite(value) || value < 0) {
      return { error: `Enter a valid amount for ${name}.` };
    }
    if (component.calc === "percent_basic" && value > 100) {
      return { error: `${name}: a percentage cannot be more than 100.` };
    }
    components.push({ name, kind: component.kind, calc: component.calc, value });
  }

  const job: Partial<EmploymentInput> = {
    employeeCode: toTextOrNull(values.employeeCode),
    jobTitle: toTextOrNull(values.jobTitle),
    departmentId: values.departmentId || null,
    shiftId: values.shiftId || null,
    branchId: values.branchId || null,
    employmentType: (values.employmentType || null) as EmploymentInput["employmentType"],
    hireDate: values.hireDate || null,
  };
  const pay: Partial<EmploymentInput> = {
    compensationType: (values.compensationType || null) as EmploymentInput["compensationType"],
    compensationAmount: toNumberOrNull(values.compensationAmount),
    compensationCurrency: currency ? currency.toUpperCase() : null,
    payFrequency: (values.payFrequency || null) as EmploymentInput["payFrequency"],
    salaryComponents: components,
  };

  if (section === "job") return { input: job };
  if (section === "pay") return { input: pay };
  return { input: { ...job, ...pay } };
};
