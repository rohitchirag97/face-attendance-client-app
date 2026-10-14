import React, { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, Loader2, Paperclip, Receipt, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import {
  EXPENSE_CATEGORIES,
  myClaimsQuery,
  openReceipt,
  STATUS_STYLE,
  useCancelClaim,
  useCreateClaim,
  type ExpenseCategory,
  type ExpenseClaim,
} from "@/hooks/use-expenses";
import { inputClass } from "@/lib/form-utils";
import { formatMoney } from "@/lib/payroll-format";
import { getActiveOrganizationId } from "@/lib/session";

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const statusDetail = (claim: ExpenseClaim) => {
  if (claim.status === "approved") return "Will be paid with your next salary";
  if (claim.status === "paid") return claim.payrollRunId ? "Paid with salary" : claim.paymentNote ?? "Paid";
  if (claim.status === "rejected") return claim.reviewNote ?? "Rejected";
  if (claim.status === "pending") return "Waiting for approval";
  return null;
};

/** Employees claim back money they spent for work and follow each claim to payment. */
const ExpensesPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const { data, isLoading, error } = useQuery(myClaimsQuery(organizationId));
  const create = useCreateClaim(organizationId);
  const cancel = useCancelClaim(organizationId);
  const fileInput = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<ExpenseCategory>("travel");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(today);
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const pickReceipt = (file: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file?.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    setReceipt(file);
  };
  const clearReceipt = () => {
    pickReceipt(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    const value = Number(amount);
    if (!value || value <= 0) return setFormError("Enter the amount you spent.");
    if (description.trim().length < 3) return setFormError("Describe what the expense was for.");
    const form = new FormData();
    form.set("category", category);
    form.set("amount", value.toFixed(2));
    form.set("expenseDate", expenseDate);
    form.set("description", description.trim());
    if (receipt) form.set("receipt", receipt);
    create.mutate(form, {
      onSuccess: () => {
        setAmount("");
        setDescription("");
        clearReceipt();
        setNotice("Claim submitted. You will be notified once it is reviewed.");
      },
      onError: (err) => setFormError(err.message),
    });
  };

  const claims = data?.claims ?? [];
  const pendingTotal = claims
    .filter((claim) => claim.status === "pending" || claim.status === "approved")
    .reduce((sum, claim) => sum + Number(claim.amount), 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="My expenses"
        description="Claim back money you spent for work. Approved claims are paid with your next salary."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <form onSubmit={submit} className="h-fit space-y-4 rounded-xl border bg-card p-5" noValidate>
          <h2 className="flex items-center gap-2 font-semibold">
            <Receipt className="size-4 text-primary" /> New claim
          </h2>
          <Field label="Category">
            {(id) => (
              <select id={id} value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={inputClass}>
                {EXPENSE_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              {(id) => (
                <input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={amount}
                  onChange={(e) => setAmount(e.target.value)} className={inputClass} placeholder="0.00" />
              )}
            </Field>
            <Field label="Date spent">
              {(id) => (
                <input id={id} type="date" max={today()} value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)} className={inputClass} />
              )}
            </Field>
          </div>
          <Field label="What was it for?">
            {(id) => (
              <textarea id={id} rows={3} maxLength={500} value={description}
                onChange={(e) => setDescription(e.target.value)} className={`${inputClass} h-auto py-2`}
                placeholder="e.g. Cab to client site in Andheri" />
            )}
          </Field>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Receipt <span className="font-normal text-muted-foreground">(optional)</span></span>
            {!data?.receiptsEnabled ? (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                Receipt upload is not available right now. You can still submit the claim.
              </p>
            ) : receipt ? (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                {receipt.type.startsWith("image/") ? (
                  <img src={previewUrl ?? undefined} alt="" className="size-10 shrink-0 rounded object-cover" />
                ) : (
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate">{receipt.name}</span>
                <button type="button" aria-label="Remove receipt" onClick={clearReceipt}>
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <Button type="button" variant="outline" className="w-full" onClick={() => fileInput.current?.click()}>
                  <Camera /> Attach photo or PDF
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or PDF, up to 5 MB. No receipt (paid in cash, or lost)? You can still submit; say why in
                  the description.
                </p>
              </>
            )}
            <input ref={fileInput} type="file" accept="image/*,application/pdf" className="hidden"
              aria-label="Receipt file" onChange={(e) => pickReceipt(e.target.files?.[0] ?? null)} />
          </div>
          <ErrorText message={formError} />
          {notice && <p role="status" className="text-sm text-green-600">{notice}</p>}
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : <Send />} Submit claim
          </Button>
        </form>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Your claims</h2>
            {pendingTotal > 0 && (
              <span className="text-sm text-muted-foreground">
                {formatMoney(pendingTotal, claims[0]?.currencyCode ?? "INR")} awaiting payment
              </span>
            )}
          </div>
          {isLoading ? (
            <Spinner />
          ) : error ? (
            <ErrorText message={error.message} />
          ) : claims.length === 0 ? (
            <EmptyState text="No claims yet. Submit your first one on the left." />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {claims.map((claim) => {
                const style = STATUS_STYLE[claim.status];
                const detail = statusDetail(claim);
                return (
                  <li key={claim.id} className="flex flex-wrap items-start gap-3 p-4">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="font-medium">
                        {claim.categoryLabel} · {formatMoney(claim.amount, claim.currencyCode)}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{claim.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Spent {formatDate(claim.expenseDate)} · submitted {formatDate(claim.createdAt)}
                        {detail && <> · {detail}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
                      {claim.hasReceipt && (
                        <Button variant="ghost" size="sm" onClick={() => void openReceipt(organizationId, claim.id)}>
                          <Paperclip /> Receipt
                        </Button>
                      )}
                      {claim.status === "pending" && (
                        <Button variant="ghost" size="sm" disabled={cancel.isPending} onClick={() => cancel.mutate(claim.id)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <ErrorText message={cancel.error?.message ?? null} />
        </section>
      </div>
    </div>
  );
};

export default ExpensesPage;
