import { Building2, ChevronLeft, ChevronRight, Search, UserPlus } from "lucide-react";
import { Link } from "react-router";
import { useState } from "react";

import { StatusBadge } from "@/components/platform/status-badge";
import { usePlatformOrganizations } from "@/hooks/use-platform";
import { formatPlatformDate } from "@/lib/platform";

const panel = "rounded-2xl border border-white/10 bg-slate-900/75";

export default function PlatformOrganizationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const query = usePlatformOrganizations({ search, status, page });
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / (query.data?.pageSize ?? 20)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Customer accounts</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Organizations</h1><p className="mt-2 text-sm text-slate-400">Search and manage customer account metadata.</p></div>
        <Link to="/platform/organizations/new" className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-sky-400 px-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"><UserPlus className="size-4" /> Onboard organization</Link>
      </div>

      <section className={`${panel} p-4`}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3 text-slate-400 focus-within:border-sky-400/50"><Search className="size-4 shrink-0" /><input aria-label="Search organizations" placeholder="Search organization name or slug" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="platform-search-input h-full min-w-0 flex-1 !border-0 !bg-transparent !p-0 text-sm !text-white outline-none placeholder:!text-slate-500 !shadow-none" /></label>
          <select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-white/10 !bg-slate-950 px-3 text-sm !text-slate-200 outline-none focus:border-sky-400/50">
            <option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="pending_deletion">Pending deletion</option>
          </select>
        </div>
      </section>

      <section className={`${panel} overflow-hidden`}>
        {query.isPending ? <div role="status" className="p-12 text-center text-sm text-slate-400">Loading organizations…</div> : query.isError ? <div className="p-12 text-center"><p role="alert" className="text-sm text-rose-300">{query.error instanceof Error ? query.error.message : "Could not load organizations."}</p><button type="button" onClick={() => void query.refetch()} className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">Try again</button></div> : query.data?.items.length === 0 ? (
          <div className="p-12 text-center"><Building2 className="mx-auto size-8 text-slate-500" /><h2 className="mt-3 font-medium text-white">No matching organizations</h2><p className="mt-1 text-sm text-slate-500">Change the search or status filter to see more accounts.</p></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-white/5 bg-slate-950/50 text-[11px] uppercase tracking-[0.13em] text-slate-500"><tr><th className="px-5 py-3.5 font-medium">Organization</th><th className="px-5 py-3.5 font-medium">Owner</th><th className="px-5 py-3.5 font-medium">Employees</th><th className="px-5 py-3.5 font-medium">Last sign-in</th><th className="px-5 py-3.5 font-medium">Created</th><th className="px-5 py-3.5 font-medium">Status</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {query.data?.items.map((organization) => <tr key={organization.id} className="transition hover:bg-white/[0.025]">
                    <td className="px-5 py-4"><Link to={`/platform/organizations/${organization.id}`} className="font-medium text-white hover:text-sky-200">{organization.name}</Link><span className="mt-1 block text-xs text-slate-500">{organization.slug}</span></td>
                    <td className="px-5 py-4"><span className="text-slate-200">{organization.owner?.name ?? "No owner assigned"}</span><span className="mt-1 block text-xs text-slate-500">{organization.owner?.phone ?? "—"}</span></td>
                    <td className="px-5 py-4"><span className="text-slate-200">{organization.usage.activeEmployees.toLocaleString()}</span><span className="mt-1 block text-xs text-slate-500">of {organization.usage.totalEmployees.toLocaleString()} total</span></td>
                    <td className="px-5 py-4 text-slate-400">{formatPlatformDate(organization.usage.lastSignInAt)}</td>
                    <td className="px-5 py-4 text-slate-400">{formatPlatformDate(organization.createdAt)}</td>
                    <td className="px-5 py-4"><StatusBadge status={organization.status} /></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-4 text-sm">
              <p className="text-xs text-slate-500">{query.data?.total ?? 0} organizations <span className="mx-1.5 text-slate-700">·</span> Page {page} of {totalPages}</p>
              <div className="flex items-center gap-2"><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid size-8 place-items-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="size-4" /></button><button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="grid size-8 place-items-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="size-4" /></button></div>
            </div>
          </>
        )}
      </section>
      <p className="text-xs leading-5 text-slate-500">Usage values are aggregate membership counts. Customer attendance, payroll, profile, and document records are not queried here.</p>
    </div>
  );
}
