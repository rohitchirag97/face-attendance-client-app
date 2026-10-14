import { useEffect, useState, type FormEvent } from "react";
import { CreditCard, FileText, MessageCircle } from "lucide-react";
import { Link } from "react-router";

import { usePlatformBillingMutation, usePlatformOrganizationBilling, usePlatformPlans } from "@/hooks/use-platform";
import type { PlatformBillingProfile, PlatformPlan } from "@/lib/platform";

const panel = "rounded-2xl border border-white/10 bg-slate-900/75 p-5";
const field = "w-full rounded-xl border border-white/10 !bg-slate-950 px-3 py-2.5 text-sm !text-white outline-none !shadow-none placeholder:!text-slate-600 focus:border-sky-400/50";
type ProfileDraft = {
  legalName: string;
  gstin: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  email: string;
  whatsappPhone: string;
};
const emptyProfile: ProfileDraft = { legalName: "", gstin: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "India", email: "", whatsappPhone: "" };
const profileDraft = (profile: PlatformBillingProfile | null | undefined): ProfileDraft => profile ? {
  legalName: profile.legalName,
  gstin: profile.gstin ?? "",
  addressLine1: profile.addressLine1,
  addressLine2: profile.addressLine2 ?? "",
  city: profile.city,
  state: profile.state,
  postalCode: profile.postalCode,
  country: profile.country,
  email: profile.email ?? "",
  whatsappPhone: profile.whatsappPhone ?? "",
} : emptyProfile;

export function OrganizationBillingPanel({ organizationId }: { organizationId: string }) {
  const billing = usePlatformOrganizationBilling(organizationId);
  const plans = usePlatformPlans();
  const [profile, setProfile] = useState<ProfileDraft>(emptyProfile);
  const [planId, setPlanId] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState<"active" | "trial" | "past_due" | "cancelled">("active");
  const [startsAt, setStartsAt] = useState("");
  const [nextBillingAt, setNextBillingAt] = useState("");
  const [notice, setNotice] = useState("");
  const saveProfile = usePlatformBillingMutation<ProfileDraft, PlatformBillingProfile>(`/organizations/${encodeURIComponent(organizationId)}/billing-profile`, "PUT");
  const saveSubscription = usePlatformBillingMutation<{ planId: string; status: string; startsAt?: string; nextBillingAt?: string }, unknown>(`/organizations/${encodeURIComponent(organizationId)}/subscription`, "PUT");

  useEffect(() => {
    if (!billing.data) return;
    setProfile(profileDraft(billing.data.profile));
    setPlanId(billing.data.subscription?.planId ?? "");
    setSubscriptionStatus(billing.data.subscription?.status ?? "active");
    setStartsAt(billing.data.subscription?.startsAt ?? "");
    setNextBillingAt(billing.data.subscription?.nextBillingAt ?? "");
  }, [billing.data]);

  const saveBillingProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    try { await saveProfile.mutateAsync(profile); setNotice("Billing profile saved."); }
    catch { /* Mutation errors are displayed in this panel. */ }
  };
  const savePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!planId) return;
    setNotice("");
    try {
      await saveSubscription.mutateAsync({ planId, status: subscriptionStatus, startsAt: startsAt || undefined, nextBillingAt: nextBillingAt || undefined });
      setNotice("Plan assignment saved.");
    } catch { /* Mutation errors are displayed in this panel. */ }
  };

  if (billing.isPending) return <section className={`${panel} text-sm text-slate-400`} role="status">Loading billing details…</section>;
  if (billing.isError || !billing.data) return <section className={panel}><p role="alert" className="text-sm text-rose-300">{billing.error instanceof Error ? billing.error.message : "Could not load billing details."}</p></section>;
  const activePlans = plans.data?.filter((plan: PlatformPlan) => plan.isActive) ?? [];

  return (
    <section className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><CreditCard className="size-4 text-sky-300" /><h2 className="font-semibold text-white">Billing setup</h2></div><p className="mt-1 text-xs text-slate-500">Set the commercial plan and the billing identity copied onto invoices.</p></div><Link to="/platform/invoices" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"><FileText className="size-3.5" /> Invoice register</Link></div>
      <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(280px,.7fr)_minmax(0,1.3fr)]">
        <form onSubmit={(event) => void savePlan(event)} className="space-y-3 rounded-xl border border-white/5 bg-slate-950/45 p-4">
          <div><h3 className="text-sm font-medium text-white">Plan assignment</h3><p className="mt-1 text-xs text-slate-500">Assignments are manual; recurring billing is not automated.</p></div>
          <label className="block space-y-2 text-xs font-medium text-slate-400">Plan<select required value={planId} onChange={(event) => setPlanId(event.target.value)} className={field}><option value="">Select a plan</option>{activePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · ₹{Number(plan.priceAmount).toLocaleString("en-IN")}/{plan.billingPeriod === "monthly" ? "mo" : "yr"}</option>)}</select></label>
          <label className="block space-y-2 text-xs font-medium text-slate-400">Status<select value={subscriptionStatus} onChange={(event) => setSubscriptionStatus(event.target.value as typeof subscriptionStatus)} className={field}><option value="active">Active</option><option value="trial">Trial</option><option value="past_due">Past due</option><option value="cancelled">Cancelled</option></select></label>
          <div className="grid grid-cols-2 gap-3"><label className="space-y-2 text-xs font-medium text-slate-400">Starts<input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className={field} /></label><label className="space-y-2 text-xs font-medium text-slate-400">Next billing<input type="date" value={nextBillingAt} onChange={(event) => setNextBillingAt(event.target.value)} className={field} /></label></div>
          {billing.data.subscription && <p className="text-xs text-slate-400">Current: <span className="font-medium text-slate-200">{billing.data.subscription.planName}</span> · {billing.data.subscription.status}</p>}
          {saveSubscription.isError && <p role="alert" className="text-xs text-rose-300">{saveSubscription.error instanceof Error ? saveSubscription.error.message : "Could not save plan."}</p>}
          <button type="submit" disabled={saveSubscription.isPending || plans.isPending || !activePlans.length || !planId} className="rounded-lg bg-sky-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-300 disabled:opacity-40">{saveSubscription.isPending ? "Saving…" : billing.data.subscription ? "Update assignment" : "Assign plan"}</button>
          {!activePlans.length && <p className="text-xs text-amber-200">Create and activate a plan first. <Link to="/platform/plans" className="underline">Open plans</Link></p>}
        </form>

        <form onSubmit={(event) => void saveBillingProfile(event)} className="space-y-3 rounded-xl border border-white/5 bg-slate-950/45 p-4">
          <div className="flex items-center gap-2"><MessageCircle className="size-4 text-emerald-300" /><div><h3 className="text-sm font-medium text-white">Customer billing profile</h3><p className="mt-1 text-xs text-slate-500">A country-code WhatsApp number is needed to deliver invoice PDFs.</p></div></div>
          <div className="grid gap-3 md:grid-cols-2"><label className="space-y-1.5 text-xs font-medium text-slate-400">Legal name<input required maxLength={160} value={profile.legalName} onChange={(event) => setProfile({ ...profile, legalName: event.target.value })} className={field} /></label><label className="space-y-1.5 text-xs font-medium text-slate-400">GSTIN<input maxLength={15} value={profile.gstin} onChange={(event) => setProfile({ ...profile, gstin: event.target.value.toUpperCase() })} className={field} placeholder="15 character GSTIN" /></label><label className="space-y-1.5 text-xs font-medium text-slate-400 md:col-span-2">Address line 1<input required maxLength={200} value={profile.addressLine1} onChange={(event) => setProfile({ ...profile, addressLine1: event.target.value })} className={field} /></label><label className="space-y-1.5 text-xs font-medium text-slate-400 md:col-span-2">Address line 2<input maxLength={200} value={profile.addressLine2} onChange={(event) => setProfile({ ...profile, addressLine2: event.target.value })} className={field} /></label><label className="space-y-1.5 text-xs font-medium text-slate-400">City<input required maxLength={100} value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} className={field} /></label><label className="space-y-1.5 text-xs font-medium text-slate-400">State<input required maxLength={100} value={profile.state} onChange={(event) => setProfile({ ...profile, state: event.target.value })} className={field} /></label><label className="space-y-1.5 text-xs font-medium text-slate-400">Postal code<input required maxLength={20} value={profile.postalCode} onChange={(event) => setProfile({ ...profile, postalCode: event.target.value })} className={field} /></label><label className="space-y-1.5 text-xs font-medium text-slate-400">Country<input required maxLength={100} value={profile.country} onChange={(event) => setProfile({ ...profile, country: event.target.value })} className={field} /></label><label className="space-y-1.5 text-xs font-medium text-slate-400">Billing email<input type="email" maxLength={254} value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} className={field} /></label><label className="space-y-1.5 text-xs font-medium text-slate-400">WhatsApp number<input inputMode="tel" maxLength={20} value={profile.whatsappPhone} onChange={(event) => setProfile({ ...profile, whatsappPhone: event.target.value })} className={field} placeholder="+919876543210" /></label></div>
          {saveProfile.isError && <p role="alert" className="text-xs text-rose-300">{saveProfile.error instanceof Error ? saveProfile.error.message : "Could not save billing profile."}</p>}
          <button type="submit" disabled={saveProfile.isPending} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50">{saveProfile.isPending ? "Saving…" : "Save billing profile"}</button>
        </form>
      </div>
      {notice && <p role="status" className="mt-4 text-sm text-emerald-300">{notice}</p>}
      <p className="mt-4 text-xs leading-5 text-slate-500">The invoice seller details come from server configuration: PLATFORM_BILLING_NAME, PLATFORM_BILLING_ADDRESS, PLATFORM_BILLING_GSTIN, and PLATFORM_BILLING_EMAIL.</p>
    </section>
  );
}
