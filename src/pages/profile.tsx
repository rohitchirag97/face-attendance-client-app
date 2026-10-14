import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdateProfile } from "@/hooks/use-api";
import { displayPhone, getActiveOrganizationId, getOrganizations, getUser } from "@/lib/session";
import SignInMethods from "@/components/sign-in-methods";
import { TabLayout } from "@/components/tabs";
import EmployeeProfileForm from "@/components/employee-profile-form";
import EmployeeDocuments from "@/components/employee-documents";
import ExitNotice from "@/components/exit-notice";
import EmploymentSection from "@/components/employment-section";
import { EmployeeStatutoryForm } from "@/components/statutory-fields";
import {
  employmentQuery,
  useSetPayrollInclusion,
} from "@/hooks/use-payroll-api";

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-3 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="font-medium">{value}</dd>
  </div>
);

const inputClass =
  "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

const PROFILE_TABS = [
  { id: "account", label: "Account" },
  { id: "personal", label: "Personal & bank" },
  { id: "documents", label: "Documents" },
];

const Profile: React.FC = () => {
  const [tab, setTab] = useState("account");
  const [user, setUserState] = useState(getUser);
  const orgs = getOrganizations();
  const active = orgs.find((o) => o.id === getActiveOrganizationId());
  const isSuperAdmin = active?.role === "super_admin";
  const employmentState = useQuery({
    ...employmentQuery(active?.id ?? "", user?.id ?? ""),
    enabled: Boolean(isSuperAdmin && active && user),
  });
  const payrollInclusion = useSetPayrollInclusion(active?.id ?? "", user?.id ?? "");
  const isPayrollEmployee = employmentState.data?.includeInPayroll ?? false;
  const tabs = active
    ? [
        ...PROFILE_TABS,
        ...(isSuperAdmin && isPayrollEmployee
          ? [
              { id: "job", label: "Job details" },
              { id: "pay", label: "Pay & salary" },
              { id: "statutory", label: "Statutory" },
            ]
          : []),
      ]
    : PROFILE_TABS.slice(0, 1);

  const [editing, setEditing] = useState(false);
  const [fname, setFname] = useState(user?.fname ?? "");
  const [lname, setLname] = useState(user?.lname ?? "");
  const update = useUpdateProfile();
  const loading = update.isPending;
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!user) {
    return <p className="text-sm text-muted-foreground">No profile data. Please log in again.</p>;
  }

  const startEdit = () => {
    setFname(user.fname);
    setLname(user.lname);
    setError(null);
    setSaved(false);
    setEditing(true);
  };

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!fname.trim() || !lname.trim()) {
      setError("First name and last name are required.");
      return;
    }
    update.mutate(
      { fname: fname.trim(), lname: lname.trim() },
      {
        onSuccess: () => {
          setUserState(getUser());
          setEditing(false);
          setSaved(true);
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-muted text-lg font-semibold">
          {`${user.fname.charAt(0)}${user.lname.charAt(0)}`.toUpperCase()}
        </span>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {user.fname} {user.lname}
          </h1>
          <p className="text-sm text-muted-foreground">{displayPhone(user) ?? user.email ?? ""}</p>
        </div>
        {!editing && (
          <Button variant="outline" onClick={startEdit}>
            <Pencil /> Edit
          </Button>
        )}
      </div>

      {active && (
        <ExitNotice organizationId={active.id} employeeId={user.id} />
      )}

      <TabLayout tabs={tabs} active={tab} onChange={setTab}>
      {active && tab === "personal" && (
        <EmployeeProfileForm organizationId={active.id} employeeId={user.id} />
      )}
      {active && tab === "documents" && (
        <EmployeeDocuments
          organizationId={active.id}
          employeeId={user.id}
          isManager={false}
          currentUserId={user.id}
        />
      )}

      {tab === "account" && saved && (
        <p role="status" className="text-sm text-green-600">
          Profile updated.
        </p>
      )}

      {active && isSuperAdmin && tab === "account" && (
        <section className="rounded-lg border p-4">
          <label htmlFor="include-in-payroll" className="flex cursor-pointer items-start gap-3">
            <input
              id="include-in-payroll"
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={isPayrollEmployee}
              disabled={employmentState.isLoading || !employmentState.data || payrollInclusion.isPending}
              onChange={(event) => payrollInclusion.mutate(event.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">Include me as an employee</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                When enabled, you appear in this organization’s employee list and can be included in future payroll runs.
                Your job and pay details will become available here.
              </span>
            </span>
          </label>
          {employmentState.isLoading && (
            <p className="mt-3 text-sm text-muted-foreground">Loading employee settings…</p>
          )}
          {employmentState.error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {employmentState.error.message}
            </p>
          )}
          {payrollInclusion.error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {payrollInclusion.error.message}
            </p>
          )}
        </section>
      )}

      {active && isSuperAdmin && isPayrollEmployee && tab === "job" && (
        <EmploymentSection organizationId={active.id} employeeId={user.id} section="job" />
      )}
      {active && isSuperAdmin && isPayrollEmployee && tab === "pay" && (
        <EmploymentSection organizationId={active.id} employeeId={user.id} section="pay" />
      )}
      {active && isSuperAdmin && isPayrollEmployee && tab === "statutory" && (
        <EmployeeStatutoryForm organizationId={active.id} employeeId={user.id} />
      )}

      {tab !== "account" ? null : editing ? (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="fname" className="text-sm font-medium">First name</label>
              <input id="fname" value={fname} autoFocus disabled={loading}
                onChange={(e) => setFname(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lname" className="text-sm font-medium">Last name</label>
              <input id="lname" value={lname} disabled={loading}
                onChange={(e) => setLname(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-medium">Phone</label>
            <input id="phone" value={displayPhone(user) ?? "Not linked"} disabled className={inputClass} />
            <p className="text-xs text-muted-foreground">Link or change your phone under Sign-in methods.</p>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="h-9" disabled={loading}>
              {loading && <Loader2 className="animate-spin" />} Save changes
            </Button>
            <Button type="button" variant="ghost" className="h-9" disabled={loading}
              onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="divide-y rounded-lg border px-4">
          <Row label="First name" value={user.fname} />
          <Row label="Last name" value={user.lname} />
          <Row label="Phone" value={displayPhone(user) ?? "Not linked"} />
          <Row label="Current organization" value={active?.name ?? "-"} />
          <Row label="Organizations" value={orgs.map((o) => o.name).join(", ") || "-"} />
        </dl>
      )}

      {tab === "account" && !editing && (
        <SignInMethods user={user} onUpdated={() => setUserState(getUser())} />
      )}
      </TabLayout>
    </div>
  );
};

export default Profile;

