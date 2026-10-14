import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, PageHeader, Spinner } from "@/components/form-kit";
import { formatMoney, formatPeriod } from "@/lib/payroll-format";
import { mySlipsQuery } from "@/hooks/use-payroll-api";
import { getActiveOrganizationId } from "@/lib/session";

const MySalarySlips: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(mySlipsQuery(organizationId));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <PageHeader title="Salary slips" description="Slips for pay periods that have been finalized." />
      <ErrorText message={error?.message} />
      {isLoading ? (
        <Spinner />
      ) : data && data.length > 0 ? (
        <ul className="divide-y rounded-xl border bg-background shadow-sm">
          {data.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-medium">{formatPeriod(s.periodStart, s.periodEnd)}</p>
                <p className="text-sm text-muted-foreground">
                  Net pay {formatMoney(s.netPay, s.currencyCode)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(`/salary-slip/${s.id}`)}>
                <FileText /> View slip
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        !error && <p className="text-sm text-muted-foreground">No salary slips yet.</p>
      )}
    </div>
  );
};

export default MySalarySlips;
