import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Check, Download, Loader2, Upload, UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { downloadEmployeeTemplate } from "@/lib/employee-excel";
import { Button } from "@/components/ui/button";
import { useCreateEmployee } from "@/hooks/use-api";
import { PHONE_COUNTRY_CODES } from "@/lib/countries";
import { EmploymentFields } from "@/components/employment-section";
import { TabPanel, TabLayout } from "@/components/tabs";
import {
  emptyEmploymentValues,
  hasEmploymentValues,
  valuesToEmploymentInput,
} from "@/lib/employment-form";
import { request, saveEmployment, departmentsQuery, shiftsQuery } from "@/hooks/use-payroll-api";
import { StatutoryFields } from "@/components/statutory-fields";
import { BLOOD_GROUPS, GENDER_OPTIONS } from "@/hooks/use-employee-records";
import { emptyStatutoryValues, statutoryValuesToInput } from "@/lib/statutory-form";
import {
  getActiveOrganizationId,
  getOrganizations,
  hasManagerRole,
} from "@/lib/session";

const CREATE_TABS = [
  { id: "basic", label: "Basic" },
  { id: "job", label: "Job" },
  { id: "pay", label: "Pay & salary" },
  { id: "statutory", label: "Statutory" },
];

const inputClass =
  "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

const CreateEmployee: React.FC = () => {
  const navigate = useNavigate();
  const organizations = getOrganizations();
  const initialOrganizationId =
    organizations.find((organization) => organization.id === getActiveOrganizationId())?.id ??
    organizations[0]?.id ??
    "";

  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [countryCode, setCountryCode] = useState("91");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"employee" | "admin" | "hr">("employee");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [organizationId, setOrganizationId] = useState(initialOrganizationId);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const [employment, setEmployment] = useState(emptyEmploymentValues);
  const [statutory, setStatutory] = useState(emptyStatutoryValues);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("basic");
  const createEmployee = useCreateEmployee();
  const canAssignElevatedRole = hasManagerRole(organizationId);

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setCreated(false);

    const normalizedPhone = phone.replace(/\D/g, "");
    if (!fname.trim() || !lname.trim()) {
      setError("First name and last name are required.");
      return;
    }
    if (normalizedPhone.length !== 10) {
      setError("Enter a valid 10-digit phone number.");
      return;
    }
    if (!organizationId) {
      setError("Select an organization for this employee.");
      return;
    }

    const employmentResult = valuesToEmploymentInput(employment);
    if ("error" in employmentResult) {
      setError(employmentResult.error);
      return;
    }
    const hasEmployment = hasEmploymentValues(employment);

    setSaving(true);
    createEmployee.mutate(
      {
        fname: fname.trim(),
        lname: lname.trim(),
        phone: `${countryCode}${normalizedPhone}`,
        role,
        organizationId,
      },
      {
        onSuccess: async (raw) => {
          let employmentError: string | null = null;
          const response = raw as { data?: { employee?: { id?: string } } };
          const employeeId = response.data?.employee?.id;
          if (hasEmployment && employeeId) {
            try {
              await saveEmployment(organizationId, employeeId, employmentResult.input);
            } catch (saveError) {
              employmentError = saveError instanceof Error ? saveError.message : "Request failed";
            }
          }
          if (employeeId && (gender || bloodGroup)) {
            try {
              await request(`/employee-record/${employeeId}/profile`, organizationId, "PUT", { gender: gender || null, bloodGroup: bloodGroup || null });
            } catch (saveError) {
              employmentError = saveError instanceof Error ? saveError.message : "Request failed";
            }
          }
          if (employeeId && JSON.stringify(statutory) !== JSON.stringify(emptyStatutoryValues)) {
            try {
              await request(`/statutory/employees/${employeeId}`, organizationId, "PUT", statutoryValuesToInput(statutory));
            } catch (saveError) {
              employmentError = saveError instanceof Error ? saveError.message : "Request failed";
            }
          }
          setSaving(false);
          setFname("");
          setLname("");
          setPhone("");
          setRole("employee");
          setGender("");
          setBloodGroup("");
          setEmployment(emptyEmploymentValues);
          setStatutory(emptyStatutoryValues);
          if (employmentError) {
            setError(
              `Employee created, but some details were not saved: ${employmentError}. Add them from the edit screen.`,
            );
          } else {
            setCreated(true);
          }
        },
        onError: (requestError) => {
          setSaving(false);
          setError(requestError.message);
        },
      },
    );
  };

  const loading = createEmployee.isPending || saving;
  const queryClient = useQueryClient();

  const handleTemplateDownload = async () => {
    setError(null);
    try {
      const [departments, shifts] = await Promise.all([
        queryClient.fetchQuery(departmentsQuery(organizationId)),
        queryClient.fetchQuery(shiftsQuery(organizationId)),
      ]);
      await downloadEmployeeTemplate(canAssignElevatedRole, {
        departments: departments.filter((d) => d.isActive),
        shifts: shifts.filter((s) => s.isActive),
      });
    } catch {
      setError("Could not create the template.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-3 text-sm text-muted-foreground hover:text-foreground"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="size-5" />
          </span>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">Add employee</h1>
            <p className="text-sm text-muted-foreground">
              Create an employee account and assign an organization role.
            </p>
          </div>
        </div>
      </div>

      <section
        aria-labelledby="bulk-heading"
        className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 id="bulk-heading" className="text-sm font-semibold">
            Add many employees at once
          </h2>
          <p className="text-sm text-muted-foreground">
            Download the Excel template, fill it in, then upload it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handleTemplateDownload()}>
            <Download />
            Download template
          </Button>
          <Button render={<Link to="/employees/bulk" />}>
            <Upload />
            Bulk upload
          </Button>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border bg-background p-5 shadow-sm sm:p-6"
        noValidate
      >
        <TabLayout tabs={CREATE_TABS} active={tab} onChange={setTab}>
        <TabPanel id="basic" active={tab}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="employee-fname" className="text-sm font-medium">
              First name
            </label>
            <input
              id="employee-fname"
              autoComplete="given-name"
              autoFocus
              value={fname}
              onChange={(event) => setFname(event.target.value)}
              disabled={loading}
              className={inputClass}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="employee-lname" className="text-sm font-medium">
              Last name
            </label>
            <input
              id="employee-lname"
              autoComplete="family-name"
              value={lname}
              onChange={(event) => setLname(event.target.value)}
              disabled={loading}
              className={inputClass}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="employee-gender" className="text-sm font-medium">Gender</label>
            <select id="employee-gender" value={gender} onChange={(event) => setGender(event.target.value)} disabled={loading} className={inputClass}>
              <option value="">Not set</option>
              {GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="employee-blood-group" className="text-sm font-medium">Blood group</label>
            <select id="employee-blood-group" value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value)} disabled={loading} className={inputClass}>
              <option value="">Not set</option>
              {BLOOD_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="employee-phone" className="text-sm font-medium">
            Phone number
          </label>
          <div className="flex gap-2">
            <select
              aria-label="Country code"
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              disabled={loading}
              className="h-10 w-28 shrink-0 rounded-md border bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              {PHONE_COUNTRY_CODES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
            <input
              id="employee-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              maxLength={14}
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value.replace(/[^\d\s()+-]/g, ""))
              }
              disabled={loading}
              className={inputClass}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enter a 10-digit number. The country code will be included for sign-in.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="employee-role" className="text-sm font-medium">
              Role
            </label>
            {canAssignElevatedRole ? (
              <select
                id="employee-role"
                value={role}
                onChange={(event) =>
                  setRole(event.target.value as "employee" | "admin" | "hr")
                }
                disabled={loading}
                className={inputClass}
              >
                <option value="employee">Employee</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            ) : (
              <p className={`${inputClass} flex items-center`}>Employee</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="employee-organization" className="text-sm font-medium">
              Organization
            </label>
            <select
              id="employee-organization"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              disabled={loading || organizations.length === 0}
              className={inputClass}
              required
            >
              {organizations.length === 0 ? (
                <option value="">No organizations available</option>
              ) : (
                organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        </TabPanel>

        {organizationId ? (
          <>
            <TabPanel id="job" active={tab}>
              <EmploymentFields
                organizationId={organizationId}
                values={employment}
                onChange={setEmployment}
                disabled={loading}
                section="job"
              />
            </TabPanel>
            <TabPanel id="pay" active={tab}>
              <EmploymentFields
                organizationId={organizationId}
                values={employment}
                onChange={setEmployment}
                disabled={loading}
                section="pay"
              />
            </TabPanel>
            <TabPanel id="statutory" active={tab}>
              <StatutoryFields values={statutory} onChange={setStatutory} disabled={loading} />
            </TabPanel>
          </>
        ) : null}
        </TabLayout>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {created && (
          <p role="status" className="flex items-center gap-2 text-sm text-green-600">
            <Check className="size-4" />
            Employee created successfully.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/")}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            className="h-10"
            disabled={loading || organizations.length === 0}
          >
            {loading ? <Loader2 className="animate-spin" /> : <UserPlus />}
            Create employee
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateEmployee;
