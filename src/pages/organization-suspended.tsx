import { CircleAlert, LogOut, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router";

import { signOut } from "@/lib/api";
import { getOrganizations } from "@/lib/session";

export default function OrganizationSuspendedPage() {
  const navigate = useNavigate();
  const suspended = getOrganizations().filter((organization) =>
    organization.membershipActive && organization.status !== "active",
  );
  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background p-4">
      <section className="w-full max-w-lg rounded-2xl border bg-card p-7 text-center sm:p-9">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-600"><CircleAlert className="size-7" /></div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Organization access paused</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">This organization is suspended</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Members cannot use this organization while it is suspended. Contact HazriPro support for help restoring access.</p>
        {suspended.length > 0 && <div className="mt-5 space-y-2 text-left">{suspended.map((organization) => <div key={organization.id} className="rounded-xl border bg-background p-3"><p className="font-medium">{organization.name}</p><p className="mt-1 text-xs text-muted-foreground">{organization.status === "pending_deletion" ? "Scheduled for deletion" : "Suspended"}</p></div>)}</div>}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row"><button type="button" onClick={() => navigate("/")} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-muted"><ShieldCheck className="size-4" /> Check access</button><button type="button" onClick={() => void logout()} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/85"><LogOut className="size-4" /> Sign out</button></div>
      </section>
    </main>
  );
}
