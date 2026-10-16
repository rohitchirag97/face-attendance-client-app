import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { useCancelTopUp, useCreditWallet, usePlatformMessaging, useSavePlatformRates, type Rates } from "@/hooks/use-platform-messaging";
import { formatPlatformDate } from "@/lib/platform";

const panel = "rounded-2xl border border-white/10 bg-slate-900/75 p-5";
const field = "w-full rounded-xl border border-white/10 !bg-slate-950 px-3 py-2.5 text-sm !text-white outline-none !shadow-none placeholder:!text-slate-600 focus:border-sky-400/50";
const primary = "rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-40";
const secondary = "rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-200 hover:bg-white/5 disabled:opacity-40";
const rupees = (value: number | string) => `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;

/** Platform-wide messaging: per-message rates, top-ups waiting for payment, add-on requests. */
export function PlatformMessagingPage() {
  const overview = usePlatformMessaging();
  const saveRates = useSavePlatformRates();
  const credit = useCreditWallet();
  const cancel = useCancelTopUp();
  const [rates, setRates] = useState<Record<keyof Rates, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (overview.isPending) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!overview.data) return <p className="text-sm text-rose-300">{overview.error?.message ?? "Could not load messaging."}</p>;
  const data = overview.data;
  const values = rates ?? { email: String(data.rates.email), whatsappVetanly: String(data.rates.whatsappVetanly), whatsappCustom: String(data.rates.whatsappCustom) };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageCircle className="size-5 text-sky-300" />
        <div>
          <h1 className="text-2xl font-semibold text-white">Messaging</h1>
          <p className="text-sm text-slate-400">
            The email & WhatsApp delivery add-on. Vetanly WhatsApp service: {data.vetanlyConfigured ? "connected" : "not connected (messages are simulated and not charged)"}.
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-rose-300">{error}</p>}

      <section className={panel}>
        <h2 className="font-semibold text-white">Per-message rates</h2>
        <p className="mt-1 text-xs text-slate-500">Charged from each organization's prepaid balance. An organization can be given its own rates on its page.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {([
            ["email", "Email"],
            ["whatsappVetanly", "WhatsApp via Vetanly"],
            ["whatsappCustom", "WhatsApp via own provider"],
          ] as [keyof Rates, string][]).map(([key, label]) => (
            <label key={key} className="space-y-1.5 text-xs font-medium text-slate-400">
              {label} (₹)
              <input type="number" min={0} step="0.001" value={values[key]} onChange={(e) => setRates({ ...values, [key]: e.target.value })} className={field} />
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={saveRates.isPending || !rates}
          onClick={() => saveRates.mutate({ email: Number(values.email), whatsappVetanly: Number(values.whatsappVetanly), whatsappCustom: Number(values.whatsappCustom) }, { onSuccess: () => setRates(null), onError: (e) => setError(e.message) })}
          className={`${primary} mt-4`}
        >
          {saveRates.isPending ? "Saving…" : "Save rates"}
        </button>
      </section>

      <section className={panel}>
        <h2 className="font-semibold text-white">Top-ups waiting for payment</h2>
        {data.pendingTopUps.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">None.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {data.pendingTopUps.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <Link to={`/platform/organizations/${t.organizationId}`} className="font-medium text-sky-200 hover:underline">{t.organizationName}</Link>
                  <p className="text-xs text-slate-500">{rupees(t.amount)} · requested {formatPlatformDate(t.createdAt)}{t.note ? ` · ${t.note}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={credit.isPending} className={primary}
                    onClick={() => { const ref = window.prompt("Payment reference (UTR, invoice number)") ?? undefined; credit.mutate({ organizationId: t.organizationId, amount: Number(t.amount), reference: ref || undefined, topUpRequestId: t.id }, { onError: (e) => setError(e.message) }); }}>
                    Mark paid & credit
                  </button>
                  <button type="button" disabled={cancel.isPending} className={secondary} onClick={() => cancel.mutate({ id: t.id }, { onError: (e) => setError(e.message) })}>Cancel</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panel}>
        <h2 className="font-semibold text-white">Add-on requests</h2>
        {data.addonRequests.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">None.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5 text-sm">
            {data.addonRequests.map((r) => (
              <li key={r.organizationId} className="flex items-center justify-between py-2">
                <Link to={`/platform/organizations/${r.organizationId}`} className="text-sky-200 hover:underline">{r.name}</Link>
                <span className="text-xs text-slate-500">Requested {formatPlatformDate(r.requestedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
