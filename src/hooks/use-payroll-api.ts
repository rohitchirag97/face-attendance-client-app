import {
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { api } from "@/lib/api";

type Method = "POST" | "PUT" | "PATCH" | "DELETE";

const orgPath = (path: string, organizationId: string, query = "") =>
  `${path}?organizationId=${encodeURIComponent(organizationId)}${query}`;

export const request = async <T>(
  path: string,
  organizationId: string,
  method?: Method,
  body?: unknown,
  query = "",
) =>
  (await api<{ data: T }>(orgPath(path, organizationId, query), { method, body, auth: true })).data;

export const useOrgMutation = <V, R = unknown>(
  organizationId: string,
  invalidate: QueryKey[],
  fn: (vars: V) => Promise<R>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
    meta: { organizationId },
  });
};

export type Department = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
};

export type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  gracePeriodMinutes: number;
  isActive: boolean;
};

export type PayrollSettings = {
  currencyCode: string;
  overtimeCalculationMethod: "fixed_per_hour" | "hourly_rate_multiplier" | "equivalent_days";
  overtimeFixedAmountPerHour: string | null;
  overtimeHourlyRateMultiplier: string;
  overtimeHoursPerWorkday: string | null;
  lateFineMethod: "none" | "fixed_per_occurrence" | "per_minute";
  lateFineAmount: string | null;
  lateFineCapPerPayPeriod: string | null;
  fullDayThresholdPercent: string;
  halfDayThresholdPercent: string;
  weeklyOffDays: number[];
  autoDeductLoans: boolean;
  paidHolidays: boolean;
  overtimeApprovalRequired: boolean;
};

export type PayrollSettingsInput = {
  currencyCode: string;
  overtimeCalculationMethod: PayrollSettings["overtimeCalculationMethod"];
  overtimeFixedAmountPerHour: number | null;
  overtimeHourlyRateMultiplier: number;
  overtimeHoursPerWorkday: number | null;
  lateFineMethod: PayrollSettings["lateFineMethod"];
  lateFineAmount: number | null;
  lateFineCapPerPayPeriod: number | null;
  fullDayThresholdPercent: number;
  halfDayThresholdPercent: number;
  weeklyOffDays: number[];
  autoDeductLoans: boolean;
  paidHolidays: boolean;
  overtimeApprovalRequired: boolean;
};

export type PayrollRun = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "finalized";
  finalizedAt: string | null;
  createdAt: string;
};

export type PayrollItem = {
  id: string;
  userId: string;
  employeeName: string;
  employeeCode: string | null;
  jobTitle: string | null;
  departmentName: string | null;
  compensationType: "hourly" | "daily" | "fixed_salary";
  compensationAmount: string;
  currencyCode: string;
  workingDays: string;
  presentDays: string;
  halfDays: string;
  paidLeaveDays: string;
  unpaidLeaveDays: string;
  absentDays: string;
  incompleteDays: number;
  workedMinutes: number;
  overtimeMinutes: number;
  lateCount: number;
  lateMinutes: number;
  basePay: string;
  overtimePay: string;
  grossPay: string;
  lateFine: string;
  loanDeduction: string;
  totalDeductions: string;
  netPay: string;
  loanLines: { recoverableId: string; label: string; amount: string }[];
  /** Approved expense claims paid with this salary, outside gross pay. */
  reimbursements: string;
  reimbursementLines: { claimId: string; label: string; amount: string }[];
  allowancesPay: string;
  componentDeductions: string;
  componentLines: PayrollComponentLine[];
};

export type PayrollRunDetail = { run: PayrollRun; items: PayrollItem[]; skipped?: string[] };

/** Which channels the document's recipient can receive on: WhatsApp with a real phone, email with a linked Google account. */
export type DeliveryChannels = { whatsapp: boolean; email: boolean };

export type PayrollSlip = {
  item: PayrollItem;
  run: PayrollRun;
  organizationName: string;
  delivery: DeliveryChannels;
};

export type MySlip = {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  currencyCode: string;
  finalizedAt: string | null;
};

export const payrollRunsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["payroll-runs", organizationId],
    queryFn: () => request<PayrollRun[]>("/payroll", organizationId),
    enabled: !!organizationId,
  });

export const payrollRunQuery = (organizationId: string, runId: string) =>
  queryOptions({
    queryKey: ["payroll-run", organizationId, runId],
    queryFn: () => request<PayrollRunDetail>(`/payroll/${runId}`, organizationId),
    enabled: !!organizationId && !!runId,
  });

export const payrollSlipQuery = (organizationId: string, itemId: string) =>
  queryOptions({
    queryKey: ["payroll-slip", organizationId, itemId],
    queryFn: () => request<PayrollSlip>(`/payroll/slips/${itemId}`, organizationId),
    enabled: !!organizationId && !!itemId,
  });

export const mySlipsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["payroll-my-slips", organizationId],
    queryFn: () => request<MySlip[]>("/payroll/slips/mine", organizationId),
    enabled: !!organizationId,
  });

export const useSendSlipWhatsApp = (organizationId: string) =>
  useOrgMutation(organizationId, [], (itemId: string) =>
    request(`/payroll/slips/${itemId}/whatsapp`, organizationId, "POST"),
  );

export const useSendSlipEmail = (organizationId: string) =>
  useOrgMutation(organizationId, [], (itemId: string) =>
    request(`/payroll/slips/${itemId}/email`, organizationId, "POST"),
  );

export const useGeneratePayroll = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["payroll-runs", organizationId], ["payroll-run", organizationId]],
    (body: { periodStart: string; periodEnd: string; utcOffsetMinutes: number }) =>
      request<PayrollRunDetail>("/payroll/generate", organizationId, "POST", body),
  );

export const useFinalizePayroll = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [
      ["payroll-runs", organizationId],
      ["payroll-run", organizationId],
      ["payroll-slip", organizationId],
      ["recoverables", organizationId],
      ["repayments", organizationId],
    ],
    (runId: string) => request(`/payroll/${runId}/finalize`, organizationId, "POST"),
  );

export const useDeletePayrollRun = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["payroll-runs", organizationId], ["payroll-run", organizationId]],
    (runId: string) => request(`/payroll/${runId}`, organizationId, "DELETE"),
  );

export type Employment = {
  membershipId: string;
  includeInPayroll: boolean;
  employeeCode: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  shiftId: string | null;
  employmentType: "full_time" | "part_time" | "contractor" | "intern" | null;
  hireDate: string | null;
  compensationType: "hourly" | "daily" | "fixed_salary" | null;
  compensationAmount: string | null;
  compensationCurrency: string | null;
  payFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | null;
  salaryComponents: SalaryComponent[];
};

export type SalaryComponent = {
  name: string;
  kind: "earning" | "deduction";
  calc: "fixed" | "percent_basic";
  value: number;
};

export type PayrollComponentLine = { name: string; kind: "earning" | "deduction"; amount: string };

export type EmploymentInput = {
  employeeCode: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  shiftId: string | null;
  employmentType: Employment["employmentType"];
  hireDate: string | null;
  compensationType: Employment["compensationType"];
  compensationAmount: number | null;
  compensationCurrency: string | null;
  payFrequency: Employment["payFrequency"];
  salaryComponents: SalaryComponent[];
};

export type Kiosk = {
  id: string;
  deviceIdentifier: string;
  name: string;
  locationName: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
};

export type AttendanceLog = {
  id: string;
  employeeId: string;
  employeeName: string;
  kioskId: string | null;
  eventType: "check_in" | "check_out";
  source: "kiosk" | "manual";
  faceVerificationStatus: "verified" | "not_applicable" | "failed";
  occurredAt: string;
};

export type RecoverableStatus =
  | "pending"
  | "approved"
  | "disbursed"
  | "active"
  | "completed"
  | "rejected"
  | "cancelled";

export type Recoverable = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: "loan" | "salary_advance";
  status: RecoverableStatus;
  principalAmount: string;
  annualInterestRate: string;
  currencyCode: string;
  installmentCount: number | null;
  installmentAmount: string | null;
  requestedAt: string;
  approvedAt: string | null;
  disbursedAt: string | null;
  firstRepaymentDate: string | null;
  description: string | null;
  totalRepaid: string;
  outstanding: string;
};

export type PaymentMethod = "cash" | "bank_transfer" | "upi" | "cheque" | "other";

export type Repayment = {
  id: string;
  amount: string;
  currencyCode: string;
  source: "payroll" | "manual" | "employee";
  status: "pending" | "confirmed" | "rejected";
  paymentMethod: PaymentMethod | null;
  paidAt: string;
  reference: string | null;
  notes: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type RepaymentLog = Repayment & {
  recoverableId: string;
  employeeId: string;
  employeeName: string;
  type: "loan" | "salary_advance";
};

export const allRepaymentsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["repayments", organizationId, "all"] as const,
    queryFn: () => request<RepaymentLog[]>("/recoverable/repayments", organizationId),
  });

export const departmentsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["departments", organizationId] as const,
    queryFn: () => request<Department[]>("/department", organizationId),
  });

export const shiftsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["shifts", organizationId] as const,
    queryFn: () => request<Shift[]>("/shift", organizationId),
  });

export const payrollSettingsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["payroll-settings", organizationId] as const,
    queryFn: () => request<PayrollSettings | null>("/payroll-settings", organizationId),
  });

export const employmentQuery = (organizationId: string, employeeId: string) =>
  queryOptions({
    queryKey: ["employment", organizationId, employeeId] as const,
    queryFn: () =>
      request<Employment>(
        `/employee/${encodeURIComponent(employeeId)}/employment`,
        organizationId,
      ),
  });

export const kiosksQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["kiosks", organizationId] as const,
    queryFn: () => request<Kiosk[]>("/kiosk-device", organizationId),
  });

export const attendanceQuery = (
  organizationId: string,
  filters: { employeeId?: string; from?: string; to?: string },
) => {
  const params = new URLSearchParams({ limit: "100" });
  if (filters.employeeId) params.set("employeeId", filters.employeeId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return queryOptions({
    queryKey: ["attendance", organizationId, filters] as const,
    queryFn: () =>
      request<AttendanceLog[]>("/attendance", organizationId, undefined, undefined, `&${params}`),
  });
};

export type DailyAttendance = {
  employeeId: string;
  employeeName: string;
  date: string;
  firstCheckIn: string | null;
  lastCheckOut: string | null;
  workedMinutes: number | null;
  expectedMinutes: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  status: "present" | "half_day" | "absent" | "incomplete" | "on_leave";
};

export const dailyAttendanceQuery = (
  organizationId: string,
  filters: { from: string; to: string; employeeId?: string },
) => {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    utcOffsetMinutes: String(-new Date().getTimezoneOffset()),
  });
  if (filters.employeeId) params.set("employeeId", filters.employeeId);
  return queryOptions({
    queryKey: ["attendance", organizationId, "daily", filters] as const,
    queryFn: () =>
      request<DailyAttendance[]>("/attendance/daily", organizationId, undefined, undefined, `&${params}`),
  });
};

export const attendanceRangeQuery = (organizationId: string, from: string, to: string) =>
  queryOptions({
    queryKey: ["attendance", organizationId, "range", from, to] as const,
    queryFn: async () => {
      const logs: AttendanceLog[] = [];
      for (let offset = 0; offset < 5000; offset += 200) {
        const params = new URLSearchParams({
          limit: "200",
          offset: String(offset),
          from,
          to,
        });
        const page = await request<AttendanceLog[]>(
          "/attendance",
          organizationId,
          undefined,
          undefined,
          `&${params}`,
        );
        logs.push(...page);
        if (page.length < 200) break;
      }
      return logs;
    },
  });

export const recoverablesQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["recoverables", organizationId] as const,
    queryFn: () => request<Recoverable[]>("/recoverable", organizationId),
  });

export type AuditLogEntry = {
  seq: number;
  id: string;
  userId: string | null;
  userName: string | null;
  role: string | null;
  method: string;
  path: string;
  action: string;
  summary: string | null;
  details: { outcome?: string; message?: string | null; target?: string | null; reason?: string } | null;
  statusCode: number;
  ipAddress: string | null;
  userAgent: string | null;
  hash: string;
  createdAt: string;
};

export type AuditLogPage = { items: AuditLogEntry[]; nextBefore: number | null };

export const auditLogQuery = (
  organizationId: string,
  filters: { search: string; method: string; before?: number },
) => {
  const params = new URLSearchParams({ limit: "5" });
  if (filters.search) params.set("search", filters.search);
  if (filters.method) params.set("method", filters.method);
  if (filters.before) params.set("before", String(filters.before));
  return queryOptions({
    queryKey: ["audit-log", organizationId, filters] as const,
    queryFn: () => request<AuditLogPage>("/audit-log", organizationId, undefined, undefined, `&${params}`),
  });
};

export const auditVerifyQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["audit-log-verify", organizationId] as const,
    queryFn: () =>
      request<{ valid: boolean; checked: number; brokenAtSeq: number | null }>(
        "/audit-log/verify",
        organizationId,
      ),
    staleTime: 0,
  });

export type LoanNoc = {
  reference: string;
  organizationName: string;
  employeeName: string;
  type: "loan" | "salary_advance";
  principalAmount: string;
  currencyCode: string;
  disbursedAt: string | null;
  closedAt: string;
  issuedAt: string;
  delivery: DeliveryChannels;
};

export const loanNocQuery = (organizationId: string, recoverableId: string) =>
  queryOptions({
    queryKey: ["loan-noc", organizationId, recoverableId] as const,
    queryFn: () => request<LoanNoc>(`/recoverable/${recoverableId}/noc`, organizationId),
  });

export const useSendLoanNocWhatsApp = (organizationId: string) =>
  useOrgMutation(organizationId, [], (recoverableId: string) =>
    request(`/recoverable/${recoverableId}/noc/whatsapp`, organizationId, "POST"),
  );

export const useSendLoanNocEmail = (organizationId: string) =>
  useOrgMutation(organizationId, [], (recoverableId: string) =>
    request(`/recoverable/${recoverableId}/noc/email`, organizationId, "POST"),
  );

export const repaymentsQuery = (organizationId: string, recoverableId: string) =>
  queryOptions({
    queryKey: ["repayments", organizationId, recoverableId] as const,
    queryFn: () =>
      request<Repayment[]>(`/recoverable/${recoverableId}/repayments`, organizationId),
  });

export const useSaveDepartment = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["departments", organizationId]],
    (vars: {
      id?: string;
      name?: string;
      code?: string | null;
      description?: string | null;
      isActive?: boolean;
    }) => {
      const { id, ...body } = vars;
      return request(
        id ? `/department/${id}` : "/department",
        organizationId,
        id ? "PATCH" : "POST",
        body,
      );
    },
  );

export const useDeleteDepartment = (organizationId: string) =>
  useOrgMutation(organizationId, [["departments", organizationId]], (id: string) =>
    request(`/department/${id}`, organizationId, "DELETE"),
  );

export const useSaveShift = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["shifts", organizationId]],
    (vars: {
      id?: string;
      name?: string;
      startTime?: string;
      endTime?: string;
      breakMinutes?: number;
      gracePeriodMinutes?: number;
      isActive?: boolean;
    }) => {
      const { id, ...body } = vars;
      return request(id ? `/shift/${id}` : "/shift", organizationId, id ? "PATCH" : "POST", body);
    },
  );

export const useDeleteShift = (organizationId: string) =>
  useOrgMutation(organizationId, [["shifts", organizationId]], (id: string) =>
    request(`/shift/${id}`, organizationId, "DELETE"),
  );

export type Holiday = { id: string; date: string; name: string };

export const holidaysQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["holidays", organizationId] as const,
    queryFn: () => request<Holiday[]>("/holiday", organizationId),
  });

export const useAddHoliday = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["holidays", organizationId]],
    (body: { name: string; date: string; endDate?: string }) =>
      request("/holiday", organizationId, "POST", body),
  );

export const useDeleteHoliday = (organizationId: string) =>
  useOrgMutation(organizationId, [["holidays", organizationId]], (id: string) =>
    request(`/holiday/${id}`, organizationId, "DELETE"),
  );

export const useSavePayrollSettings = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["payroll-settings", organizationId]],
    (body: PayrollSettingsInput) => request("/payroll-settings", organizationId, "PUT", body),
  );

export const saveEmployment = (
  organizationId: string,
  employeeId: string,
  body: Partial<EmploymentInput>,
) =>
  request(
    `/employee/${encodeURIComponent(employeeId)}/employment`,
    organizationId,
    "PATCH",
    body,
  );

export const useUpdateEmployment = (organizationId: string, employeeId: string) =>
  useOrgMutation(
    organizationId,
    [["employment", organizationId, employeeId]],
    (body: Partial<EmploymentInput>) =>
      request(
        `/employee/${encodeURIComponent(employeeId)}/employment`,
        organizationId,
        "PATCH",
        body,
      ),
  );

export const useSetPayrollInclusion = (organizationId: string, employeeId: string) =>
  useOrgMutation(
    organizationId,
    [
      ["employment", organizationId, employeeId],
      ["employees", organizationId],
    ],
    (includeInPayroll: boolean) =>
      request<{ includeInPayroll: boolean }>(
        "/employee/payroll-inclusion",
        organizationId,
        "PATCH",
        { includeInPayroll },
      ),
  );

export const useCreateKiosk = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["kiosks", organizationId]],
    (body: { deviceIdentifier: string; name: string; locationName: string | null }) =>
      request<Kiosk & { apiKey: string }>("/kiosk-device", organizationId, "POST", body),
  );

export const useUpdateKiosk = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["kiosks", organizationId]],
    (vars: { id: string; isActive: boolean }) =>
      request(`/kiosk-device/${vars.id}`, organizationId, "PATCH", { isActive: vars.isActive }),
  );

export const useRotateKioskKey = (organizationId: string) =>
  useOrgMutation(organizationId, [], (id: string) =>
    request<{ id: string; apiKey: string }>(
      `/kiosk-device/${id}/rotate-key`,
      organizationId,
      "POST",
    ),
  );

export const useManualAttendance = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["attendance", organizationId]],
    (body: {
      employeeId: string;
      eventType: "check_in" | "check_out";
      occurredAt: string;
      utcOffsetMinutes: number;
    }) => request("/attendance/manual", organizationId, "POST", body),
  );

export type BulkAttendanceResult = {
  employeeId: string;
  status: "present" | "half_day" | "on_leave" | "absent";
  ok: boolean;
  message?: string;
};

export const useBulkManualAttendance = (organizationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      date: string;
      utcOffsetMinutes: number;
      leaveTypeId?: string;
      entries: { employeeId: string; status: BulkAttendanceResult["status"]; overtimeMinutes: number }[];
    }) => request<BulkAttendanceResult[]>("/attendance/manual/bulk", organizationId, "POST", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["leave", organizationId] });
    },
  });
};

export type LeaveType = {
  id: string;
  name: string;
  isPaid: boolean;
  annualAllowanceDays: string | null;
  isActive: boolean;
};

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  isPaid: boolean;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  days: string;
  reason: string | null;
  status: LeaveStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

export type LeaveBalance = {
  leaveTypeId: string;
  name: string;
  allowanceDays: number | null;
  usedDays: number;
  remainingDays: number | null;
};

export const leaveTypesQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["leave-types", organizationId] as const,
    queryFn: () => request<LeaveType[]>("/leave/types", organizationId),
  });

export const leaveRequestsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["leave-requests", organizationId] as const,
    queryFn: () => request<LeaveRequest[]>("/leave", organizationId),
  });

export const leaveBalancesQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["leave-balances", organizationId] as const,
    queryFn: () => request<LeaveBalance[]>("/leave/balances", organizationId),
  });

const leaveKeys = (organizationId: string) => [
  ["leave-requests", organizationId],
  ["leave-balances", organizationId],
];

export const useSaveLeaveType = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["leave-types", organizationId], ...leaveKeys(organizationId)],
    (vars: {
      id?: string;
      name?: string;
      isPaid?: boolean;
      annualAllowanceDays?: number | null;
      isActive?: boolean;
    }) => {
      const { id, ...body } = vars;
      return request(
        id ? `/leave/types/${id}` : "/leave/types",
        organizationId,
        id ? "PATCH" : "POST",
        body,
      );
    },
  );

export const useCreateLeaveRequest = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    leaveKeys(organizationId),
    (body: {
      employeeId?: string;
      leaveTypeId: string;
      startDate: string;
      endDate: string;
      isHalfDay: boolean;
      reason?: string;
    }) => request("/leave", organizationId, "POST", body),
  );

export const useUpdateLeaveStatus = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    leaveKeys(organizationId),
    (vars: { id: string; status: "approved" | "rejected" | "cancelled"; reviewNote?: string }) =>
      request(`/leave/${vars.id}/status`, organizationId, "PATCH", {
        status: vars.status,
        reviewNote: vars.reviewNote,
      }),
  );

export const useCreateRecoverable = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["recoverables", organizationId]],
    (body: {
      employeeId?: string;
      type: "loan" | "salary_advance";
      principalAmount: number;
      installmentCount?: number;
      installmentAmount?: number;
      annualInterestRate?: number;
      description?: string;
    }) => request("/recoverable", organizationId, "POST", body),
  );

export const useUpdateRecoverableStatus = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [["recoverables", organizationId]],
    (vars: {
      id: string;
      status: "approved" | "rejected" | "cancelled" | "disbursed";
      annualInterestRate?: number;
    }) =>
      request(`/recoverable/${vars.id}/status`, organizationId, "PATCH", {
        status: vars.status,
        annualInterestRate: vars.annualInterestRate,
      }),
  );

export const useCreateRepayment = (organizationId: string, recoverableId: string) =>
  useOrgMutation(
    organizationId,
    [
      ["recoverables", organizationId],
      ["repayments", organizationId],
    ],
    (body: {
      amount: number;
      paymentMethod?: PaymentMethod;
      paidAt?: string;
      reference?: string;
      notes?: string;
    }) =>
      request(`/recoverable/${recoverableId}/repayments`, organizationId, "POST", body),
  );

export const useReviewAnyRepayment = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    [
      ["recoverables", organizationId],
      ["repayments", organizationId],
    ],
    (vars: {
      recoverableId: string;
      id: string;
      status: "confirmed" | "rejected";
      reviewNote?: string;
    }) =>
      request(
        `/recoverable/${vars.recoverableId}/repayments/${vars.id}/review`,
        organizationId,
        "PATCH",
        { status: vars.status, reviewNote: vars.reviewNote },
      ),
  );

export const useReviewRepayment = (organizationId: string, recoverableId: string) =>
  useOrgMutation(
    organizationId,
    [
      ["recoverables", organizationId],
      ["repayments", organizationId],
    ],
    (vars: { id: string; status: "confirmed" | "rejected"; reviewNote?: string }) =>
      request(
        `/recoverable/${recoverableId}/repayments/${vars.id}/review`,
        organizationId,
        "PATCH",
        { status: vars.status, reviewNote: vars.reviewNote },
      ),
  );
