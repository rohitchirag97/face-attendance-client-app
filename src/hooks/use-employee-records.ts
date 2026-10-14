import { queryOptions } from "@tanstack/react-query";
import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type EmployeeProfile = {
  dateOfBirth: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  emergencyContactName: string | null;
  emergencyContactRelation: string | null;
  emergencyContactPhone: string | null;
  bankAccountHolder: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  upiId: string | null;
};

export type EmployeeDocument = {
  id: string;
  docType: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
};

export type LifecycleKind = "onboarding" | "offboarding";

export type LifecycleTask = {
  id: string;
  kind: LifecycleKind;
  title: string;
  isDone: boolean;
  doneAt: string | null;
};

export type ExitType = "resignation" | "termination" | "retirement" | "other";

export type EmployeeExit = {
  id: string;
  exitType: ExitType;
  status: "notice" | "completed" | "cancelled";
  resignationDate: string;
  noticeDays: number;
  lastWorkingDay: string;
  reason: string | null;
  notes: string | null;
  completedAt: string | null;
};

export type ExitInput = {
  exitType: ExitType;
  resignationDate: string;
  noticeDays: number;
  lastWorkingDay?: string;
  reason: string | null;
  notes: string | null;
};

const base = (employeeId: string) => `/employee-record/${encodeURIComponent(employeeId)}`;

export const employeeProfileQuery = (organizationId: string, employeeId: string) =>
  queryOptions({
    queryKey: ["employee-profile", organizationId, employeeId] as const,
    queryFn: () => request<EmployeeProfile>(`${base(employeeId)}/profile`, organizationId),
  });

export const useSaveEmployeeProfile = (organizationId: string, employeeId: string) =>
  useOrgMutation(
    organizationId,
    [["employee-profile", organizationId, employeeId]],
    (body: EmployeeProfile) => request(`${base(employeeId)}/profile`, organizationId, "PUT", body),
  );

export const employeeDocumentsQuery = (organizationId: string, employeeId: string) =>
  queryOptions({
    queryKey: ["employee-documents", organizationId, employeeId] as const,
    queryFn: () => request<EmployeeDocument[]>(`${base(employeeId)}/documents`, organizationId),
  });

export const useUploadEmployeeDocument = (organizationId: string, employeeId: string) =>
  useOrgMutation(
    organizationId,
    [["employee-documents", organizationId, employeeId]],
    (vars: { file: File; docType: string; name: string }) => {
      const form = new FormData();
      form.append("file", vars.file);
      form.append("docType", vars.docType);
      if (vars.name.trim()) form.append("name", vars.name.trim());
      return request(`${base(employeeId)}/documents`, organizationId, "POST", form);
    },
  );

export const useDeleteEmployeeDocument = (organizationId: string, employeeId: string) =>
  useOrgMutation(
    organizationId,
    [["employee-documents", organizationId, employeeId]],
    (documentId: string) =>
      request(`${base(employeeId)}/documents/${documentId}`, organizationId, "DELETE"),
  );

export const fetchDocumentUrl = (organizationId: string, employeeId: string, documentId: string) =>
  request<{ url: string; name: string }>(
    `${base(employeeId)}/documents/${documentId}/url`,
    organizationId,
  );

export const lifecycleTasksQuery = (
  organizationId: string,
  employeeId: string,
  kind: LifecycleKind,
) =>
  queryOptions({
    queryKey: ["lifecycle-tasks", organizationId, employeeId, kind] as const,
    queryFn: () =>
      request<LifecycleTask[]>(
        `${base(employeeId)}/tasks`,
        organizationId,
        undefined,
        undefined,
        `&kind=${kind}`,
      ),
  });

export const useLifecycleActions = (organizationId: string, employeeId: string) => {
  const keys = [["lifecycle-tasks", organizationId, employeeId]];
  const start = useOrgMutation(organizationId, keys, (kind: LifecycleKind) =>
    request(`${base(employeeId)}/tasks/start`, organizationId, "POST", { kind }),
  );
  const add = useOrgMutation(organizationId, keys, (vars: { kind: LifecycleKind; title: string }) =>
    request(`${base(employeeId)}/tasks`, organizationId, "POST", vars),
  );
  const toggle = useOrgMutation(organizationId, keys, (vars: { id: string; isDone: boolean }) =>
    request(`${base(employeeId)}/tasks/${vars.id}`, organizationId, "PATCH", { isDone: vars.isDone }),
  );
  const remove = useOrgMutation(organizationId, keys, (id: string) =>
    request(`${base(employeeId)}/tasks/${id}`, organizationId, "DELETE"),
  );
  return { start, add, toggle, remove };
};

export const employeeExitQuery = (organizationId: string, employeeId: string) =>
  queryOptions({
    queryKey: ["employee-exit", organizationId, employeeId] as const,
    queryFn: () => request<EmployeeExit | null>(`${base(employeeId)}/exit`, organizationId),
  });

export const useExitActions = (organizationId: string, employeeId: string) => {
  // Completing an exit deactivates the member, so the employee list must refresh too.
  const keys = [
    ["employee-exit", organizationId, employeeId],
    ["lifecycle-tasks", organizationId, employeeId],
    ["employees", organizationId],
  ];
  const save = useOrgMutation(organizationId, keys, (body: ExitInput) =>
    request(`${base(employeeId)}/exit`, organizationId, "PUT", body),
  );
  const complete = useOrgMutation(organizationId, keys, () =>
    request(`${base(employeeId)}/exit/complete`, organizationId, "POST"),
  );
  const cancel = useOrgMutation(organizationId, keys, () =>
    request(`${base(employeeId)}/exit/cancel`, organizationId, "POST"),
  );
  return { save, complete, cancel };
};
