import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Clock, Download, HandCoins, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, PageHeader, Spinner } from "@/components/form-kit";
import { inputClass } from "@/lib/form-utils";
import { getActiveOrganizationId, canManageEmployees, canManagePeople } from "@/lib/session";
import ReportExports from "@/components/report-exports";
import { summarizeAttendance, toCsv } from "@/lib/report-utils";
import { attendanceRangeQuery, recoverablesQuery } from "@/hooks/use-payroll-api";

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthRange = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  return {
    from: new Date(year, m - 1, 1).toISOString(),
    to: new Date(year, m, 1, 0, 0, 0, -1).toISOString(),
  };
};

const Stat: React.FC<{ label: string; value: string | number; icon: React.ElementType }> = ({
  label,
  value,
  icon: Icon,
}) => (
  <div className="rounded-xl border border-l-4 border-l-primary bg-background p-4 shadow-sm">
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{label}</span>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
    </div>
    <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
  </div>
);

const Reports: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const [month, setMonth] = useState(currentMonth);
  const { from, to } = useMemo(() => monthRange(month), [month]);

  const logs = useQuery({
    ...attendanceRangeQuery(organizationId, from, to),
    enabled: Boolean(organizationId && month),
  });
  const loans = useQuery({ ...recoverablesQuery(organizationId), enabled: Boolean(organizationId) });

  const rows = useMemo(() => summarizeAttendance(logs.data ?? []), [logs.data]);
  const totalHours = rows.reduce((sum, r) => sum + r.hoursWorked, 0);
  const openLoans = (loans.data ?? []).filter((l) => l.status === "active" || l.status === "disbursed");
  const outstanding = openLoans.reduce((sum, l) => sum + Number(l.outstanding), 0);

  const exportCsv = () => {
    const csv = toCsv([
      ["Employee", "Days present", "Hours worked", "Check-ins", "Manual entries"],
      ...rows.map((r) => [
        r.employeeName,
        r.daysPresent,
        r.hoursWorked.toFixed(2),
        r.checkIns,
        r.manualEntries,
      ]),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Monthly attendance summary and outstanding loans."
        action={
          <div className="flex items-center gap-2">
            <input
              type="month"
              aria-label="Month"
              value={month}
              max={currentMonth()}
              onChange={(event) => event.target.value && setMonth(event.target.value)}
              className={`${inputClass} w-44`}
            />
            <Button variant="outline" className="h-10" onClick={exportCsv} disabled={rows.length === 0}>
              <Download /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Employees with attendance" value={rows.length} icon={Users} />
        <Stat
          label="Total days present"
          value={rows.reduce((sum, r) => sum + r.daysPresent, 0)}
          icon={CalendarCheck}
        />
        <Stat label="Total hours worked" value={totalHours.toFixed(1)} icon={Clock} />
        <Stat label="Outstanding loans" value={outstanding.toFixed(2)} icon={HandCoins} />
      </div>

      {canManagePeople(organizationId) && (
        <ReportExports organizationId={organizationId} sensitiveReportsAllowed={canManageEmployees(organizationId)} />
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Attendance by employee</h2>
        <ErrorText message={logs.error?.message} />
        {logs.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState text="No attendance recorded for this month." />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-background shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-secondary-foreground">
                <tr>
                  <th className="p-3 font-medium">Employee</th>
                  <th className="p-3 text-right font-medium">Days present</th>
                  <th className="p-3 text-right font-medium">Hours worked</th>
                  <th className="p-3 text-right font-medium">Check-ins</th>
                  <th className="p-3 text-right font-medium">Manual entries</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.employeeId} className="hover:bg-accent/50">
                    <td className="p-3 font-medium">{r.employeeName}</td>
                    <td className="p-3 text-right">{r.daysPresent}</td>
                    <td className="p-3 text-right">{r.hoursWorked.toFixed(2)}</td>
                    <td className="p-3 text-right">{r.checkIns}</td>
                    <td className="p-3 text-right">{r.manualEntries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default Reports;
