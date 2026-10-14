import { queryOptions } from "@tanstack/react-query";

import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type RegularizationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type Regularization = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
  status: RegularizationStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

const keys = (organizationId: string) => [
  ["regularizations", organizationId],
  ["attendance", organizationId],
];

export const regularizationsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["regularizations", organizationId] as const,
    queryFn: () => request<Regularization[]>("/regularization", organizationId),
  });

export const useCreateRegularization = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    keys(organizationId),
    (body: { date: string; checkIn?: string; checkOut?: string; reason: string }) =>
      request("/regularization", organizationId, "POST", {
        ...body,
        utcOffsetMinutes: -new Date().getTimezoneOffset(),
      }),
  );

export const useUpdateRegularizationStatus = (organizationId: string) =>
  useOrgMutation(
    organizationId,
    keys(organizationId),
    (vars: { id: string; status: "approved" | "rejected" | "cancelled"; reviewNote?: string }) =>
      request(`/regularization/${vars.id}/status`, organizationId, "PATCH", {
        status: vars.status,
        reviewNote: vars.reviewNote,
      }),
  );
