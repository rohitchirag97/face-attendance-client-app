import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Paperclip, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, PageHeader, Spinner } from "@/components/form-kit";
import {
  claimsQuery,
  openReceipt,
  STATUS_STYLE,
  useMarkClaimPaid,
  useReviewClaim,
  type ExpenseClaim,
  type ExpenseStatus,
} from "@/hooks/use-expenses";
import { inputClass } from "@/lib/form-utils";
import { formatMoney } from "@/lib/payroll-format";
import { getActiveOrganizationId, getUser, hasManagerRole } from "@/lib/session";

const TABS: { value: ExpenseStatus | undefined; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved, unpaid" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
  { value: undefined, label: "All" },
];

const formatDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const ClaimRow: React.FC<{ claim: ExpenseClaim; organizationId: string }> = ({ claim, organizationId }) => {
  const review = useReviewClaim(organizationId);
  const markPaid = useMarkClaimPaid(organizationId);
  const [rejecting, setRejecting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [note, setNote] = useState("");
  const style = STATUS_STYLE[claim.status];
  const isOwn = claim.employeeId === getUser()?.id;
  const [receiptError, setReceiptError] = useState<string | null>(null);
  // Recording a payment is money handling, kept to owners and admins; HR approves and rejects.
  const canRecordPayment = hasManagerRole(organizationId);
  const busy = review.isPending || markPaid.isPending;
  const error = review.error ?? markPaid.error ?? (receiptError ? { message: receiptError } : null);

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1 basis-60">
          <p className="font-medium">
            {claim.employeeName}
            {isOwn && <span className="ml-2 text-xs font-normal text-muted-foreground">(your claim)</span>}
          </p>
          <p className="text-sm">
            {claim.categoryLabel} · <span className="font-semibold">{formatMoney(claim.amount, claim.currencyCode)}</span>
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">{claim.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Spent {formatDate(claim.expenseDate)} · submitted {formatDate(claim.createdAt)}
            {claim.reviewNote && <> · Note: {claim.reviewNote}</>}
            {claim.status === "paid" && <> · {claim.payrollRunId ? "Paid with salary" : claim.paymentNote}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
          {claim.hasReceipt ? (
            <Button variant="outline" size="sm" onClick={() => void openReceipt(organizationId, claim.id).catch((e: Error) => setReceiptError(e.message))}>
              <Paperclip /> View receipt
            </Button>
          ) : (
            <span title="Submitted without a receipt, for example a cash payment. Check the description." className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground">
              No receipt
            </span>
          )}
          {claim.status === "pending" && !rejecting && (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting(true)}>
                <X /> Reject
              </Button>
              <Button size="sm" disabled={busy} onClick={() => review.mutate({ claimId: claim.id, status: "approved" })}>
                {review.isPending ? <Loader2 className="animate-spin" /> : <Check />} Approve
              </Button>
            </>
          )}
          {claim.status === "approved" && !paying && canRecordPayment && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setPaying(true)}>
              <Wallet /> Paid outside payroll
            </Button>
          )}
        </div>
      </div>

      {(rejecting || paying) && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (rejecting) review.mutate({ claimId: claim.id, status: "rejected", note });
            else markPaid.mutate({ claimId: claim.id, note });
          }}
        >
          <input
            autoFocus
            value={note}
            maxLength={rejecting ? 500 : 200}
            onChange={(event) => setNote(event.target.value)}
            placeholder={rejecting ? "Reason (shown to the employee)" : "How was it paid? e.g. Cash, UPI ref 1234"}
            className={`${inputClass} min-w-56 flex-1`}
          />
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setRejecting(false); setPaying(false); setNote(""); }}>
            Cancel
          </Button>
          <Button type="submit" size="sm" variant={rejecting ? "destructive" : "default"} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {rejecting ? "Reject claim" : "Mark paid"}
          </Button>
        </form>
      )}
      <ErrorText message={error?.message ?? null} />
    </li>
  );
};

/** Owners and admins approve claims; approved ones are reimbursed in the next payroll run. */
const ExpenseReviewPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const [status, setStatus] = useState<ExpenseStatus | undefined>("pending");
  const { data, isLoading, error } = useQuery(claimsQuery(organizationId, status));
  const total = (data ?? []).reduce((sum, claim) => sum + Number(claim.amount), 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Expense claims"
        description="Check the receipt, then approve: the claim is paid with the employee's next salary, outside gross pay. Claims without a receipt are allowed; their description says why."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setStatus(tab.value)}
              aria-pressed={status === tab.value}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                status === tab.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {data && data.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {data.length} claim{data.length === 1 ? "" : "s"} · {formatMoney(total, data[0].currencyCode)}
          </span>
        )}
      </div>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorText message={error.message} />
      ) : !data?.length ? (
        <EmptyState text={status === "pending" ? "No claims waiting for review." : "No claims here."} />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {data.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} organizationId={organizationId} />
          ))}
        </ul>
      )}
    </div>
  );
};

export default ExpenseReviewPage;
