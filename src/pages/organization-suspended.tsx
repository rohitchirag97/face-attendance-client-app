import { CircleAlert, LogOut, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import OrganizationDangerZone from "@/components/organization-danger-zone";
import { signOut } from "@/lib/api";
import { getOrganizations, hasSelectableOrganization, type Organization } from "@/lib/session";

const describe = (organization: Organization) => {
  if (organization.status === "suspended") return "Suspended by HazriPro. Contact support to restore access.";
  if (organization.status === "pending_deletion") return "Scheduled for permanent deletion.";
  return "Paused by the owner.";
};

/** Where members land when none of their organizations is usable, and where owners undo a pause or deletion. */
export default function OrganizationSuspendedPage() {
  const navigate = useNavigate();
  const [organizations, setOrganizationsState] = useState(getOrganizations);
  const unavailable = organizations.filter(
    (organization) =>
      organization.membershipActive && (!organization.isActive || organization.status !== "active"),
  );
  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };
  const afterChange = () => {
    setOrganizationsState(getOrganizations());
    if (hasSelectableOrganization()) navigate("/", { replace: true });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <section className="w-full max-w-xl rounded-2xl border bg-card p-7 sm:p-9">
        <div className="text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-600"><CircleAlert className="size-7" /></div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Organization access paused</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">This organization is not available</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Members cannot use an organization while it is paused, suspended or scheduled for deletion.</p>
        </div>
        {unavailable.length > 0 && (
          <div className="mt-6 space-y-3">
            {unavailable.map((organization) => {
              const ownerCanRestore =
                organization.role === "super_admin" && organization.status !== "suspended" && organization.status !== "deleted";
              return (
                <div key={organization.id} className="space-y-3 rounded-xl border bg-background p-4">
                  <div>
                    <p className="font-medium">{organization.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{describe(organization)}</p>
                  </div>
                  {ownerCanRestore && <OrganizationDangerZone organization={organization} onChanged={afterChange} />}
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row"><button type="button" onClick={() => navigate("/")} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted"><ShieldCheck className="size-4" /> Check access</button><button type="button" onClick={() => void logout()} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/85"><LogOut className="size-4" /> Sign out</button></div>
      </section>
    </main>
  );
}
