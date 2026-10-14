import type { ElementType, FormEvent } from "react";
import { ArrowLeft, Building2, CircleAlert, Clock3, FileText, MessageSquareText, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import { StatusBadge } from "@/components/platform/status-badge";
import { OrganizationBillingPanel } from "@/components/platform/organization-billing-panel";
import { useAddPlatformNote, usePlatformOrganization, useReactivatePlatformOrganization, useSuspendPlatformOrganization } from "@/hooks/use-platform";
import { formatPlatformDate } from "@/lib/platform";

const panel = "rounded-2xl border border-white/10 bg-slate-900/75 p-5";
const inputClass = "w-full rounded-xl border border-white/10 !bg-slate-950 px-3 py-2.5 text-sm !text-white outline-none !shadow-none placeholder:!text-slate-600 focus:border-sky-400/50";

const UsageStat = ({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: ElementType }) => (
  <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">{label}</p><Icon className="size-4 text-slate-500" /></div><p className="mt-3 text-2xl font-semibold text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></div>
);

export default function PlatformOrganizationDetailPage() {
  const { organizationId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const query = usePlatformOrganization(organizationId);
  const suspend = useSuspendPlatformOrganization(organizationId);
  const reactivate = useReactivatePlatformOrganization(organizationId);
  const addNote = useAddPlatformNote(organizationId);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const notice = (location.state as { notice?: string } | null)?.notice;

  const suspendOrg = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!window.confirm(`Suspend access for ${query.data?.name}? Members will be blocked from customer app features.`)) return;
    try { await suspend.mutateAsync(reason.trim()); setReason(""); } catch { /* Error shown below the form. */ }
  };
  const reactivateOrg = async () => {
    if (!window.confirm(`Reactivate ${query.data?.name}?`)) return;
    try { await reactivate.mutateAsync(); } catch { /* Error shown below the controls. */ }
  };
  const saveNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try { await addNote.mutateAsync(note.trim()); setNote(""); } catch { /* Error shown below the form. */ }
  };

  if (query.isPending) return <div role="status" className={`${panel} p-12 text-center text-sm text-slate-400`}>Loading organization…</div>;
  if (query.isError || !query.data) return <div className={`${panel} p-10 text-center`}><p role="alert" className="text-sm text-rose-300">{query.error instanceof Error ? query.error.message : "Organization not found."}</p><div className="mt-4 flex justify-center gap-2"><button type="button" onClick={() => void query.refetch()} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">Try again</button><button type="button" onClick={() => navigate("/platform/organizations")} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">Back to list</button></div></div>;
  const organization = query.data;

  return (
    <div className="space-y-6">
      <Link to="/platform/organizations" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft className="size-4" /> Organizations</Link>
      {notice && <div role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-sky-300/20 bg-sky-400/10 text-sky-300"><Building2 className="size-6" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">Organization account</p><div className="mt-1 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight text-white">{organization.name}</h1><StatusBadge status={organization.status} /></div><p className="mt-2 font-mono text-sm text-slate-500">{organization.slug}</p></div></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void query.refetch()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/5"><RefreshCw className="size-4" /> Refresh</button>
          {organization.status === "suspended" ? <button type="button" disabled={reactivate.isPending} onClick={() => void reactivateOrg()} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50"><ShieldCheck className="size-4" /> {reactivate.isPending ? "Reactivating…" : "Reactivate"}</button> : <a href="#suspend-organization" className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 text-sm font-medium text-amber-200 hover:bg-amber-300/10"><CircleAlert className="size-4" /> Suspend</a>}
        </div>
      </div>
      {(suspend.isError || reactivate.isError) && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">{(suspend.error ?? reactivate.error) instanceof Error ? (suspend.error ?? reactivate.error)?.message : "Could not update organization status."}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UsageStat label="Active employees" value={organization.usage.activeEmployees.toLocaleString()} hint={`${organization.usage.totalEmployees.toLocaleString()} total memberships`} icon={Users} />
        <UsageStat label="Active admins" value={organization.usage.activeAdmins.toLocaleString()} hint={`${organization.usage.totalAdmins.toLocaleString()} total admin memberships`} icon={ShieldCheck} />
        <UsageStat label="Members signed in · 30d" value={organization.usage.loginsLast30Days.toLocaleString()} hint="Based on current session records" icon={Clock3} />
        <UsageStat label="Last sign-in" value={organization.usage.lastSignInAt ? formatPlatformDate(organization.usage.lastSignInAt) : "—"} hint="Customer activity details are not exposed" icon={Clock3} />
      </div>

      <OrganizationBillingPanel organizationId={organization.id} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]">
        <section className={panel}>
          <div className="flex items-center gap-3"><Building2 className="size-4 text-sky-300" /><h2 className="font-semibold text-white">Account metadata</h2></div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs text-slate-500">Created</dt><dd className="mt-1 text-sm text-slate-200">{formatPlatformDate(organization.createdAt)}</dd></div>
            <div><dt className="text-xs text-slate-500">Plan</dt><dd className="mt-1 text-sm text-slate-400">Manage in billing setup below</dd></div>
            <div><dt className="text-xs text-slate-500">Organization ID</dt><dd className="mt-1 break-all font-mono text-xs text-slate-400">{organization.id}</dd></div>
            {organization.status === "suspended" && <div><dt className="text-xs text-slate-500">Suspended</dt><dd className="mt-1 text-sm text-slate-200">{formatPlatformDate(organization.suspendedAt)}</dd></div>}
          </dl>
          {organization.status === "suspended" && <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/5 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Suspension reason</p><p className="mt-2 text-sm leading-6 text-slate-300">{organization.suspendedReason || "No reason recorded."}</p></div>}
          <div className="mt-6 border-t border-white/5 pt-5"><h3 className="text-sm font-medium text-white">Organization owner</h3>{organization.owner ? <div className="mt-3 rounded-xl bg-slate-950/50 p-4"><p className="font-medium text-slate-100">{organization.owner.name}</p><p className="mt-1 text-sm text-slate-400">{organization.owner.phone}</p><p className="mt-1 text-sm text-slate-500">{organization.owner.email || "No email saved"}</p></div> : <p className="mt-3 rounded-xl bg-slate-950/50 p-4 text-sm text-slate-500">No super admin membership found.</p>}</div>
        </section>

        <section id="suspend-organization" className={panel}>
          <div className="flex items-center gap-3"><CircleAlert className="size-4 text-amber-300" /><h2 className="font-semibold text-white">Account controls</h2></div>
          {organization.status === "active" ? <form onSubmit={(event) => void suspendOrg(event)} className="mt-4 space-y-3"><p className="text-sm leading-6 text-slate-400">Suspension blocks members and kiosks from using this organization. They can still sign in to another active organization.</p><label className="block space-y-2 text-xs font-medium text-slate-400">Reason<textarea required minLength={3} maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className={`${inputClass} resize-y`} placeholder="Explain why access is being suspended" /></label><button type="submit" disabled={suspend.isPending || reason.trim().length < 3} className="h-9 rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 text-sm font-medium text-amber-100 hover:bg-amber-300/15 disabled:opacity-50">{suspend.isPending ? "Suspending…" : "Suspend organization"}</button></form> : organization.status === "suspended" ? <div className="mt-4 space-y-3"><p className="text-sm leading-6 text-slate-400">Customer routes are blocked while this organization is suspended. Reactivation restores access for active members.</p><button type="button" disabled={reactivate.isPending} onClick={() => void reactivateOrg()} className="h-9 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50">{reactivate.isPending ? "Reactivating…" : "Reactivate organization"}</button></div> : <p className="mt-4 text-sm text-slate-400">This account has a pending deletion state.</p>}
        </section>
      </div>

      <section className={panel}>
        <div className="flex items-center gap-3"><MessageSquareText className="size-4 text-sky-300" /><div><h2 className="font-semibold text-white">Internal notes</h2><p className="mt-1 text-xs text-slate-500">Visible only to platform admins.</p></div></div>
        <form onSubmit={(event) => void saveNote(event)} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"><label className="flex-1 space-y-2 text-xs font-medium text-slate-400">Add a note<textarea required maxLength={2000} rows={2} value={note} onChange={(event) => setNote(event.target.value)} className={`${inputClass} resize-y`} placeholder="Record an onboarding or support detail" /></label><button type="submit" disabled={addNote.isPending || !note.trim()} className="h-10 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-50">{addNote.isPending ? "Saving…" : "Add note"}</button></form>
        {addNote.isError && <p role="alert" className="mt-3 text-sm text-rose-300">{addNote.error instanceof Error ? addNote.error.message : "Could not save note."}</p>}
        <div className="mt-5 space-y-3">{organization.notes.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">No internal notes yet.</p> : organization.notes.map((item) => <article key={item.id} className="rounded-xl bg-slate-950/50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-slate-200">{item.authorName}</p><time className="text-xs text-slate-500">{formatPlatformDate(item.createdAt)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">{item.text}</p></article>)}</div>
      </section>
      <p className="flex items-start gap-2 text-xs leading-5 text-slate-500"><FileText className="mt-0.5 size-4 shrink-0" /> This page exposes account metadata, platform billing details, internal notes, and aggregate counts. It does not load employee records, attendance, payroll, salary, bank, document, loan, leave, notification, announcement, or customer audit data.</p>
    </div>
  );
}
