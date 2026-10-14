import { useState, type FormEvent } from "react";
import { BadgeCheck, CirclePlus, Pencil, Sparkles } from "lucide-react";

import { usePlatformBillingMutation, usePlatformPlans } from "@/hooks/use-platform";
import type { PlatformPlan } from "@/lib/platform";

const panel = "rounded-2xl border border-white/10 bg-slate-900/75 p-5";
const field = "w-full rounded-xl border border-white/10 !bg-slate-950 px-3 py-2.5 text-sm !text-white outline-none !shadow-none placeholder:!text-slate-600 focus:border-sky-400/50";
const features = ["Attendance", "Payroll", "Reports", "Statutory", "Overtime", "Employee documents"];
type PlanDraft = {
  name: string;
  description: string;
  priceAmount: string;
  billingPeriod: "monthly" | "annual";
  includedEmployees: string;
  overagePrice: string;
  features: string[];
  isActive: boolean;
};
const emptyDraft: PlanDraft = { name: "", description: "", priceAmount: "", billingPeriod: "monthly", includedEmployees: "10", overagePrice: "0", features: [], isActive: true };
const fromPlan = (plan: PlatformPlan): PlanDraft => ({
  name: plan.name,
  description: plan.description ?? "",
  priceAmount: plan.priceAmount,
  billingPeriod: plan.billingPeriod,
  includedEmployees: String(plan.includedEmployees),
  overagePrice: plan.overagePrice,
  features: plan.features,
  isActive: plan.isActive,
});

export default function PlatformPlansPage() {
  const plans = usePlatformPlans();
  const createPlan = usePlatformBillingMutation<PlanDraft, PlatformPlan>("/plans", "POST");
  const updatePlan = usePlatformBillingMutation<PlanDraft & { planId: string }, PlatformPlan>((body) => `/plans/${body.planId}`, "PATCH");
  const [draft, setDraft] = useState<PlanDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const mutationError = createPlan.error ?? updatePlan.error;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    const payload: PlanDraft = { ...draft, name: draft.name.trim(), priceAmount: draft.priceAmount, includedEmployees: draft.includedEmployees, overagePrice: draft.overagePrice };
    try {
      if (editingId) await updatePlan.mutateAsync({ ...payload, planId: editingId });
      else await createPlan.mutateAsync(payload);
      setNotice(editingId ? "Plan updated." : "Plan created.");
      setDraft(emptyDraft);
      setEditingId(null);
    } catch { /* The mutation error is shown beside the form. */ }
  };

  const edit = (plan: PlatformPlan) => {
    setDraft(fromPlan(plan));
    setEditingId(plan.id);
    setNotice("");
    document.getElementById("plan-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleFeature = (feature: string) => setDraft((current) => ({
    ...current,
    features: current.features.includes(feature) ? current.features.filter((item) => item !== feature) : [...current.features, feature],
  }));

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Commercial setup</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Plans</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Create the plans you offer and assign them to customer accounts. Employee limits are catalog metadata; enforcement is not enabled in this phase.</p></div>

      <section id="plan-editor" className={panel}>
        <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-sky-400/10 text-sky-300">{editingId ? <Pencil className="size-4" /> : <CirclePlus className="size-4" />}</span><div><h2 className="font-semibold text-white">{editingId ? "Edit plan" : "Create a plan"}</h2><p className="mt-1 text-xs text-slate-500">Pricing is stored in INR. Annual price is the full annual amount.</p></div></div>
        <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-xs font-medium text-slate-400">Plan name<input required maxLength={100} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className={field} placeholder="Growth" /></label>
            <label className="space-y-2 text-xs font-medium text-slate-400">Price (INR)<input required type="number" min="0" step="0.01" value={draft.priceAmount} onChange={(event) => setDraft({ ...draft, priceAmount: event.target.value })} className={field} placeholder="999" /></label>
            <label className="space-y-2 text-xs font-medium text-slate-400">Billing period<select value={draft.billingPeriod} onChange={(event) => setDraft({ ...draft, billingPeriod: event.target.value as PlanDraft["billingPeriod"] })} className={field}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>
            <label className="space-y-2 text-xs font-medium text-slate-400">Included employees<input required type="number" min="0" step="1" value={draft.includedEmployees} onChange={(event) => setDraft({ ...draft, includedEmployees: event.target.value })} className={field} /></label>
            <label className="space-y-2 text-xs font-medium text-slate-400">Overage price per employee<input required type="number" min="0" step="0.01" value={draft.overagePrice} onChange={(event) => setDraft({ ...draft, overagePrice: event.target.value })} className={field} /></label>
            <label className="space-y-2 text-xs font-medium text-slate-400 md:col-span-2 xl:col-span-3">Description<input maxLength={500} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className={field} placeholder="A short summary shown to platform admins" /></label>
          </div>
          <fieldset><legend className="text-xs font-medium text-slate-400">Included features</legend><div className="mt-2 flex flex-wrap gap-2">{features.map((feature) => <label key={feature} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${draft.features.includes(feature) ? "border-sky-300/30 bg-sky-400/10 text-sky-200" : "border-white/10 bg-slate-950/50 text-slate-400 hover:border-white/20"}`}><input type="checkbox" checked={draft.features.includes(feature)} onChange={() => toggleFeature(feature)} className="accent-cyan-400" />{feature}</label>)}</div></fieldset>
          <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="accent-cyan-400" />Available for new assignments</label>
          {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
          {mutationError && <p role="alert" className="text-sm text-rose-300">{mutationError instanceof Error ? mutationError.message : "Could not save the plan."}</p>}
          <div className="flex flex-wrap gap-2"><button type="submit" disabled={createPlan.isPending || updatePlan.isPending} className="rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-50">{createPlan.isPending || updatePlan.isPending ? "Saving…" : editingId ? "Save changes" : "Create plan"}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft); }} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5">Cancel edit</button>}</div>
        </form>
      </section>

      <section className={`${panel} overflow-hidden p-0`}>
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4"><div><h2 className="font-semibold text-white">Plan catalog</h2><p className="mt-1 text-xs text-slate-500">{plans.data?.length ?? 0} plans</p></div><Sparkles className="size-5 text-sky-300" /></div>
        {plans.isPending ? <p role="status" className="p-8 text-center text-sm text-slate-400">Loading plans…</p> : plans.isError ? <p role="alert" className="p-8 text-center text-sm text-rose-300">{plans.error instanceof Error ? plans.error.message : "Could not load plans."}</p> : !plans.data?.length ? <div className="p-10 text-center"><BadgeCheck className="mx-auto size-8 text-slate-600" /><p className="mt-3 text-sm text-slate-400">No plans yet. Create your first plan above.</p></div> : (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">{plans.data.map((plan) => <article key={plan.id} className="rounded-xl border border-white/10 bg-slate-950/55 p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-semibold text-white">{plan.name}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${plan.isActive ? "bg-emerald-400/10 text-emerald-300" : "bg-slate-700 text-slate-400"}`}>{plan.isActive ? "Active" : "Archived"}</span></div><p className="mt-1 text-xs text-slate-500">{plan.description || "No description"}</p></div><button type="button" onClick={() => edit(plan)} aria-label={`Edit ${plan.name}`} className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 text-slate-300 hover:bg-white/5"><Pencil className="size-4" /></button></div><div className="mt-5 flex items-baseline gap-1"><span className="text-2xl font-semibold text-white">₹{Number(plan.priceAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span><span className="text-xs text-slate-500">/{plan.billingPeriod === "monthly" ? "month" : "year"}</span></div><p className="mt-3 text-xs text-slate-400">{plan.includedEmployees} included employees · ₹{Number(plan.overagePrice).toLocaleString("en-IN")}/extra employee</p><div className="mt-4 flex flex-wrap gap-1.5">{plan.features.length ? plan.features.map((feature) => <span key={feature} className="rounded-md bg-slate-800 px-2 py-1 text-[10px] text-slate-300">{feature}</span>) : <span className="text-xs text-slate-600">No features selected</span>}</div></article>)}</div>
        )}
      </section>
    </div>
  );
}
