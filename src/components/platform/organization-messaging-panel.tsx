import { MessageCircle } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useCreditWallet, usePlatformOrgMessaging, useSetOrgMessaging, type Rates } from "@/hooks/use-platform-messaging";
import { formatPlatformDate } from "@/lib/platform";

const panel = "rounded-2xl border border-white/10 bg-slate-900/75 p-5";
const field = "w-full rounded-xl border border-white/10 !bg-slate-950 px-3 py-2.5 text-sm !text-white outline-none !shadow-none placeholder:!text-slate-600 focus:border-sky-400/50";
const primary = "rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-40";
const secondary = "rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-40";
const rupees = (value: number | string) => `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;

const RATE_LABELS: Record<keyof Rates, string> = { email: "Email", whatsappVetanly: "WhatsApp via Vetanly", whatsappCustom: "WhatsApp via own provider" };

/** The organization's delivery add-on: switch it on, add balance, override rates. */
export function OrganizationMessagingPanel({ organizationId }: { organizationId: string }) {
  const messaging = usePlatformOrgMessaging(organizationId);
  const setMessaging = useSetOrgMessaging(organizationId);
  const credit = useCreditWallet();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [overrides, setOverrides] = useState<Partial<Record<keyof Rates, string>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (messaging.isPending) return <section className={panel}><p className="text-sm text-slate-400">Loading messaging…</p></section>;
  if (!messaging.data) return <section className={panel}><p className="text-sm text-rose-300">{messaging.error?.message ?? "Could not load messaging."}</p></section>;
  const data = messaging.data;
  const values = overrides ?? Object.fromEntries(Object.entries(data.rateOverrides).map(([k, v]) => [k, String(v)]));
  const sent = data.usageLast30Days.filter((u) => u.status !== "failed").reduce((sum, u) => sum + u.n, 0);
  const failed = data.usageLast30Days.filter((u) => u.status === "failed").reduce((sum, u) => sum + u.n, 0);

  const addBalance = (event: FormEvent, topUpRequestId?: string, requested?: string) => {
    event.preventDefault();
    setError(null);
    const value = Number(requested ?? amount);
    if (!value) return setError("Enter an amount (negative to remove balance).");
    credit.mutate(
      { organizationId, amount: value, reference: reference || undefined, topUpRequestId },
      { onSuccess: () => { setAmount(""); setReference(""); }, onError: (e) => setError(e.message) },
    );
  };

  const saveOverrides = () => {
    setError(null);
    const rateOverrides: Partial<Rates> = {};
    for (const key of Object.keys(RATE_LABELS) as (keyof Rates)[]) {
      const raw = values[key];
      if (raw !== undefined && raw !== "") rateOverrides[key] = Number(raw);
    }
    setMessaging.mutate({ rateOverrides }, { onSuccess: () => setOverrides(null), onError: (e) => setError(e.message) });
  };

  return (
    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MessageCircle className="size-4 text-sky-300" />
          <div>
            <h2 className="font-semibold text-white">Email & WhatsApp delivery</h2>
            <p className="mt-1 text-xs text-slate-500">
              {data.addonEnabled ? "Add-on on" : data.addonRequestedAt ? `Requested ${formatPlatformDate(data.addonRequestedAt)}` : "Add-on off"}
              {data.provider ? ` · WhatsApp: ${data.provider.name}` : " · WhatsApp not set up"}
              {` · last 30 days: ${sent} sent, ${failed} failed`}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={setMessaging.isPending}
          onClick={() => setMessaging.mutate({ addonEnabled: !data.addonEnabled }, { onError: (e) => setError(e.message) })}
          className={data.addonEnabled ? secondary : primary}
        >
          {data.addonEnabled ? "Turn add-on off" : "Turn add-on on"}
        </button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-slate-950/45 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Balance</p>
          <p className="mt-1 text-2xl font-semibold text-white">{rupees(data.balance)}</p>
          <p className="text-xs text-slate-500">Warns the owner below {rupees(data.lowBalanceThreshold)}</p>
          {data.topUps.filter((t) => t.status === "pending").map((t) => (
            <form key={t.id} onSubmit={(e) => addBalance(e, t.id, t.amount)} className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-200">
              <span>Requested {rupees(t.amount)} · {formatPlatformDate(t.createdAt)}</span>
              <button type="submit" disabled={credit.isPending} className={primary}>Mark paid & credit</button>
            </form>
          ))}
        </div>
        <form onSubmit={(e) => addBalance(e)} className="space-y-3 rounded-xl border border-white/5 bg-slate-950/45 p-4">
          <p className="text-sm font-medium text-white">Add or adjust balance</p>
          <label className="block space-y-1.5 text-xs font-medium text-slate-400">Amount (₹; negative removes)<input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={field} /></label>
          <label className="block space-y-1.5 text-xs font-medium text-slate-400">Payment reference<input maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} className={field} placeholder="UTR / invoice no." /></label>
          <button type="submit" disabled={credit.isPending} className={primary}>{credit.isPending ? "Saving…" : "Apply"}</button>
        </form>
        <div className="space-y-3 rounded-xl border border-white/5 bg-slate-950/45 p-4">
          <p className="text-sm font-medium text-white">Rates for this organization</p>
          {(Object.keys(RATE_LABELS) as (keyof Rates)[]).map((key) => (
            <label key={key} className="block space-y-1.5 text-xs font-medium text-slate-400">
              {RATE_LABELS[key]} (₹ per message)
              <input
                type="number"
                min={0}
                step="0.001"
                value={values[key] ?? ""}
                placeholder={`Platform rate ${data.platformRates[key]}`}
                onChange={(e) => setOverrides({ ...values, [key]: e.target.value })}
                className={field}
              />
            </label>
          ))}
          <button type="button" disabled={setMessaging.isPending} onClick={saveOverrides} className={secondary}>Save rates</button>
          <p className="text-xs text-slate-500">Leave empty to follow the platform rate.</p>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      {data.transactions.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs text-slate-300">
            <tbody className="divide-y divide-white/5">
              {data.transactions.slice(0, 10).map((t) => (
                <tr key={t.id}>
                  <td className="py-1.5 pr-3 text-slate-500">{formatPlatformDate(t.createdAt)}</td>
                  <td className="py-1.5 pr-3">{t.note ?? t.kind.replace("_", " ")}{t.reference ? ` · ${t.reference}` : ""}</td>
                  <td className="py-1.5 pr-3 text-right">{rupees(t.amount)}</td>
                  <td className="py-1.5 text-right text-slate-500">{rupees(t.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
