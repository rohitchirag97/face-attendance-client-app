import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { ArrowLeft, Loader2, Save, UserRoundMinus, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmploymentSection from "@/components/employment-section";
import EmployeeProfileForm from "@/components/employee-profile-form";
import { EmployeeStatutoryForm } from "@/components/statutory-fields";
import EmployeeDocuments from "@/components/employee-documents";
import EmployeeLifecycle from "@/components/employee-lifecycle";
import { getUser } from "@/lib/session";
import { TabLayout, TabPanel } from "@/components/tabs";

const EDIT_TABS = [
  { id: "account", label: "Account" },
  { id: "job", label: "Job" },
  { id: "pay", label: "Pay & salary" },
  { id: "personal", label: "Personal & bank" },
  { id: "statutory", label: "Statutory" },
  { id: "documents", label: "Documents" },
  { id: "lifecycle", label: "Onboarding & exit" },
  { id: "access", label: "Access" },
];
import {
  employeesQuery,
  useRemoveEmployee,
  useSetEmployeeActive,
  useUpdateEmployee,
  type Employee,
} from "@/hooks/use-api";
import {
  getActiveOrganizationId,
  getOrganizations,
  hasManagerRole,
} from "@/lib/session";

const inputClass =
  "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

const EmployeeEditor: React.FC<{
  employee: Employee;
  organizationId: string;
}> = ({ employee, organizationId }) => {
  const navigate = useNavigate();
  const [fname, setFname] = useState(employee.fname);
  const [lname, setLname] = useState(employee.lname);
  const [role, setRole] = useState<"admin" | "hr" | "employee">(
    employee.role === "admin" ? "admin" : employee.role === "hr" ? "hr" : "employee",
  );
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState("account");
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [reason, setReason] = useState("");
  const update = useUpdateEmployee();
  const setActive = useSetEmployeeActive();
  const removeEmployee = useRemoveEmployee();
  const canAssignElevatedRole = hasManagerRole(organizationId);
  const loading =
    update.isPending || setActive.isPending || removeEmployee.isPending;

  const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    if (!fname.trim() || !lname.trim()) {
      setError("First name and last name are required.");
      return;
    }

    update.mutate(
      {
        employeeId: employee.id,
        organizationId,
        fname: fname.trim(),
        lname: lname.trim(),
        role,
      },
      {
        onSuccess: () => setSaved(true),
        onError: (requestError) => setError(requestError.message),
      },
    );
  };

  const handleSetActive = () => {
    setActionError(null);
    setActive.mutate(
      {
        employeeId: employee.id,
        organizationId,
        isActive: !employee.isActive,
        reason: employee.isActive ? reason.trim() : undefined,
      },
      {
        onSuccess: () => navigate("/employees"),
        onError: (requestError) => setActionError(requestError.message),
      },
    );
  };

  const handleRemove = () => {
    setActionError(null);
    removeEmployee.mutate(
      { employeeId: employee.id, organizationId },
      {
        onSuccess: () => navigate("/employees"),
        onError: (requestError) => setActionError(requestError.message),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <Button
          variant="ghost"
          className="mb-3"
          onClick={() => navigate("/employees")}
        >
          <ArrowLeft />
          Back to employees
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Update employee</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update this employee’s account name and role in this organization.
        </p>
      </div>

      <TabLayout tabs={EDIT_TABS} active={tab} onChange={setTab}>

      <TabPanel id="account" active={tab}>
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border bg-background p-5 shadow-sm sm:p-6"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="employee-fname" className="text-sm font-medium">
              First name
            </label>
            <input
              id="employee-fname"
              autoComplete="given-name"
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

        <div className="space-y-1.5">
          <label htmlFor="employee-phone" className="text-sm font-medium">
            Phone number
          </label>
          <input
            id="employee-phone"
            value={`+${employee.phone}`}
            disabled
            className={inputClass}
          />
          <p className="text-xs text-muted-foreground">
            Phone number is the sign-in identifier and can’t be changed here.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="employee-role" className="text-sm font-medium">
            Role in this organization
          </label>
          {canAssignElevatedRole ? (
            <select
              id="employee-role"
              value={role}
              onChange={(event) =>
                setRole(event.target.value as "admin" | "hr" | "employee")
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
          <p className="text-xs text-muted-foreground">
            {canAssignElevatedRole
              ? "Only an admin can grant or remove organization roles."
              : "HR can manage employee records but cannot change organization roles."}
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-green-600">
            Employee updated successfully.
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/employees")}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" className="h-10" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <Save />}
            Save changes
          </Button>
        </div>
      </form>
      </TabPanel>

      <TabPanel id="job" active={tab}>
        <EmploymentSection organizationId={organizationId} employeeId={employee.id} section="job" />
      </TabPanel>
      <TabPanel id="pay" active={tab}>
        <EmploymentSection organizationId={organizationId} employeeId={employee.id} section="pay" />
      </TabPanel>

      <TabPanel id="personal" active={tab}>
        <EmployeeProfileForm organizationId={organizationId} employeeId={employee.id} />
      </TabPanel>
      <TabPanel id="statutory" active={tab}>
        <EmployeeStatutoryForm organizationId={organizationId} employeeId={employee.id} />
      </TabPanel>
      <TabPanel id="documents" active={tab}>
        <EmployeeDocuments
          organizationId={organizationId}
          employeeId={employee.id}
          isManager
          currentUserId={getUser()?.id ?? ""}
        />
      </TabPanel>
      <TabPanel id="lifecycle" active={tab}>
        <EmployeeLifecycle
          organizationId={organizationId}
          employeeId={employee.id}
          isSelf={employee.id === getUser()?.id}
        />
      </TabPanel>

      <TabPanel id="access" active={tab}>
      <section className="space-y-4 rounded-xl border p-5 sm:p-6">
        <div>
          <h2 className="font-semibold">Organization access</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage this employee’s membership in the current organization.
            Their account and membership in other organizations are unaffected.
          </p>
        </div>

        {actionError && (
          <p role="alert" className="text-sm text-destructive">
            {actionError}
          </p>
        )}

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              {employee.isActive ? "Active membership" : "Deactivated membership"}
            </p>
            <p className="text-xs text-muted-foreground">
              {employee.isActive
                ? "Deactivating prevents access through this organization."
                : "Reactivate to restore access through this organization."}
            </p>
          </div>
          {employee.isActive && confirmDeactivate ? null : (
            <Button
              type="button"
              variant="outline"
              onClick={employee.isActive ? () => setConfirmDeactivate(true) : handleSetActive}
              disabled={loading}
            >
              {setActive.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <UserRoundMinus />
              )}
              {employee.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          )}
        </div>

        {employee.isActive && confirmDeactivate && (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
            <label htmlFor="deactivation-reason" className="text-sm font-medium">
              Reason for deactivation <span className="text-destructive">*</span>
            </label>
            <textarea
              id="deactivation-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Resigned, absconded, contract ended"
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">
              This is saved on the employee’s record and in the audit log with your name.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setConfirmDeactivate(false);
                  setReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={loading || reason.trim().length < 3}
                onClick={handleSetActive}
              >
                {setActive.isPending && <Loader2 className="animate-spin" />}
                Confirm deactivation
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Remove from organization</p>
            <p className="text-xs text-muted-foreground">
              Removes this membership only. The user account and other
              organizations are retained.
            </p>
          </div>
          {confirmRemoval ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmRemoval(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemove}
                disabled={loading}
              >
                {removeEmployee.isPending && (
                  <Loader2 className="animate-spin" />
                )}
                Confirm removal
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmRemoval(true)}
              disabled={loading}
            >
              <UserRoundX />
              Remove from organization
            </Button>
          )}
        </div>
      </section>
      </TabPanel>
      </TabLayout>
    </div>
  );
};

const UpdateEmployee: React.FC = () => {
  const { employeeId } = useParams();
  const organizationId =
    getActiveOrganizationId() ?? getOrganizations()[0]?.id ?? "";
  const {
    data: employees = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    ...employeesQuery(organizationId),
    enabled: Boolean(organizationId),
  });

  if (isPending) {
    return (
      <div role="status" className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        Loading employee...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <p role="alert" className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load employee."}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const employee = employees.find((item) => item.id === employeeId);
  if (!employee || !organizationId) {
    return (
      <div className="rounded-lg border p-8 text-center">
        <h1 className="font-semibold">Employee not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This employee is not active in the selected organization.
        </p>
        <Button className="mt-4" render={<Link to="/employees" />}>
          <ArrowLeft />
          Back to employees
        </Button>
      </div>
    );
  }

  if (!hasManagerRole(organizationId) && employee.role !== "employee") {
    return <Navigate to="/403" replace />;
  }

  return (
    <EmployeeEditor
      key={`${organizationId}:${employee.id}`}
      employee={employee}
      organizationId={organizationId}
    />
  );
};

export default UpdateEmployee;
