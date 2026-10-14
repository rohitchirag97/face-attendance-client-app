import type { ElementType } from "react";
import { Activity, Building2, CalendarDays, CircleAlert, FileText, Users } from "lucide-react";
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { StatusBadge } from "@/components/platform/status-badge";
import { Button } from "@/components/ui/button";
import { usePlatformOverview } from "@/hooks/use-platform";
import { formatPlatformDate } from "@/lib/platform";

const card = "rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-[0_18px_45px_-28px_rgba(0,0,0,.65)]";

const StatCard = ({ label, value, detail, icon: Icon, accent }: { label: string; value: number | string; detail: string; icon: ElementType; accent: string }) => (
  <div className={`${card} relative overflow-hidden`}>
    <div className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p></div>
      <div className="grid size-10 place-items-center rounded-xl bg-white/5 text-slate-300"><Icon className="size-5" /></div>
    </div>
    <p className="mt-3 text-xs text-slate-500">{detail}</p>
  </div>
);

export default function PlatformOverviewPage() {
  const query = usePlatformOverview();
  const { data, isPending, isError, error, refetch } = query;
  const metrics = data?.metrics;
  const stats = [
    { label: "Customer organizations", value: metrics?.totalOrganizations ?? "—", detail: "All customer accounts", icon: Building2, accent: "bg-sky-400" },
    { label: "Active", value: metrics?.activeOrganizations ?? "—", detail: "Ready for customer use", icon: Activity, accent: "bg-emerald-400" },
    { label: "Suspended", value: metrics?.suspendedOrganizations ?? "—", detail: "Support follow-up needed", icon: CircleAlert, accent: "bg-amber-400" },
    { label: "New this month", value: metrics?.newThisMonth ?? "—", detail: "Known creation dates only", icon: CalendarDays, accent: "bg-violet-400" },
    { label: "Active employees", value: metrics?.employees ?? "—", detail: "Aggregate count across accounts", icon: Users, accent: "bg-cyan-400" },
    { label: "Organizations with recent sign-in", value: metrics?.organizationsWithSignIn30Days ?? "—", detail: "At least one sign-in in 30 days", icon: Activity, accent: "bg-indigo-400" },
  ];

  if (isPending) return <div role="status" className={`${card} p-10 text-center text-slate-300`}>Loading platform overview…</div>;
  if (isError || !data) return <div className={`${card} p-10 text-center`}><p role="alert" className="text-sm text-rose-300">{error instanceof Error ? error.message : "Could not load platform overview."}</p><Button variant="outline" className="mt-4" onClick={() => void refetch()}>Try again</Button></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Platform pulse</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Customer overview</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">A live snapshot of customer accounts and aggregate usage, with billing operations managed in the platform console. Employee and operational records are not loaded here.</p></div>
        <Button render={<Link to="/platform/organizations/new" />} className="h-9 gap-2"><span className="text-base leading-none">+</span> Onboard organization</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.85fr)]">
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-white">Organization signups</h2><p className="mt-1 text-xs text-slate-500">Monthly customer onboarding</p></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">Last 6 months</span></div>
          <div className="mt-5 h-[270px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.signupsByMonth} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip cursor={{ fill: "rgba(56,189,248,.08)" }} contentStyle={{ background: "#0f172a", border: "1px solid rgba(148,163,184,.2)", borderRadius: 12, color: "#e2e8f0" }} />
                <Bar dataKey="organizations" name="Organizations" fill="#38bdf8" radius={[7, 7, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 border-t border-white/5 pt-3 text-xs leading-5 text-slate-500">Historical creation dates were not stored before platform reporting began ({formatPlatformDate(data.reportingStartedAt)}). Older accounts are excluded from this chart.</p>
        </section>

        <section className={card}>
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Billing operations</h2><p className="mt-1 text-xs text-slate-500">Manual plans and invoices</p></div><FileText className="size-5 text-sky-300" /></div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-slate-950/50 p-3"><span className="block text-slate-400">Active plans assigned</span><span className="mt-1 block text-lg font-semibold text-white">{data.billing.activeSubscriptions}</span></div><div className="rounded-xl bg-slate-950/50 p-3"><span className="block text-slate-400">Open invoices</span><span className="mt-1 block text-lg font-semibold text-white">{data.billing.openInvoices}</span></div><div className="col-span-2 rounded-xl bg-slate-950/50 p-3"><span className="block text-slate-400">Outstanding</span><span className="mt-1 block text-lg font-semibold text-white">INR {Number(data.billing.outstandingAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div></div>
          <div className="mt-4 flex gap-2"><Link to="/platform/plans" className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-center text-xs font-medium text-slate-300 hover:bg-white/5">Manage plans</Link><Link to="/platform/invoices" className="flex-1 rounded-lg bg-sky-400 px-3 py-2 text-center text-xs font-semibold text-slate-950 hover:bg-sky-300">Open invoices</Link></div>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">Billing and payment collection are manual. Recurring charges and online payments are not enabled.</p>
        </section>
      </div>

      <section className={`${card} overflow-hidden p-0`}>
        <div className="flex items-center justify-between gap-3 px-5 py-4"><div><h2 className="font-semibold text-white">Recently added organizations</h2><p className="mt-1 text-xs text-slate-500">Account metadata and roll-up usage</p></div><Link to="/platform/organizations" className="text-sm font-medium text-sky-300 hover:text-sky-200">View all →</Link></div>
        {data.recentOrganizations.length === 0 ? <p className="border-t border-white/5 px-5 py-12 text-center text-sm text-slate-500">No organizations have been onboarded yet.</p> : (
          <div className="overflow-x-auto border-t border-white/5">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-medium">Organization</th><th className="px-5 py-3 font-medium">Owner</th><th className="px-5 py-3 font-medium">Employees</th><th className="px-5 py-3 font-medium">Last sign-in</th><th className="px-5 py-3 font-medium">Status</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {data.recentOrganizations.map((organization) => <tr key={organization.id} className="transition hover:bg-white/[0.025]"><td className="px-5 py-3.5"><Link to={`/platform/organizations/${organization.id}`} className="font-medium text-white hover:text-sky-200">{organization.name}</Link><span className="mt-1 block text-xs text-slate-500">{organization.slug}</span></td><td className="px-5 py-3.5"><span className="text-slate-200">{organization.owner?.name ?? "No owner assigned"}</span><span className="mt-1 block text-xs text-slate-500">{organization.owner?.phone ?? "—"}</span></td><td className="px-5 py-3.5 text-slate-300">{organization.usage.activeEmployees.toLocaleString()}</td><td className="px-5 py-3.5 text-slate-400">{formatPlatformDate(organization.usage.lastSignInAt)}</td><td className="px-5 py-3.5"><StatusBadge status={organization.status} /></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
