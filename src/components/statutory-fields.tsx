import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Spinner } from "@/components/form-kit";
import { inputClass } from "@/lib/form-utils";
import {
  statutoryEmployeesQuery,
  useSaveEmployeeStatutory,
} from "@/hooks/use-statutory";
import { statutoryValuesToInput, type StatutoryValues } from "@/lib/statutory-form";

export const StatutoryFields: React.FC<{
  values: StatutoryValues;
  onChange: (values: StatutoryValues) => void;
  disabled?: boolean;
  panMasked?: string | null;
}> = ({ values, onChange, disabled, panMasked }) => {
  const set = <K extends keyof StatutoryValues>(key: K, value: StatutoryValues[K]) =>
    onChange({ ...values, [key]: value });
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        UAN and ESI numbers are needed for the PF and ESI filing files. PAN is stored encrypted and shown masked.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="UAN">
          {(id) => (
            <input id={id} inputMode="numeric" maxLength={12} value={values.uan} disabled={disabled} onChange={(e) => set("uan", e.target.value)} className={inputClass} />
          )}
        </Field>
        <Field label="ESI number">
          {(id) => (
            <input id={id} inputMode="numeric" maxLength={17} value={values.esiNumber} disabled={disabled} onChange={(e) => set("esiNumber", e.target.value)} className={inputClass} />
          )}
        </Field>
        <Field label="PAN" hint={panMasked ? `On file: ${panMasked}. Type to replace.` : undefined}>
          {(id) => (
            <input id={id} maxLength={10} value={values.pan} disabled={disabled} onChange={(e) => set("pan", e.target.value)} className={`${inputClass} uppercase`} placeholder={panMasked ?? "ABCDE1234F"} />
          )}
        </Field>
        <Field label="Tax regime">
          {(id) => (
            <select id={id} value={values.taxRegime} disabled={disabled} onChange={(e) => set("taxRegime", e.target.value as "new" | "old")} className={inputClass}>
              <option value="new">New regime</option>
              <option value="old">Old regime</option>
            </select>
          )}
        </Field>
        <Field label="Declared deductions (yearly)" hint="Old regime only: 80C, 80D, HRA and similar.">
          {(id) => (
            <input id={id} type="number" min="0" value={values.declaredDeductions} onChange={(e) => set("declaredDeductions", e.target.value)} className={inputClass} disabled={disabled || values.taxRegime === "new"} />
          )}
        </Field>
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={values.pfApplicable} disabled={disabled} onChange={(e) => set("pfApplicable", e.target.checked)} /> PF applies
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={values.esiApplicable} disabled={disabled} onChange={(e) => set("esiApplicable", e.target.checked)} /> ESI applies
        </label>
      </div>
    </div>
  );
};

const EditForm: React.FC<{
  organizationId: string;
  employeeId: string;
  initial: StatutoryValues;
  panMasked: string | null;
}> = ({ organizationId, employeeId, initial, panMasked }) => {
  const save = useSaveEmployeeStatutory(organizationId);
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    save.mutate(
      { employeeId, body: statutoryValuesToInput(values) },
      {
        onSuccess: () => {
          setValues((prev) => ({ ...prev, pan: "" }));
          setSaved(true);
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-6 rounded-xl border bg-background p-5 shadow-sm sm:p-6" noValidate>
      <StatutoryFields
        values={values}
        onChange={(next) => {
          setSaved(false);
          setValues(next);
        }}
        panMasked={panMasked}
      />
      <ErrorText message={error} />
      {saved && (
        <p role="status" className="text-sm text-green-600">
          Statutory details saved.
        </p>
      )}
      <div className="flex justify-end border-t pt-4">
        <Button type="submit" className="h-10" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Save details
        </Button>
      </div>
    </form>
  );
};

export const EmployeeStatutoryForm: React.FC<{ organizationId: string; employeeId: string }> = ({
  organizationId,
  employeeId,
}) => {
  const { data, isLoading, error } = useQuery(statutoryEmployeesQuery(organizationId));
  if (isLoading) return <Spinner />;
  const employee = data?.find((row) => row.employeeId === employeeId);
  if (error || !employee) {
    return <ErrorText message={error?.message ?? "Could not load statutory details (the employee must be active)."} />;
  }
  return (
    <EditForm
      organizationId={organizationId}
      employeeId={employeeId}
      panMasked={employee.panMasked}
      initial={{
        uan: employee.uan ?? "",
        esiNumber: employee.esiNumber ?? "",
        pan: "",
        taxRegime: employee.taxRegime,
        declaredDeductions: String(employee.declaredDeductions || ""),
        pfApplicable: employee.pfApplicable,
        esiApplicable: employee.esiApplicable,
      }}
    />
  );
};
