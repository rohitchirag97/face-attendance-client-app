import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { hasPeopleManagerRole } from "@/lib/session";
import { branchesQuery } from "@/hooks/use-branches";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Spinner } from "@/components/form-kit";
import { formatTime12Hour, inputClass } from "@/lib/form-utils";
import {
  employmentToValues,
  valuesToEmploymentInput,
  type EmploymentFormValues,
  type EmploymentSectionKey,
} from "@/lib/employment-form";
import { SalaryComponentsEditor } from "@/components/salary-components-editor";
import {
  departmentsQuery,
  employmentQuery,
  shiftsQuery,
  useUpdateEmployment,
  type Employment,
} from "@/hooks/use-payroll-api";

export const EmploymentFields: React.FC<{
  organizationId: string;
  values: EmploymentFormValues;
  onChange: (values: EmploymentFormValues) => void;
  disabled?: boolean;
  section?: EmploymentSectionKey;
}> = ({ organizationId, values, onChange, disabled, section }) => {
  const { data: departments = [] } = useQuery(departmentsQuery(organizationId));
  const { data: shifts = [] } = useQuery(shiftsQuery(organizationId));
  const set =
    (key: keyof EmploymentFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      onChange({ ...values, [key]: event.target.value });

  const activeDepartments = departments.filter((d) => d.isActive || d.id === values.departmentId);
  const activeShifts = shifts.filter((s) => s.isActive || s.id === values.shiftId);
  const { data: branchData } = useQuery(branchesQuery(organizationId, hasPeopleManagerRole(organizationId)));
  // A branch manager can place people only in their own branches.
  const activeBranches = (branchData?.branches ?? []).filter((b) => (b.isActive && b.manageable) || b.id === values.branchId);

  return (
    <div className="space-y-6">
    {section !== "pay" && (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Employee code">
        {(id) => <input id={id} value={values.employeeCode} onChange={set("employeeCode")} maxLength={32} disabled={disabled} className={inputClass} />}
      </Field>
      <Field label="Job title">
        {(id) => <input id={id} value={values.jobTitle} onChange={set("jobTitle")} maxLength={100} disabled={disabled} className={inputClass} />}
      </Field>
      <Field label="Department">
        {(id) => (
          <select id={id} value={values.departmentId} onChange={set("departmentId")} disabled={disabled} className={inputClass}>
            <option value="">None</option>
            {activeDepartments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Shift">
        {(id) => (
          <select id={id} value={values.shiftId} onChange={set("shiftId")} disabled={disabled} className={inputClass}>
            <option value="">None</option>
            {activeShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatTime12Hour(s.startTime)}–{formatTime12Hour(s.endTime)})
              </option>
            ))}
          </select>
        )}
      </Field>
      {activeBranches.length > 0 && (
        <Field label="Branch" hint="Holidays, professional tax and GPS check-in follow the branch">
          {(id) => (
            <select id={id} value={values.branchId} onChange={set("branchId")} disabled={disabled} className={inputClass}>
              {!branchData?.limitedTo && <option value="">None</option>}
              {activeBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
        </Field>
      )}
      <Field label="Employment type">
        {(id) => (
          <select id={id} value={values.employmentType} onChange={set("employmentType")} disabled={disabled} className={inputClass}>
            <option value="">Not set</option>
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="contractor">Contractor</option>
            <option value="intern">Intern</option>
          </select>
        )}
      </Field>
      <Field label="Hire date">
        {(id) => <input id={id} type="date" value={values.hireDate} onChange={set("hireDate")} disabled={disabled} className={inputClass} />}
      </Field>
    </div>
    )}
    {section !== "job" && (
    <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Pay basis">
        {(id) => (
          <select id={id} value={values.compensationType} onChange={set("compensationType")} disabled={disabled} className={inputClass}>
            <option value="">Not set</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="fixed_salary">Fixed salary</option>
          </select>
        )}
      </Field>
      <Field label="Pay frequency">
        {(id) => (
          <select id={id} value={values.payFrequency} onChange={set("payFrequency")} disabled={disabled} className={inputClass}>
            <option value="">Not set</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every two weeks</option>
            <option value="semimonthly">Twice a month</option>
            <option value="monthly">Monthly</option>
          </select>
        )}
      </Field>
      <Field label="Base amount">
        {(id) => <input id={id} type="number" min="0" step="0.01" value={values.compensationAmount} onChange={set("compensationAmount")} disabled={disabled} className={inputClass} />}
      </Field>
      <Field label="Currency">
        {(id) => <input id={id} value={values.compensationCurrency} onChange={set("compensationCurrency")} maxLength={3} placeholder="INR" disabled={disabled} className={`${inputClass} uppercase`} />}
      </Field>
    </div>
    <SalaryComponentsEditor
      value={values.salaryComponents}
      onChange={(salaryComponents) => onChange({ ...values, salaryComponents })}
      disabled={disabled}
    />
    </div>
    )}
    </div>
  );
};

const EmploymentForm: React.FC<{
  organizationId: string;
  employeeId: string;
  employment: Employment;
  section: EmploymentSectionKey;
}> = ({ organizationId, employeeId, employment, section }) => {
  const save = useUpdateEmployment(organizationId, employeeId);
  const [values, setValues] = useState(() => employmentToValues(employment));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const result = valuesToEmploymentInput(values, section);
    if ("error" in result) return setError(result.error);
    save.mutate(result.input, {
      onSuccess: () => setSaved(true),
      onError: (e) => setError(e.message),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <EmploymentFields
        organizationId={organizationId}
        values={values}
        onChange={setValues}
        disabled={save.isPending}
        section={section}
      />
      <ErrorText message={error} />
      {saved && (
        <p role="status" className="text-sm text-green-600">
          Employment details saved.
        </p>
      )}
      <div className="flex justify-end border-t pt-4">
        <Button type="submit" className="h-10" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Save {section === "job" ? "job details" : "pay & salary"}
        </Button>
      </div>
    </form>
  );
};

const EmploymentSection: React.FC<{
  organizationId: string;
  employeeId: string;
  section: EmploymentSectionKey;
}> = ({ organizationId, employeeId, section }) => {
  const { data, isLoading, error } = useQuery(employmentQuery(organizationId, employeeId));

  return (
    <section className="space-y-4 rounded-xl border bg-background p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="font-semibold">{section === "job" ? "Job details" : "Pay & salary"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {section === "job"
            ? "Code, department, shift and employment type in this organization."
            : "Base compensation, allowances and deductions in this organization."}
        </p>
      </div>
      <ErrorText message={error?.message} />
      {isLoading ? (
        <Spinner />
      ) : (
        data && (
          <EmploymentForm
            organizationId={organizationId}
            employeeId={employeeId}
            employment={data}
            section={section}
          />
        )
      )}
    </section>
  );
};

export default EmploymentSection;
