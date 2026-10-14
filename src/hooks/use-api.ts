import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  saveSession,
  setOrganizations,
  setUser,
  type Organization,
  type User,
} from "@/lib/session";

export const queryKeys = {
  organizations: ["organizations"] as const,
};

export const organizationsQuery = queryOptions({
  queryKey: queryKeys.organizations,
  queryFn: async () => (await api<{ data: Organization[] }>("/organization", { auth: true })).data,
});

export const useSendOtp = () =>
  useMutation({
    mutationFn: (phone: string) => api("/auth/send-otp", { method: "POST", body: { phone } }),
  });

export const useVerifyOtp = () =>
  useMutation({
    mutationFn: (vars: { phone: string; otp: string }) =>
      api<{ data: Parameters<typeof saveSession>[0] }>("/auth/verify-otp", {
        method: "POST",
        body: vars,
      }),
    onSuccess: (res) => saveSession(res.data),
  });

export const useGoogleLogin = () =>
  useMutation({
    mutationFn: (credential: string) =>
      api<{ data: Parameters<typeof saveSession>[0] }>("/auth/google", {
        method: "POST",
        body: { credential },
      }),
    onSuccess: (res) => saveSession(res.data),
  });

export const useCreateOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { name: string; slug: string }) => {
      await api("/organization", { method: "POST", body: vars, auth: true });
      const orgs = await queryClient.fetchQuery({ ...organizationsQuery, staleTime: 0 });
      return { orgs, created: orgs.find((o) => o.slug === vars.slug) ?? orgs[0] };
    },
    onSuccess: ({ orgs, created }) => setOrganizations(orgs, created?.id),
  });
};

export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { organizationId: string; name: string; slug: string }) =>
      api<{ data: Organization }>(
        `/organization/${encodeURIComponent(vars.organizationId)}`,
        {
          method: "PATCH",
          body: { name: vars.name, slug: vars.slug },
          auth: true,
        },
      ),
    onSuccess: async (_response, vars) => {
      const orgs = await queryClient.fetchQuery({
        ...organizationsQuery,
        staleTime: 0,
      });
      setOrganizations(orgs, vars.organizationId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.organizations });
    },
  });
};

export const useCreateEmployee = () =>
  useMutation({
    mutationFn: (vars: {
      fname: string;
      lname: string;
      phone: string;
      role: "admin" | "hr" | "employee";
      organizationId: string;
    }) => api("/employee", { method: "POST", body: vars, auth: true }),
  });

export type BulkCheckStatus = "new" | "existing-user" | "inactive-member" | "member" | "not-allowed";

export type BulkCheckResult = {
  phones: Record<string, { status: BulkCheckStatus; name?: string }>;
  /** Employee codes already used in the organization, mapped to the holder's phone. */
  takenCodes: Record<string, string>;
};

/** Read-only preview of a bulk upload against the people already in the organization. */
export const checkBulkEmployees = async (organizationId: string, phones: string[], employeeCodes: string[]) =>
  (
    await api<{ data: BulkCheckResult }>("/employee/bulk/check", {
      method: "POST",
      body: { organizationId, phones, employeeCodes },
      auth: true,
    })
  ).data;

export const useBulkCreateEmployees = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      organizationId: string;
      employees: { fname: string; lname: string; phone: string; role: "admin" | "hr" | "employee" }[];
    }) =>
      (
        await api<{ data: { results: { row: number; phone: string; status: string; employeeId?: string }[] } }>(
          "/employee/bulk",
          { method: "POST", body: vars, auth: true },
        )
      ).data.results,
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({ queryKey: ["employees", vars.organizationId] }),
  });
};

export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      employeeId: string;
      organizationId: string;
      fname: string;
      lname: string;
      role: "admin" | "hr" | "employee";
    }) =>
      api(`/employee/${encodeURIComponent(vars.employeeId)}`, {
        method: "PATCH",
        body: {
          organizationId: vars.organizationId,
          fname: vars.fname,
          lname: vars.lname,
          role: vars.role,
        },
        auth: true,
      }),
    onSuccess: (_response, vars) =>
      queryClient.invalidateQueries({
        queryKey: ["employees", vars.organizationId],
      }),
  });
};

export const useSetEmployeeActive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      employeeId: string;
      organizationId: string;
      isActive: boolean;
      reason?: string;
    }) =>
      api(`/employee/${encodeURIComponent(vars.employeeId)}/status`, {
        method: "PATCH",
        body: {
          organizationId: vars.organizationId,
          isActive: vars.isActive,
          reason: vars.reason,
        },
        auth: true,
      }),
    onSuccess: (_response, vars) =>
      queryClient.invalidateQueries({
        queryKey: ["employees", vars.organizationId],
      }),
  });
};

export const useRemoveEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { employeeId: string; organizationId: string }) =>
      api(`/employee/${encodeURIComponent(vars.employeeId)}`, {
        method: "DELETE",
        body: { organizationId: vars.organizationId },
        auth: true,
      }),
    onSuccess: (_response, vars) =>
      queryClient.invalidateQueries({
        queryKey: ["employees", vars.organizationId],
      }),
  });
};

export type Employee = {
  id: string;
  fname: string;
  lname: string;
  phone: string;
  role: "super_admin" | "admin" | "hr" | "employee";
  isActive: boolean;
};

export const employeesQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["employees", organizationId] as const,
    queryFn: async () =>
      (
        await api<{ data: Employee[] }>(
          `/employee?organizationId=${encodeURIComponent(organizationId)}`,
          { auth: true },
        )
      ).data,
  });

export const useSendLinkPhoneOtp = () =>
  useMutation({
    mutationFn: (phone: string) =>
      api("/user/phone/send-otp", { method: "POST", body: { phone }, auth: true }),
  });

export const useVerifyLinkPhone = () =>
  useMutation({
    mutationFn: (vars: { phone: string; otp: string }) =>
      api<{ data: User }>("/user/phone/verify", { method: "POST", body: vars, auth: true }),
    onSuccess: (res) => setUser(res.data),
  });

export const useLinkGoogle = () =>
  useMutation({
    mutationFn: (credential: string) =>
      api<{ data: User }>("/user/google", { method: "POST", body: { credential }, auth: true }),
    onSuccess: (res) => setUser(res.data),
  });

export const useUpdateProfile = () =>
  useMutation({
    mutationFn: (vars: { fname: string; lname: string }) =>
      api<{ user?: User }>("/user", { method: "PATCH", body: vars, auth: true }),
    onSuccess: (res, vars) => {
      const current = JSON.parse(localStorage.getItem("user") ?? "{}") as User;
      setUser({ ...current, ...(res.user ?? vars) });
    },
  });
