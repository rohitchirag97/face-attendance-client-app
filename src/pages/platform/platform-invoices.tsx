import { useState, type FormEvent } from "react";
import { FileDown, MessageCircle, Plus, ReceiptText, Search, Send, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router";

import { usePlatformBillingMutation, usePlatformInvoices, usePlatformOrganizationBilling, usePlatformOrganizations } from "@/hooks/use-platform";
import type { PlatformBillingProfile, PlatformInvoice, PlatformInvoiceDetail } from "@/lib/platform";
import { apiDownload } from "@/lib/api";
import { formatPlatformDate } from "@/lib/platform";

const panel = "rounded-2xl border border-white/10 bg-slate-900/75 p-5";
const field = "w-full rounded-xl border border-white/10 !bg-slate-950 px-3 py-2.5 text-sm !text-white outline-none !shadow-none placeholder:!text-slate-600 focus:border-sky-400/50";
const money = (value: string, currency = "INR") => `${currency} ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusTone: Record<PlatformInvoice["status"], string> = {
  open: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  paid: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
  void: "border-slate-500/20 bg-slate-500/10 text-slate-400",
};

type LineItem = { description: string; quantity: string; unitPrice: string };
const emptyItem = (): LineItem => ({ description: "", quantity: "1", unitPrice: "" });
type BillingProfileDraft = {
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
const emptyBillingProfile: BillingProfileDraft = { legalName: "", gstin: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "India", email: "", whatsappPhone: "" };
const billingProfileDraft = (profile: PlatformBillingProfile): BillingProfileDraft => ({
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
});

export default function PlatformInvoicesPage() {
  const navigate = useNavigate();
  const organizations = usePlatformOrganizations({ search: "", status: "", page: 1, pageSize: 50 });
  const [organizationId, setOrganizationId] = useState("");
  const profile = usePlatformOrganizationBilling(organizationId);
  const [profileDraft, setProfileDraft] = useState<BillingProfileDraft>(emptyBillingProfile);
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [taxRate, setTaxRate] = useState("18");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [paying, setPaying] = useState<PlatformInvoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const query = usePlatformInvoices({ search, status, page });
  const createInvoice = usePlatformBillingMutation<{ organizationId: string; taxRate: number; dueDate?: string; notes?: string; items: Array<{ description: string; quantity: number; unitPrice: number }> }, PlatformInvoiceDetail>("/invoices", "POST");
  const saveBillingProfile = usePlatformBillingMutation<BillingProfileDraft & { organizationId: string }, PlatformBillingProfile>((body) => `/organizations/${encodeURIComponent(body.organizationId)}/billing-profile`, "PUT");
  const markPaid = usePlatformBillingMutation<{ invoiceId: string; paymentMethod: string; paymentReference?: string }, PlatformInvoiceDetail>((body) => `/invoices/${body.invoiceId}/paid`, "POST");
  const voidInvoice = usePlatformBillingMutation<{ invoiceId: string; reason: string }, PlatformInvoiceDetail>((body) => `/invoices/${body.invoiceId}/void`, "POST");
  const sendWhatsApp = usePlatformBillingMutation<{ invoiceId: string }, { status: string }>((body) => `/invoices/${body.invoiceId}/send-whatsapp`, "POST");
  const selectedProfile = profile.data?.profile;

  // Reset the draft when the organization or its saved profile changes (during render, not in an effect).
  const [draftFor, setDraftFor] = useState<{ organizationId: string; profile: typeof selectedProfile }>({ organizationId, profile: undefined });
  if (draftFor.organizationId !== organizationId || draftFor.profile !== selectedProfile) {
    setDraftFor({ organizationId, profile: selectedProfile });
    setProfileDraft(selectedProfile ? billingProfileDraft(selectedProfile) : emptyBillingProfile);
  }

  const updateItem = (index: number, fieldName: keyof LineItem, value: string) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [fieldName]: value } : item));
  };
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    try {
      const created = await createInvoice.mutateAsync({
        organizationId,
        taxRate: Number(taxRate),
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        items: items.map((item) => ({ description: item.description.trim(), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })),
      });
      setNotice(`Invoice ${created.invoiceNumber} generated.`);
      setItems([emptyItem()]);
      setNotes("");
      setDueDate("");
      setPage(1);
      setSearch("");
      setStatus("");
    } catch { /* Mutation error is displayed with the form. */ }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!organizationId) return;
    setNotice("");
    try {
      const saved = await saveBillingProfile.mutateAsync({ ...profileDraft, organizationId });
      setNotice(`Billing profile saved for ${saved.legalName}. You can now generate the invoice.`);
    } catch { /* Mutation error is displayed beside the profile form. */ }
  };

  const pay = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!paying) return;
    try {
      await markPaid.mutateAsync({ invoiceId: paying.id, paymentMethod, paymentReference });
      setNotice(`${paying.invoiceNumber} marked as paid.`);
      setPaying(null);
      setPaymentReference("");
    } catch { /* Mutation error is shown below the payment form. */ }
  };

  const createSubtotal = items.reduce((sum, item) => sum + Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) * 100), 0) / 100;
  const createTax = Math.round(createSubtotal * (Number(taxRate) || 0)) / 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Billing operations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Invoices</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Generate sequential INR invoices with GST, download the PDF, record offline payments, and send the PDF over WhatsApp.</p></div><Link to="/platform/plans" className="inline-flex h-9 items-center gap-2 self-start rounded-lg border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/5"><ReceiptText className="size-4" /> Plan catalog</Link></div>

      {notice && <div role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">{notice}</div>}
      <section className={panel}>
        <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><Plus className="size-4" /></span><div><h2 className="font-semibold text-white">Generate one-off invoice</h2><p className="mt-1 text-xs text-slate-500">Invoice numbers are assigned in a single sequence. The billing profile is copied onto the invoice.</p></div></div>
        <p className="mt-4 rounded-lg border border-sky-300/10 bg-sky-300/5 px-3 py-2 text-xs leading-5 text-sky-100/80">Seller name, address, GSTIN, and email on the PDF come from server billing configuration. Review those values before sharing an invoice.</p>
        <form onSubmit={(event) => void create(event)} className="mt-5 space-y-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <label className="space-y-2 text-xs font-medium text-slate-400">Customer organization<select required value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className={field}><option value="">Select an organization</option>{organizations.data?.items.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
            <label className="space-y-2 text-xs font-medium text-slate-400">GST rate (%)<input required type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} className={field} /></label>
            <label className="space-y-2 text-xs font-medium text-slate-400">Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={field} /></label>
          </div>

          {organizationId && <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm ${selectedProfile ? "border-emerald-300/15 bg-emerald-300/5 text-emerald-200" : profile.isError ? "border-rose-300/20 bg-rose-300/5 text-rose-200" : "border-amber-300/20 bg-amber-300/5 text-amber-100"}`}>
            {selectedProfile ? <ShieldCheck className="size-4" /> : <ReceiptText className="size-4" />}
            <span>{profile.isPending ? "Checking billing profile…" : profile.isError ? (profile.error instanceof Error ? profile.error.message : "Could not load billing profile.") : selectedProfile ? `Billing profile ready · ${selectedProfile.legalName}` : "Add the customer billing details below to unlock invoice generation."}</span>
          </div>}

          {organizationId && !profile.isPending && !profile.isError && !selectedProfile && <form onSubmit={(event) => void saveProfile(event)} className="space-y-3 rounded-xl border border-amber-300/15 bg-slate-950/40 p-4">
            <div><h3 className="text-sm font-medium text-white">Customer billing details</h3><p className="mt-1 text-xs text-slate-500">These details are saved to the organization and copied onto its invoices. Add a country-code WhatsApp number to send PDFs.</p></div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1.5 text-xs font-medium text-slate-400">Legal name<input required maxLength={160} value={profileDraft.legalName} onChange={(event) => setProfileDraft({ ...profileDraft, legalName: event.target.value })} className={field} /></label>
              <label className="space-y-1.5 text-xs font-medium text-slate-400">GSTIN<input maxLength={15} value={profileDraft.gstin} onChange={(event) => setProfileDraft({ ...profileDraft, gstin: event.target.value.toUpperCase() })} className={field} placeholder="15 character GSTIN" /></label>
              <label className="space-y-1.5 text-xs font-medium text-slate-400 md:col-span-2">Address line 1<input required maxLength={200} value={profileDraft.addressLine1} onChange={(event) => setProfileDraft({ ...profileDraft, addressLine1: event.target.value })} className={field} /></label>
              <label className="space-y-1.5 text-xs font-medium text-slate-400 md:col-span-2">Address line 2<input maxLength={200} value={profileDraft.addressLine2} onChange={(event) => setProfileDraft({ ...profileDraft, addressLine2: event.target.value })} className={field} /></label>
              <label className="space-y-1.5 text-xs font-medium text-slate-400">City<input required maxLength={100} value={profileDraft.city} onChange={(event) => setProfileDraft({ ...profileDraft, city: event.target.value })} className={field} /></label>
              <label className="space-y-1.5 text-xs font-medium text-slate-400">State<input required maxLength={100} value={profileDraft.state} onChange={(event) => setProfileDraft({ ...profileDraft, state: event.target.value })} className={field} /></label>
              <label className="space-y-1.5 text-xs font-medium text-slate-400">Postal code<input required maxLength={20} value={profileDraft.postalCode} onChange={(event) => setProfileDraft({ ...profileDraft, postalCode: event.target.value })} className={field} /></label>
              <label className="space-y-1.5 text-xs font-medium text-slate-400">Country<input required maxLength={100} value={profileDraft.country} onChange={(event) => setProfileDraft({ ...profileDraft, country: event.target.value })} className={field} /></label>
              <label className="space-y-1.5 text-xs font-medium text-slate-400">Billing email<input type="email" maxLength={254} value={profileDraft.email} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })} className={field} /></label>
              <label className="space-y-1.5 text-xs font-medium text-slate-400">WhatsApp number<input inputMode="tel" maxLength={20} value={profileDraft.whatsappPhone} onChange={(event) => setProfileDraft({ ...profileDraft, whatsappPhone: event.target.value })} className={field} placeholder="+919876543210" /></label>
            </div>
            {saveBillingProfile.isError && <p role="alert" className="text-sm text-rose-300">{saveBillingProfile.error instanceof Error ? saveBillingProfile.error.message : "Could not save billing profile."}</p>}
            <button type="submit" disabled={saveBillingProfile.isPending} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50">{saveBillingProfile.isPending ? "Saving billing details…" : "Save billing details"}</button>
          </form>}

          <div className="space-y-3">
            {items.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border border-white/5 bg-slate-950/40 p-3 md:grid-cols-[minmax(0,1fr)_130px_170px_auto]">
              <label className="space-y-1.5 text-[11px] font-medium text-slate-500">Description<input required maxLength={240} value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} className={field} placeholder="Platform subscription" /></label>
              <label className="space-y-1.5 text-[11px] font-medium text-slate-500">Quantity<input required type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} className={field} /></label>
              <label className="space-y-1.5 text-[11px] font-medium text-slate-500">Rate (INR)<input required type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} className={field} placeholder="0.00" /></label>
              <button type="button" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="self-end rounded-lg border border-white/10 px-3 py-2.5 text-xs text-slate-400 hover:bg-white/5 disabled:opacity-30">Remove</button>
            </div>)}
            <button type="button" disabled={items.length >= 30} onClick={() => setItems((current) => [...current, emptyItem()])} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-white/5">+ Add line item</button>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,.6fr)]">
            <label className="space-y-2 text-xs font-medium text-slate-400">Notes<textarea rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} className={`${field} resize-y`} placeholder="Optional payment or service notes" /></label>
            <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4 text-sm"><div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{money(createSubtotal.toFixed(2))}</span></div><div className="mt-2 flex justify-between text-slate-400"><span>GST ({taxRate || 0}%)</span><span>{money(createTax.toFixed(2))}</span></div><div className="mt-3 flex justify-between border-t border-white/10 pt-3 font-semibold text-white"><span>Total</span><span>{money((createSubtotal + createTax).toFixed(2))}</span></div></div>
          </div>
          {createInvoice.isError && <p role="alert" className="text-sm text-rose-300">{createInvoice.error instanceof Error ? createInvoice.error.message : "Could not generate invoice."}</p>}
          <button type="submit" disabled={createInvoice.isPending || !organizationId || !selectedProfile || items.some((item) => !item.description.trim() || Number(item.quantity) <= 0 || Number(item.unitPrice) < 0)} className="rounded-lg bg-sky-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50">{createInvoice.isPending ? "Generating…" : "Generate invoice"}</button>
        </form>
      </section>

      <section className={`${panel} overflow-hidden p-0`}>
        <div className="flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-white">Invoice register</h2><p className="mt-1 text-xs text-slate-500">{query.data ? `${query.data.total} invoices` : "Invoice status and delivery history"}</p></div><div className="flex gap-2"><label className="relative min-w-0 flex-1 sm:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search invoice or customer" className={`${field} pl-9`} /></label><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="min-w-32 rounded-xl border border-white/10 !bg-slate-950 px-3 text-sm text-white"><option value="">All statuses</option><option value="open">Open</option><option value="paid">Paid</option><option value="void">Void</option></select></div></div>
        {query.isPending ? <p role="status" className="p-10 text-center text-sm text-slate-400">Loading invoices…</p> : query.isError ? <p role="alert" className="p-10 text-center text-sm text-rose-300">{query.error instanceof Error ? query.error.message : "Could not load invoices."}</p> : !query.data?.items.length ? <div className="p-10 text-center"><ReceiptText className="mx-auto size-8 text-slate-600" /><p className="mt-3 text-sm text-slate-400">No invoices match these filters.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">Issued / due</th><th className="px-5 py-3">Total</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">WhatsApp</th><th className="px-5 py-3">Actions</th></tr></thead><tbody className="divide-y divide-white/5">{query.data.items.map((invoice) => <tr key={invoice.id} className="align-top hover:bg-white/[.025]"><td className="px-5 py-4"><button type="button" onClick={() => navigate(`/platform/invoices/${invoice.id}`)} className="font-medium text-white hover:text-sky-200">{invoice.invoiceNumber}</button></td><td className="px-5 py-4 text-slate-300">{invoice.organizationName}</td><td className="px-5 py-4 text-xs text-slate-400">{formatPlatformDate(invoice.issuedAt)}<span className="mt-1 block">Due {formatPlatformDate(invoice.dueDate)}</span></td><td className="px-5 py-4 font-medium text-slate-200">{money(invoice.totalAmount, invoice.currencyCode)}</td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ${statusTone[invoice.status]}`}>{invoice.status}</span></td><td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 text-xs text-slate-300"><MessageCircle className={`size-3.5 ${invoice.whatsappStatus === "sent" ? "text-emerald-300" : invoice.whatsappStatus === "failed" ? "text-rose-300" : "text-slate-500"}`} />{invoice.whatsappStatus.replace("_", " ")}</span>{invoice.whatsappError && <span className="mt-1 block max-w-40 text-[10px] text-rose-300">{invoice.whatsappError}</span>}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-1.5"><button type="button" onClick={() => void apiDownload(`/platform/invoices/${invoice.id}/pdf`).catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Could not download PDF."))} title="Download PDF" className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/5"><FileDown className="size-3.5" /> PDF</button><button type="button" disabled={sendWhatsApp.isPending || invoice.status === "void" || invoice.whatsappStatus === "queued"} onClick={() => { setNotice(""); void sendWhatsApp.mutateAsync({ invoiceId: invoice.id }).then(() => setNotice(`${invoice.invoiceNumber} queued for WhatsApp.`)).catch(() => {}); }} title="Send invoice PDF over WhatsApp" className="inline-flex items-center gap-1 rounded-md border border-emerald-300/15 px-2 py-1.5 text-xs text-emerald-200 hover:bg-emerald-300/5 disabled:opacity-40"><Send className="size-3.5" /> Send</button>{invoice.status === "open" && <><button type="button" onClick={() => { setPaying(invoice); setPaymentReference(""); }} className="rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-300 hover:bg-white/5">Mark paid</button><button type="button" onClick={() => { const reason = window.prompt(`Reason for voiding ${invoice.invoiceNumber}?`); if (reason?.trim()) void voidInvoice.mutateAsync({ invoiceId: invoice.id, reason: reason.trim() }).then(() => setNotice(`${invoice.invoiceNumber} voided.`)).catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Could not void invoice.")); }} className="rounded-md border border-rose-300/15 px-2 py-1.5 text-xs text-rose-200 hover:bg-rose-300/5">Void</button></>}</div></td></tr>)}</tbody></table></div>}
        {query.data && query.data.total > query.data.pageSize && <div className="flex items-center justify-between border-t border-white/5 px-5 py-3 text-xs text-slate-500"><span>Page {query.data.page} of {Math.ceil(query.data.total / query.data.pageSize)}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-md border border-white/10 px-3 py-1.5 disabled:opacity-30">Previous</button><button type="button" disabled={page * query.data.pageSize >= query.data.total} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-white/10 px-3 py-1.5 disabled:opacity-30">Next</button></div></div>}
      </section>

      {(sendWhatsApp.isError || voidInvoice.isError) && <p role="alert" className="text-sm text-rose-300">{(sendWhatsApp.error ?? voidInvoice.error) instanceof Error ? (sendWhatsApp.error ?? voidInvoice.error)?.message : "Could not process invoice action."}</p>}

      {paying && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="mark-paid-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl"><h2 id="mark-paid-title" className="text-lg font-semibold text-white">Record payment · {paying.invoiceNumber}</h2><p className="mt-1 text-sm text-slate-400">{money(paying.totalAmount, paying.currencyCode)}</p><form onSubmit={(event) => void pay(event)} className="mt-5 space-y-4"><label className="block space-y-2 text-xs font-medium text-slate-400">Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={field}><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="other">Other</option></select></label><label className="block space-y-2 text-xs font-medium text-slate-400">Reference<input maxLength={120} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className={field} placeholder="UTR, receipt, or transaction reference" /></label>{markPaid.isError && <p role="alert" className="text-sm text-rose-300">{markPaid.error instanceof Error ? markPaid.error.message : "Could not record the payment."}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setPaying(null)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300">Cancel</button><button type="submit" disabled={markPaid.isPending} className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{markPaid.isPending ? "Saving…" : "Confirm payment"}</button></div></form></section></div>}
    </div>
  );
}
