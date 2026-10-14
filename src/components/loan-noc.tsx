import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2, Loader2, Mail, MessageCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Spinner } from "@/components/form-kit";
import { loanNocQuery, useSendLoanNocEmail, useSendLoanNocWhatsApp } from "@/hooks/use-payroll-api";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

const Letter: React.FC<{ organizationId: string; recoverableId: string }> = ({
  organizationId,
  recoverableId,
}) => {
  const { data: noc, isLoading, error: loadError } = useQuery(loanNocQuery(organizationId, recoverableId));
  const whatsapp = useSendLoanNocWhatsApp(organizationId);
  const email = useSendLoanNocEmail(organizationId);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sending = whatsapp.isPending || email.isPending;

  const send = (channel: typeof whatsapp, success: string) => {
    setError(null);
    setNotice(null);
    channel.mutate(recoverableId, {
      onSuccess: () => setNotice(success),
      onError: (e) => setError(e.message),
    });
  };

  if (isLoading) return <Spinner />;
  if (!noc) return <ErrorText message={loadError?.message ?? "Could not generate the NOC."} />;

  const kind = noc.type === "loan" ? "loan" : "salary advance";
  const amount = `${noc.currencyCode} ${Number(noc.principalAmount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button type="button" onClick={() => window.print()}>
          <Printer /> Print
        </Button>
        {noc.delivery.whatsapp && (
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={() => send(whatsapp, "NOC is being sent to the employee on WhatsApp.")}
          >
            {whatsapp.isPending ? <Loader2 className="animate-spin" /> : <MessageCircle />}
            Send on WhatsApp
          </Button>
        )}
        {noc.delivery.email && (
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={() => send(email, "NOC is being emailed to the employee's linked Google address.")}
          >
            {email.isPending ? <Loader2 className="animate-spin" /> : <Mail />}
            Send via email
          </Button>
        )}
      </div>
      {notice && (
        <p role="status" className="text-sm text-green-600 print:hidden">
          {notice}
        </p>
      )}
      <ErrorText message={error} />

      <article className="noc-print space-y-4 border border-gray-300 bg-white p-8 text-sm leading-relaxed text-black">
        <h3 className="text-center text-lg font-bold">{noc.organizationName}</h3>
        <h4 className="text-center font-bold underline">NO OBJECTION CERTIFICATE</h4>
        <div className="flex justify-between text-xs">
          <span>Reference: {noc.reference}</span>
          <span>Date: {fmt(noc.issuedAt)}</span>
        </div>
        <p>To whom it may concern,</p>
        <p className="text-justify">
          This is to certify that <strong>{noc.employeeName}</strong>, an employee of {noc.organizationName},
          availed a {kind} of <strong>{amount}</strong>
          {noc.disbursedAt && <> which was disbursed on {fmt(noc.disbursedAt)}</>}.
        </p>
        <p className="text-justify">
          The amount has been repaid in full and the {kind} was closed on {fmt(noc.closedAt)}.{" "}
          {noc.organizationName} has no outstanding claim or dues against {noc.employeeName} in respect of
          this {kind}, and has no objection to this certificate being used for any lawful purpose.
        </p>
        <div className="pt-10">
          <p>Authorised signatory</p>
          <p>{noc.organizationName}</p>
        </div>
      </article>
    </div>
  );
};

const LoanNoc: React.FC<{ organizationId: string; recoverableId: string }> = ({
  organizationId,
  recoverableId,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3 border-t p-3">
      {!open && (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <FileCheck2 /> Generate NOC letter
        </Button>
      )}
      {open && <Letter organizationId={organizationId} recoverableId={recoverableId} />}
    </div>
  );
};

export default LoanNoc;
