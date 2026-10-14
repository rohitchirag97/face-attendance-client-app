import { queryOptions } from "@tanstack/react-query";

import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type OvertimeStatus = "pending" | "approved" | "rejected" | "auto";

export type OvertimeRow = {
  employeeId: string;
  employeeName: string;
  date: string;
  workedMinutes: number;
  expectedMinutes: number;
  overtimeMinutes: number;
  status: OvertimeStatus;
  approvedMinutes: number;
  note: string | null;
};

export type OvertimeList = { approvalRequired: boolean; items: OvertimeRow[] };

const offset = () => -new Date().getTimezoneOffset();

export const overtimeQuery = (organizationId: string, from: string, to: string) =>
  queryOptions({
    queryKey: ["overtime", organizationId, from, to] as const,
    queryFn: () =>
      request<OvertimeList>("/overtime", organizationId, undefined, undefined, `&from=${from}&to=${to}&utcOffsetMinutes=${offset()}`),
  });

export const useReviewOvertime = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["overtime", organizationId]],
    (entries: { employeeId: string; date: string; status: "approved" | "rejected"; approvedMinutes?: number; note?: string }[]) =>
      request("/overtime/review", organizationId, "POST", { entries, utcOffsetMinutes: offset() }),
  );
