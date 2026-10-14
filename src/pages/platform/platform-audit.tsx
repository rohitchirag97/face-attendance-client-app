import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { usePlatformAudit } from "@/hooks/use-platform";
import { formatPlatformDate } from "@/lib/platform";

const panel = "rounded-2xl border border-white/10 bg-slate-900/75";
const titleFor = (action: string) => action.split(".").map((part) => part.replaceAll("_", " ")).join(" / ");

export default function PlatformAuditPage() {
  const [page, setPage] = useState(1);
  const query = usePlatformAudit(page);
  const pageSize = query.data?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / pageSize));

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Accountability</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Platform audit log</h1><p className="mt-2 text-sm leading-6 text-slate-400">Append-only history of platform reads and actions, with recorded before and after values where applicable.</p></div>
      <section className={`${panel} overflow-hidden`}>
        {query.isPending ? <div role="status" className="p-12 text-center text-sm text-slate-400">Loading platform history…</div> : query.isError ? <div className="p-10 text-center"><p role="alert" className="text-sm text-rose-300">{query.error instanceof Error ? query.error.message : "Could not load platform audit log."}</p><button type="button" onClick={() => void query.refetch()} className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">Try again</button></div> : query.data?.items.length === 0 ? <div className="p-12 text-center"><ShieldCheck className="mx-auto size-8 text-slate-500" /><h2 className="mt-3 font-medium text-white">No platform events yet</h2></div> : (
          <>
            <div className="divide-y divide-white/5">
              {query.data?.items.map((entry) => <article key={entry.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_170px]">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md border border-sky-300/15 bg-sky-300/5 px-2 py-1 text-xs font-medium capitalize text-sky-200">{titleFor(entry.action)}</span>{entry.targetOrganizationName && <span className="text-xs text-slate-300">{entry.targetOrganizationName}</span>}</div><p className="mt-2 text-sm text-slate-200">{entry.actorName} <span className="text-slate-500">({entry.actorUserId.slice(0, 8)})</span></p>{entry.reason && <p className="mt-2 text-sm leading-5 text-slate-400">Reason: {entry.reason}</p>}
                  {(entry.beforeValues || entry.afterValues) && <details className="mt-3"><summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300">View recorded values</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{entry.beforeValues && <div className="rounded-lg bg-slate-950/70 p-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Before</p><pre className="overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-slate-400">{JSON.stringify(entry.beforeValues, null, 2)}</pre></div>}{entry.afterValues && <div className="rounded-lg bg-slate-950/70 p-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">After</p><pre className="overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-slate-400">{JSON.stringify(entry.afterValues, null, 2)}</pre></div>}</div></details>}
                </div>
                <div className="text-xs text-slate-500 md:text-right"><time>{formatPlatformDate(entry.createdAt)}</time><span className="mt-1 block font-mono">{entry.ipAddress ?? "IP unavailable"}</span></div>
              </article>)}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/5 px-5 py-4"><p className="text-xs text-slate-500">{query.data?.total ?? 0} events · Page {page} of {totalPages}</p><div className="flex gap-2"><button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid size-8 place-items-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-30"><ChevronLeft className="size-4" /></button><button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="grid size-8 place-items-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 disabled:opacity-30"><ChevronRight className="size-4" /></button></div></div>
          </>
        )}
      </section>
      <p className="text-xs leading-5 text-slate-500">Sensitive overview, list, and detail reads are recorded here. The log is protected against update, delete, and truncate in PostgreSQL.</p>
    </div>
  );
}
