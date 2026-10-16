import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Spinner } from "@/components/form-kit";
import { inputClass } from "@/lib/form-utils";

// Four letters for the bank, a zero, then six letters or digits for the branch.
const INDIAN_IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
import {
  BLOOD_GROUPS,
  employeeProfileQuery,
  GENDER_OPTIONS,
  useSaveEmployeeProfile,
  type EmployeeProfile,
} from "@/hooks/use-employee-records";

const text = (value: string | null) => value ?? "";

const Form: React.FC<{
  organizationId: string;
  employeeId: string;
  profile: EmployeeProfile;
}> = ({ organizationId, employeeId, profile }) => {
  const save = useSaveEmployeeProfile(organizationId, employeeId);
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      Object.entries(profile).map(([key, value]) => [key, text(value as string | null)]),
    ) as Record<keyof EmployeeProfile, string>,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const input =
    (key: keyof EmployeeProfile, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) =>
    (id: string) => (
      <input
        id={id}
        value={values[key]}
        onChange={(e) => {
          setSaved(false);
          setValues((prev) => ({ ...prev, [key]: e.target.value }));
        }}
        className={inputClass}
        {...extra}
      />
    );

  const select =
    (key: keyof EmployeeProfile, options: readonly { value: string; label: string }[]) =>
    (id: string) => (
      <select
        id={id}
        value={values[key]}
        onChange={(e) => {
          setSaved(false);
          setValues((prev) => ({ ...prev, [key]: e.target.value }));
        }}
        className={inputClass}
      >
        <option value="">Not set</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const payload = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value.trim() || null]),
    ) as Partial<EmployeeProfile>;
    // An untouched masked number means "keep the stored one".
    if (values.bankAccountNumber === text(profile.bankAccountNumber)) delete payload.bankAccountNumber;
    save.mutate(payload as EmployeeProfile, {
      onSuccess: () => setSaved(true),
      onError: (e) => setError(e.message),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-xl border bg-background p-5 shadow-sm sm:p-6"
      noValidate
    >
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Personal &amp; address</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date of birth">{input("dateOfBirth", { type: "date" })}</Field>
          <Field label="Gender">{select("gender", GENDER_OPTIONS)}</Field>
          <Field label="Blood group">{select("bloodGroup", BLOOD_GROUPS.map((group) => ({ value: group, label: group })))}</Field>
        </div>
        <Field label="Address line 1">{input("addressLine1", { maxLength: 200 })}</Field>
        <Field label="Address line 2">{input("addressLine2", { maxLength: 200 })}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City">{input("city", { maxLength: 100 })}</Field>
          <Field label="State">{input("state", { maxLength: 100 })}</Field>
          <Field label="Postal code">{input("postalCode", { maxLength: 20 })}</Field>
          <Field label="Country">{input("country", { maxLength: 100 })}</Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-semibold">Emergency contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">{input("emergencyContactName", { maxLength: 100 })}</Field>
          <Field label="Relationship">{input("emergencyContactRelation", { maxLength: 50 })}</Field>
        </div>
        <Field label="Phone" hint="Include the country code, e.g. +91 98765 43210.">
          {input("emergencyContactPhone", { type: "tel", maxLength: 20 })}
        </Field>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-semibold">Bank details</legend>
        <p className="text-xs text-muted-foreground">
          Used to pay salary. Only you and authorized HR or admins can see these.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Account holder name">{input("bankAccountHolder", { maxLength: 100 })}</Field>
          <Field label="Bank name">{input("bankName", { maxLength: 100 })}</Field>
          <Field
            label="Account number"
            hint={
              profile.bankAccountNumber
                ? "Stored encrypted. Type a new number to replace it."
                : "Stored encrypted; only the last 4 digits are shown afterwards."
            }
          >
            {input("bankAccountNumber", {
              maxLength: 34,
              autoComplete: "off",
              onFocus: (e) => {
                if (e.currentTarget.value === text(profile.bankAccountNumber)) e.currentTarget.select();
              },
            })}
          </Field>
          <div>
            <Field label="IFSC / routing code">
              {input("bankIfsc", { maxLength: 20, autoComplete: "off", className: `${inputClass} uppercase` })}
            </Field>
            {/* Not blocked (foreign routing codes are allowed), but salary bank files only take Indian IFSCs. */}
            {values.bankIfsc.trim() !== "" && !INDIAN_IFSC.test(values.bankIfsc.trim().toUpperCase()) && (
              <p role="status" className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Not an Indian IFSC: it must be 11 characters with 0 as the 5th, e.g. BARB0VJAHMD. Salary bank transfer files will skip this
                employee.
              </p>
            )}
          </div>
        </div>
        <Field label="UPI ID (optional)">{input("upiId", { maxLength: 100 })}</Field>
      </fieldset>

      <ErrorText message={error} />
      {saved && (
        <p role="status" className="text-sm text-green-600">
          Details saved.
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

const EmployeeProfileForm: React.FC<{ organizationId: string; employeeId: string }> = ({
  organizationId,
  employeeId,
}) => {
  const { data, isLoading, error } = useQuery(employeeProfileQuery(organizationId, employeeId));
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorText message={error?.message ?? "Could not load details."} />;
  return <Form organizationId={organizationId} employeeId={employeeId} profile={data} />;
};

export default EmployeeProfileForm;
