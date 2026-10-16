import { queryOptions } from "@tanstack/react-query";
import { request } from "@/hooks/use-payroll-api";

type Count = { name: string; count: number };
type AttendanceSummary = {
  attendanceRatePercent: number | null;
  present: number;
  halfDays: number;
  absent: number;
  incomplete: number;
  onLeave: number;
  lateArrivals: number;
  averageLateMinutes: number;
  overtimeHours: number;
};

export type WorkforceInsights = {
  asOf: string;
  headcount: number;
  joinedLast90Days: number;
  servingNotice: number;
  averageTenureYears: number | null;
  attrition12Months: { leavers: number; voluntary: number; averageHeadcount: number; ratePercent: number };
  trend: { month: string; headcount: number; joined: number; left: number }[];
  byDepartment: Count[];
  byBranch: Count[];
  byEmploymentType: Count[];
  byGender: Count[];
  byTenure: Count[];
  leaversByReason: Count[];
};

export type AttendanceInsights = {
  from: string;
  to: string;
  summary: AttendanceSummary;
  byWeekday: { day: string; absent: number; late: number; days: number }[];
  byDepartment: (AttendanceSummary & { name: string })[];
  mostLate: { employeeId: string; name: string; count: number; lateMinutes: number }[];
  mostAbsent: { employeeId: string; name: string; count: number }[];
  leave: { daysTaken: number; byType: { name: string; days: number }[]; topTakers: { name: string; days: number }[] };
};

export type UpcomingInsights = {
  asOf: string;
  events: { type: "birthday" | "anniversary" | "notice_ends" | "gratuity_due"; employeeId: string; name: string; date: string; inDays: number; detail: string }[];
  pending: {
    leaveRequests: number;
    expenseClaims: number;
    attendanceCorrections: number;
    assetReceiptsUnconfirmed: number;
    missingHireDates: number;
    missingBirthDates: number;
  };
};

export type CostInsights = {
  trend: { month: string; employees: number; gross: number; net: number; overtime: number; employerContributions: number; totalCost: number }[];
  latestMonth: string | null;
  byDepartment: { name: string; cost: number }[];
  byBranch: { name: string; cost: number }[];
  expensesLast6Months: { name: string; amount: number }[];
};

const key = (organizationId: string) => ["insights", organizationId] as const;

export const workforceInsightsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "workforce"] as const,
    queryFn: () => request<WorkforceInsights>("/insights/workforce", organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
  });

export const attendanceInsightsQuery = (organizationId: string, from: string, to: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "attendance", from, to] as const,
    queryFn: () => request<AttendanceInsights>("/insights/attendance", organizationId, undefined, undefined, `&from=${from}&to=${to}`),
    enabled: !!organizationId && !!from && !!to && from <= to,
    staleTime: 5 * 60_000,
  });

export const upcomingInsightsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "upcoming"] as const,
    queryFn: () => request<UpcomingInsights>("/insights/upcoming", organizationId),
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
  });

export const costInsightsQuery = (organizationId: string, enabled: boolean) =>
  queryOptions({
    queryKey: [...key(organizationId), "cost"] as const,
    queryFn: () => request<CostInsights>("/insights/cost", organizationId),
    enabled: !!organizationId && enabled,
    staleTime: 5 * 60_000,
  });
