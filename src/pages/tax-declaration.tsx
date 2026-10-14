import React, { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Download, FileUp, Loader2, Paperclip, Plus, Scale, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import {
  financialYearOf,
  form12bbPath,
  formatDay,
  ITEM_STATUS,
  myDeclarationQuery,
  openProof,
  previousFinancialYear,
  rupees,
  SECTION_OPTIONS,
  useAddDeclarationItem,
  useDeleteDeclarationItem,
  useSaveDeclaration,
  useUploadProof,
  type DeclarationItem,
  type DeclarationView,
  type Regime,
  type TaxSection,
} from "@/hooks/use-tax-declarations";
import { apiDownload } from "@/lib/api";
import { inputClass } from "@/lib/form-utils";
import { getActiveOrganizationId } from "@/lib/session";

const PhaseNotice: React.FC<{ view: DeclarationView }> = ({ view }) => {
  const { phase, settings } = view;
  const text =
    phase === "declaration"
      ? `Declarations are open${settings.declarationClosesOn ? ` until ${formatDay(settings.declarationClosesOn)}` : ""}. Upload proofs by ${formatDay(settings.proofDeadline)}.`
      : phase === "proofs"
        ? `Declarations are closed. Upload your proofs by ${formatDay(settings.proofDeadline)}.`
        : `The proof deadline (${formatDay(settings.proofDeadline)}) has passed. Only verified amounts now reduce your TDS.`;
  return (
    <p className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${phase === "closed" ? "bg-muted text-muted-foreground" : "bg-primary/5"}`}>
      <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" />
      {text}
    </p>
  );
};

const RegimeCard: React.FC<{ view: DeclarationView; organizationId: string }> = ({ view, organizationId }) => {
  const save = useSaveDeclaration(organizationId);
  const [regime, setRegime] = useState<Regime>(view.declaration?.taxRegime ?? view.projection?.cheaper ?? "new");
  const [seniorSelf, setSeniorSelf] = useState(view.declaration?.seniorSelf ?? false);
  const [seniorParents, setSeniorParents] = useState(view.declaration?.seniorParents ?? false);
  const locked = view.phase !== "declaration";
  const changed =
    !view.declaration ||
    regime !== view.declaration.taxRegime ||
    seniorSelf !== view.declaration.seniorSelf ||
    seniorParents !== view.declaration.seniorParents;

  const option = (value: Regime, title: string, note: string) => {
    const tax = view.projection?.[value];
    const cheaper = view.projection?.cheaper === value && view.projection.saving > 0;
    return (
      <label
        className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${regime === value ? "border-primary bg-primary/5" : "hover:bg-muted/50"} ${locked ? "cursor-not-allowed opacity-70" : ""}`}
      >
        <span className="flex items-center gap-2">
          <input type="radio" name="regime" checked={regime === value} disabled={locked} onChange={() => setRegime(value)} className="accent-primary" />
          <span className="font-medium">{title}</span>
          {cheaper && <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Saves {rupees(view.projection!.saving)}</span>}
        </span>
        <span className="pl-6 text-xs text-muted-foreground">{note}</span>
        {tax !== undefined && <span className="pl-6 text-sm">Estimated tax for the year: <strong>{rupees(tax)}</strong></span>}
      </label>
    );
  };

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Scale className="size-4 text-primary" /> Choose your tax regime</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {option("new", "New regime", "Lower rates and a ₹75,000 standard deduction, but no 80C, 80D, HRA or home-loan deductions.")}
        {option("old", "Old regime", "Higher rates, but your declared investments, rent and insurance reduce taxable income.")}
      </div>
      {!view.salaryKnown && (
        <p className="text-xs text-muted-foreground">The tax estimate needs a fixed monthly salary on your profile, so it is not shown.</p>
      )}
      {regime === "old" && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={seniorSelf} disabled={locked} onChange={(e) => setSeniorSelf(e.target.checked)} className="accent-primary" /> I am 60 or older</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={seniorParents} disabled={locked} onChange={(e) => setSeniorParents(e.target.checked)} className="accent-primary" /> My parents are 60 or older</label>
        </div>
      )}
      {!locked && changed && (
        <Button
          disabled={save.isPending}
          onClick={() => save.mutate({ financialYear: view.financialYear, taxRegime: regime, seniorSelf, seniorParents })}
        >
          {save.isPending && <Loader2 className="animate-spin" />}
          {view.declaration ? "Save regime" : `Start my ${view.financialYear} declaration`}
        </Button>
      )}
      <ErrorText message={save.error?.message ?? null} />
    </section>
  );
};

const AddItemForm: React.FC<{ view: DeclarationView; organizationId: string }> = ({ view, organizationId }) => {
  const add = useAddDeclarationItem(organizationId, view.financialYear);
  const sections = SECTION_OPTIONS.filter((option) => view.declaration?.taxRegime === "old" || !option.oldOnly);
  const [section, setSection] = useState<TaxSection>(sections[0].value);
  const meta = SECTION_OPTIONS.find((option) => option.value === section)!;
  const [kind, setKind] = useState(meta.kinds[0].value);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState<Record<string, string | boolean>>({});
  const [months, setMonths] = useState("12");
  const [error, setError] = useState<string | null>(null);
  const set = (field: string, value: string | boolean) => setDetails((current) => ({ ...current, [field]: value }));

  const changeSection = (value: TaxSection) => {
    setSection(value);
    setKind(SECTION_OPTIONS.find((option) => option.value === value)!.kinds[0].value);
    setDetails({});
    setError(null);
  };

  const submit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const monthlyRent = Number(details.monthlyRent ?? 0);
    const declaredAmount = section === "HRA" ? monthlyRent * Number(months || 12) : Number(amount);
    if (!declaredAmount || declaredAmount <= 0) return setError(section === "HRA" ? "Enter your monthly rent." : "Enter the amount.");
    const payload: Record<string, string | number | boolean | null> = {};
    for (const [field, value] of Object.entries(details)) {
      if (value === "" || value === undefined) continue;
      payload[field] = field === "monthlyRent" || field === "tdsDeducted" ? Number(value) : value;
    }
    add.mutate(
      { section, kind, description: description.trim() || undefined, declaredAmount, details: payload },
      {
        onSuccess: () => {
          setAmount("");
          setDescription("");
          setDetails({});
        },
        onError: (err) => setError(err.message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-5" noValidate>
      <h2 className="flex items-center gap-2 font-semibold"><Plus className="size-4 text-primary" /> Add a declaration</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Section" hint={meta.limit}>
          {(id) => (
            <select id={id} value={section} onChange={(e) => changeSection(e.target.value as TaxSection)} className={inputClass}>
              {sections.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          )}
        </Field>
        {meta.kinds.length > 1 && (
          <Field label="Type">
            {(id) => (
              <select id={id} value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
                {meta.kinds.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
          </Field>
        )}
      </div>

      {section === "HRA" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Monthly rent">
              {(id) => <input id={id} type="number" min="0" value={String(details.monthlyRent ?? "")} onChange={(e) => set("monthlyRent", e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Months this year">
              {(id) => <input id={id} type="number" min="1" max="12" value={months} onChange={(e) => setMonths(e.target.value)} className={inputClass} />}
            </Field>
            <label className="flex items-end gap-2 pb-2.5 text-sm">
              <input type="checkbox" checked={details.metro === true} onChange={(e) => set("metro", e.target.checked)} className="accent-primary" />
              Delhi, Mumbai, Kolkata or Chennai
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Landlord's name">
              {(id) => <input id={id} value={String(details.landlordName ?? "")} onChange={(e) => set("landlordName", e.target.value)} className={inputClass} />}
            </Field>
            <Field label="Landlord's PAN" hint="Needed when rent is above ₹1,00,000 a year">
              {(id) => <input id={id} value={String(details.landlordPan ?? "")} maxLength={10} onChange={(e) => set("landlordPan", e.target.value.toUpperCase())} className={inputClass} />}
            </Field>
          </div>
          <Field label="Rented property address">
            {(id) => <input id={id} value={String(details.landlordAddress ?? "")} onChange={(e) => set("landlordAddress", e.target.value)} className={inputClass} />}
          </Field>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={section === "PREVIOUS_EMPLOYER" ? "Salary received there this year" : "Amount for the year"}>
            {(id) => <input id={id} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />}
          </Field>
          {section === "PREVIOUS_EMPLOYER" ? (
            <Field label="TDS deducted by them">
              {(id) => <input id={id} type="number" min="0" value={String(details.tdsDeducted ?? "")} onChange={(e) => set("tdsDeducted", e.target.value)} className={inputClass} />}
            </Field>
          ) : (
            <Field label="Note (optional)">
              {(id) => <input id={id} maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="e.g. Policy no. 123456" />}
            </Field>
          )}
        </div>
      )}

      {section === "24B" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Lender's name">
            {(id) => <input id={id} value={String(details.lenderName ?? "")} onChange={(e) => set("lenderName", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Lender's PAN (optional)">
            {(id) => <input id={id} value={String(details.lenderPan ?? "")} maxLength={10} onChange={(e) => set("lenderPan", e.target.value.toUpperCase())} className={inputClass} />}
          </Field>
        </div>
      )}
      {section === "PREVIOUS_EMPLOYER" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Previous employer">
            {(id) => <input id={id} value={String(details.employerName ?? "")} onChange={(e) => set("employerName", e.target.value)} className={inputClass} />}
          </Field>
          <Field label="Their TAN (optional)">
            {(id) => <input id={id} value={String(details.employerTan ?? "")} maxLength={10} onChange={(e) => set("employerTan", e.target.value.toUpperCase())} className={inputClass} />}
          </Field>
        </div>
      )}

      <ErrorText message={error} />
      <Button type="submit" disabled={add.isPending}>
        {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Add
      </Button>
    </form>
  );
};

const ItemRow: React.FC<{ item: DeclarationItem; view: DeclarationView; organizationId: string }> = ({ item, view, organizationId }) => {
  const upload = useUploadProof(organizationId);
  const remove = useDeleteDeclarationItem(organizationId);
  const input = useRef<HTMLInputElement>(null);
  const status = ITEM_STATUS[item.status];
  const canChange = view.phase === "declaration" && item.status !== "accepted";
  const canUpload = view.phase !== "closed" && item.status !== "accepted";
  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-medium">{item.kindLabel}</p>
        <p className="text-xs text-muted-foreground">
          {item.section === "HRA" && item.details.monthlyRent ? `${rupees(Number(item.details.monthlyRent))} a month · ` : ""}
          {item.section === "PREVIOUS_EMPLOYER" ? `${item.details.employerName ?? "Previous employer"} · TDS ${rupees(Number(item.details.tdsDeducted ?? 0))} · ` : ""}
          {item.description ? `${item.description} · ` : ""}
          Declared {rupees(item.declaredAmount)}
          {item.status === "accepted" && item.verifiedAmount !== null && Number(item.verifiedAmount) !== Number(item.declaredAmount) && ` · verified ${rupees(item.verifiedAmount)}`}
        </p>
        {item.reviewNote && <p className="mt-0.5 text-xs text-muted-foreground">Reviewer: {item.reviewNote}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
        {item.hasProof && (
          <Button variant="ghost" size="sm" onClick={() => void openProof(organizationId, item.id)}><Paperclip /> Proof</Button>
        )}
        {canUpload && (
          <>
            <Button variant="outline" size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}>
              {upload.isPending ? <Loader2 className="animate-spin" /> : <FileUp />} {item.hasProof ? "Replace proof" : "Upload proof"}
            </Button>
            <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" aria-label="Proof file"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate({ itemId: item.id, file }); e.target.value = ""; }} />
          </>
        )}
        {canChange && (
          <Button variant="ghost" size="icon" aria-label="Remove" disabled={remove.isPending} onClick={() => remove.mutate(item.id)}><Trash2 /></Button>
        )}
      </div>
      <div className="basis-full"><ErrorText message={upload.error?.message ?? remove.error?.message ?? null} /></div>
    </li>
  );
};

/** Employees declare tax-saving investments for the year, upload proofs, and see what reduces their TDS. */
const TaxDeclarationPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const current = financialYearOf();
  const [financialYear, setFinancialYear] = useState(current);
  const { data: view, isLoading, error } = useQuery(myDeclarationQuery(organizationId, financialYear));
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const grouped = SECTION_OPTIONS.map((option) => ({ option, items: view?.items.filter((item) => item.section === option.value) ?? [] }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="My tax declaration"
        description="Tell us about your tax-saving investments and rent so the right amount of income tax (TDS) is deducted from your salary."
        action={
          <select aria-label="Financial year" value={financialYear} onChange={(e) => setFinancialYear(e.target.value)} className={`${inputClass} w-auto`}>
            <option value={current}>FY {current}</option>
            <option value={previousFinancialYear(current)}>FY {previousFinancialYear(current)}</option>
          </select>
        }
      />
      {isLoading ? (
        <Spinner />
      ) : !view ? (
        <ErrorText message={error?.message ?? "Could not load your declaration."} />
      ) : (
        <>
          <PhaseNotice view={view} />
          <RegimeCard key={`${view.financialYear}-${view.declaration?.taxRegime ?? "none"}`} view={view} organizationId={organizationId} />

          {view.declaration && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                {view.phase === "declaration" && <AddItemForm key={view.declaration.taxRegime} view={view} organizationId={organizationId} />}
                <section className="rounded-xl border bg-card p-5">
                  <h2 className="font-semibold">Your declarations</h2>
                  {grouped.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {view.declaration.taxRegime === "new"
                        ? "The new regime needs no investment declarations. Add your previous employer only if you joined this year."
                        : "Nothing declared yet. Add your investments, insurance and rent above."}
                    </p>
                  ) : (
                    grouped.map(({ option, items }) => (
                      <div key={option.value} className="mt-4">
                        <h3 className="text-sm font-semibold text-muted-foreground">{option.label}</h3>
                        <ul className="divide-y">{items.map((item) => <ItemRow key={item.id} item={item} view={view} organizationId={organizationId} />)}</ul>
                      </div>
                    ))
                  )}
                </section>
              </div>

              <aside className="h-fit space-y-3 rounded-xl border bg-card p-5">
                <h2 className="font-semibold">What counts toward TDS</h2>
                {view.declaration.taxRegime === "new" ? (
                  <p className="text-sm text-muted-foreground">New regime: only the ₹75,000 standard deduction applies.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {view.totals.breakdown.map((line) => (
                      <li key={line.section} className="flex justify-between gap-3">
                        <span className="text-muted-foreground">{line.label}</span>
                        <span>{rupees(line.allowed)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between gap-3 border-t pt-2 font-semibold">
                      <span>Total deductions</span><span>{rupees(view.totals.deductions)}</span>
                    </li>
                  </ul>
                )}
                {view.totals.previousEmployer.gross > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Previous employer: {rupees(view.totals.previousEmployer.gross)} salary and {rupees(view.totals.previousEmployer.tds)} TDS added to this year.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {view.phase === "closed"
                    ? "Only verified amounts count now."
                    : `Declared amounts count until ${formatDay(view.settings.proofDeadline)}; after that, only verified ones.`}
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setDownloadError(null);
                    apiDownload(form12bbPath(organizationId, view.declaration!.id)).catch((e: Error) => setDownloadError(e.message));
                  }}
                >
                  <Download /> Download Form 12BB
                </Button>
                <ErrorText message={downloadError} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TaxDeclarationPage;
