import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { employeeExitQuery } from "@/hooks/use-employee-records";

/** Shown to an employee who is serving notice. Renders nothing otherwise. */
const ExitNotice: React.FC<{ organizationId: string; employeeId: string }> = ({
  organizationId,
  employeeId,
}) => {
  const { data: exit } = useQuery(employeeExitQuery(organizationId, employeeId));
  if (exit?.status !== "notice") return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border p-4 text-sm">
      <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" />
      <div>
        <p className="font-medium">You are serving your notice period</p>
        <p className="text-muted-foreground">
          Your last working day is {exit.lastWorkingDay} ({exit.noticeDays} days notice from{" "}
          {exit.resignationDate}).
        </p>
      </div>
    </div>
  );
};

export default ExitNotice;
