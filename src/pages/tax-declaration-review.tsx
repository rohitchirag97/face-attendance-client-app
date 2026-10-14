import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Download, Loader2, Paperclip, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import {
  declarationsQuery,
  financialYearOf,
  form12bbPath,
  formatDay,
  ITEM_STATUS,
  openProof,
  previousFinancialYear,
  reviewDetailQuery,
  rupees,
  useReviewItem,
  useSaveDeclarationSettings,
  type DeclarationItem,
  type DeclarationView,
} from "@/hooks/use-tax-declarations";
import { apiDownload } from "@/lib/api";
import { inputClass } from "@/lib/form-utils";
import { getActiveOrganizationId, getUser, hasManagerRole, isOrganizationOwner } from "@/lib/session";

const SettingsCard: React.FC<{ organizationId: string; financialYear: string; settings: DeclarationView["settings"] }> = ({
  organizationId,
  financialYear,
  settings,
}) => {
  const save = useSaveDeclarationSettings(organizationId);
  const [closesOn, setClosesOn] = useState(settings.declarationClosesOn ?? "");
  const [deadline, setDeadline] = useState(settings.proofDeadline);
  const [saved, setSaved] = useState(false);
  const canEdit = hasManagerRole(organizationId);
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Deadlines for FY {financialYear}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Declared amounts reduce TDS until the proof deadline; after it, only verified amounts do.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Declarations close on" hint="Leave empty to keep them open until the proof deadline">
          {(id) => <input id={id} type="date" disabled={!canEdit} value={closesOn} onChange={(e) => { setClosesOn(e.target.value); setSaved(false); }} className={inputClass} />}
        </Field>
        <Field label="Proof deadline">
          {(id) => <input id={id} type="date" disabled={!canEdit} value={deadline} onChange={(e) => { setDeadline(e.target.value); setSaved(false); }} className={inputClass} />}
        </Field>
        {canEdit && (
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate({ financialYear, declarationClosesOn: closesOn || null, proofDeadline: deadline }, { onSuccess: () => setSaved(true) })
            }
          >
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save
          </Button>
        )}
      </div>
      {saved && <p role="status" className="mt-2 text-sm text-green-600">Deadlines saved.</p>}
      <ErrorText message={save.error?.message ?? null} />
    </section>
  );
};

const ReviewItemRow: React.FC<{ item: DeclarationItem; organizationId: string; isOwnDeclaration: boolean }> = ({
  item,
  organizationId,
  isOwnDeclaration,
}) => {
  const review = useReviewItem(organizationId);
  const [mode, setMode] = useState<"accept" | "reject" | null>(null);
  const [amount, setAmount] = useState(item.declaredAmount);
  const [note, setNote] = useState("");
  const status = ITEM_STATUS[item.status];
  const blockedOwn = isOwnDeclaration && !isOrganizationOwner(organizationId);

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-medium">{item.sectionLabel}: {item.kindLabel}</p>
          <p className="text-xs text-muted-foreground">
            Declared {rupees(item.declaredAmount)}
            {item.status === "accepted" && item.verifiedAmount !== null && ` · verified ${rupees(item.verifiedAmount)}`}
            {item.section === "HRA" && ` · ${rupees(Number(item.details.monthlyRent ?? 0))}/month${item.details.metro ? " · metro" : ""}${item.details.landlordPan ? ` · landlord PAN ${item.details.landlordPan}` : ""}`}
            {item.section === "PREVIOUS_EMPLOYER" && ` · ${item.details.employerName ?? ""} · TDS ${rupees(Number(item.details.tdsDeducted ?? 0))}`}
            {item.description && ` · ${item.description}`}
          </p>
          {item.reviewNote && <p className="text-xs text-muted-foreground">Note: {item.reviewNote}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
          {item.hasProof ? (
            <Button variant="outline" size="sm" onClick={() => void openProof(organizationId, item.id)}><Paperclip /> View proof</Button>
          ) : (
            <span className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground">No proof yet</span>
          )}
          {!mode && !blockedOwn && (
            <>
              <Button size="sm" variant="outline" onClick={() => setMode("reject")}><X /> Reject</Button>
              <Button size="sm" onClick={() => setMode("accept")}><Check /> {item.status === "accepted" ? "Change" : "Verify"}</Button>
            </>
          )}
        </div>
      </div>
      {mode && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            review.mutate(
              { itemId: item.id, status: mode === "accept" ? "accepted" : "rejected", verifiedAmount: mode === "accept" ? Number(amount) : undefined, note },
              { onSuccess: () => setMode(null) },
            );
          }}
        >
          {mode === "accept" && (
            <Field label="Verified amount">
              {(id) => <input id={id} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} w-36`} />}
            </Field>
          )}
          <input
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder={mode === "accept" ? "Note (optional)" : "Reason, shown to the employee"}
            className={`${inputClass} min-w-48 flex-1`}
          />
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
          <Button type="submit" size="sm" variant={mode === "accept" ? "default" : "destructive"} disabled={review.isPending}>
            {review.isPending && <Loader2 className="animate-spin" />} {mode === "accept" ? "Verify" : "Reject"}
          </Button>
        </form>
      )}
      <ErrorText message={review.error?.message ?? null} />
    </li>
  );
};

const DeclarationDetail: React.FC<{ organizationId: string; declarationId: string }> = ({ organizationId, declarationId }) => {
  const { data, isLoading, error } = useQuery(reviewDetailQuery(organizationId, declarationId));
  const [downloadError, setDownloadError] = useState<string | null>(null);
  if (isLoading) return <Spinner />;
  if (!data) return <ErrorText message={error?.message ?? "Could not load this declaration."} />;
  const isOwn = data.employeeId === getUser()?.id;
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{data.employeeName}</h2>
          <p className="text-sm text-muted-foreground">
            {data.declaration?.taxRegime === "old" ? "Old regime" : "New regime"} · deductions counted now {rupees(data.totals.deductions)}
            {data.projection && ` · estimated tax ${rupees(data.projection[data.declaration?.taxRegime ?? "new"])}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setDownloadError(null);
            apiDownload(form12bbPath(organizationId, declarationId)).catch((e: Error) => setDownloadError(e.message));
          }}
        >
          <Download /> Form 12BB
        </Button>
      </div>
      <ErrorText message={downloadError} />
      {isOwn && !isOrganizationOwner(organizationId) && (
        <p className="text-sm text-muted-foreground">This is your own declaration; someone else must verify it.</p>
      )}
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items declared.</p>
      ) : (
        <ul className="divide-y">
          {data.items.map((item) => <ReviewItemRow key={item.id} item={item} organizationId={organizationId} isOwnDeclaration={isOwn} />)}
        </ul>
      )}
    </section>
  );
};

/** HR, admins and the owner verify declarations against proofs, item by item. */
const TaxDeclarationReviewPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const current = financialYearOf();
  const [financialYear, setFinancialYear] = useState(current);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery(declarationsQuery(organizationId, financialYear));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="Tax declarations"
        description="Check each employee's proofs and verify what they declared. Payroll uses verified amounts after the proof deadline."
        action={
          <select aria-label="Financial year" value={financialYear} onChange={(e) => { setFinancialYear(e.target.value); setSelected(null); }} className={`${inputClass} w-auto`}>
            <option value={current}>FY {current}</option>
            <option value={previousFinancialYear(current)}>FY {previousFinancialYear(current)}</option>
          </select>
        }
      />
      {isLoading ? (
        <Spinner />
      ) : !data ? (
        <ErrorText message={error?.message ?? "Could not load declarations."} />
      ) : (
        <>
          <SettingsCard key={financialYear} organizationId={organizationId} financialYear={financialYear} settings={data.settings} />
          {data.declarations.length === 0 ? (
            <EmptyState text={`No declarations for FY ${financialYear} yet. Employees add them from My tax declaration.`} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
              <ul className="h-fit divide-y rounded-xl border bg-card">
                {data.declarations.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(row.id)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${selected === row.id ? "bg-primary/5" : ""}`}
                    >
                      <span className="block text-sm font-medium">{row.employeeName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.taxRegime === "old" ? "Old" : "New"} regime · {row.itemCount} item{row.itemCount === 1 ? "" : "s"} · declared {rupees(row.declaredTotal)}
                      </span>
                      {(row.awaitingReview > 0 || row.missingProofs > 0) && (
                        <span className="mt-1 flex flex-wrap gap-1.5 text-xs">
                          {row.awaitingReview > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{row.awaitingReview} to verify</span>}
                          {row.missingProofs > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{row.missingProofs} without proof</span>}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {selected ? (
                <DeclarationDetail key={selected} organizationId={organizationId} declarationId={selected} />
              ) : (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Choose an employee to review their declaration. Those with proofs waiting are listed first. Deadlines: proofs by{" "}
                  {formatDay(data.settings.proofDeadline)}.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TaxDeclarationReviewPage;
