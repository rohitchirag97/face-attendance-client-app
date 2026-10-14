import type { FormEvent } from "react";
import { ArrowLeft, Building2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import { useCreatePlatformOrganization } from "@/hooks/use-platform";

const inputClass = "h-11 w-full rounded-xl border border-white/10 !bg-slate-950 px-3 text-sm !text-white outline-none !shadow-none placeholder:!text-slate-600 focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/10";

const makeSlug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 52);

export default function PlatformOrganizationCreatePage() {
  const navigate = useNavigate();
  const create = useCreatePlatformOrganization();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const result = await create.mutateAsync({
        name: name.trim(),
        slug: slug.trim(),
        owner: { fname: fname.trim(), lname: lname.trim(), phone: phone.replace(/\D/g, ""), email: email.trim() || undefined },
      });
      navigate(`/platform/organizations/${result.organization.id}`, {
        state: { notice: result.existingOwner ? "An organization was created for the existing account. Their profile was preserved." : "Organization and owner account created." },
      });
    } catch {
      // The mutation error is rendered below.
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/platform/organizations" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft className="size-4" /> Back to organizations</Link>
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Manual onboarding</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Create organization</h1><p className="mt-2 text-sm leading-6 text-slate-400">Create the account and assign its first super admin. Existing accounts are reused by phone number.</p></div>

      <form onSubmit={(event) => void submit(event)} className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-3 border-b border-white/5 pb-5"><span className="grid size-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><Building2 className="size-5" /></span><div><h2 className="font-semibold text-white">Organization details</h2><p className="mt-1 text-xs text-slate-500">Account metadata only</p></div></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">Organization name<input required maxLength={52} value={name} onChange={(event) => { setName(event.target.value); if (!slugTouched) setSlug(makeSlug(event.target.value)); }} className={inputClass} placeholder="Northstar Services" /></label>
          <label className="space-y-2 text-sm text-slate-300 sm:col-span-2">Organization slug<input required maxLength={52} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(event) => { setSlug(event.target.value.toLowerCase()); setSlugTouched(true); }} className={`${inputClass} font-mono`} placeholder="northstar-services" /><span className="block text-xs text-slate-500">Lowercase letters, numbers, and hyphens.</span></label>
        </div>
        <div className="my-6 border-t border-white/5" />
        <div className="mb-4"><h2 className="font-semibold text-white">Owner account</h2><p className="mt-1 text-xs leading-5 text-slate-500">The owner signs in with the app’s phone OTP flow. If the phone already belongs to an account, its current profile details are left unchanged.</p></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">First name<input required maxLength={52} value={fname} onChange={(event) => setFname(event.target.value)} className={inputClass} autoComplete="given-name" /></label>
          <label className="space-y-2 text-sm text-slate-300">Last name<input required maxLength={52} value={lname} onChange={(event) => setLname(event.target.value)} className={inputClass} autoComplete="family-name" /></label>
          <label className="space-y-2 text-sm text-slate-300">Phone with country code<input required type="tel" inputMode="numeric" pattern="[0-9]{11,15}" maxLength={15} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 15))} className={inputClass} placeholder="919876543210" autoComplete="tel" /><span className="block text-xs text-slate-500">Use 11–15 digits including the country code.</span></label>
          <label className="space-y-2 text-sm text-slate-300">Email <span className="text-slate-500">(optional)</span><input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} autoComplete="email" /></label>
        </div>
        {create.isError && <p role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/5 px-4 py-3 text-sm text-rose-300">{create.error instanceof Error ? create.error.message : "Could not create the organization."}</p>}
        <div className="mt-7 flex flex-col-reverse justify-end gap-3 border-t border-white/5 pt-5 sm:flex-row"><Link to="/platform/organizations" className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 px-4 text-sm text-slate-300 hover:bg-white/5">Cancel</Link><button type="submit" disabled={create.isPending} className="h-10 rounded-lg bg-sky-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:opacity-50">{create.isPending ? "Creating…" : "Create organization"}</button></div>
      </form>
    </div>
  );
}
