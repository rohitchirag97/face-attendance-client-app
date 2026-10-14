import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  platformApi,
  type PlatformAuditPage,
  type PlatformInvoiceList,
  type PlatformInvoiceDetail,
  type PlatformOrganizationBilling,
  type PlatformOrganizationDetail,
  type PlatformOrganizationList,
  type PlatformOverview,
  type PlatformPlan,
} from "@/lib/platform";

export const platformQueryKeys = {
  all: ["platform"] as const,
  overview: ["platform", "overview"] as const,
  organizations: ["platform", "organizations"] as const,
  organization: (id: string) => ["platform", "organization", id] as const,
  audit: ["platform", "audit"] as const,
  plans: ["platform", "plans"] as const,
  invoices: ["platform", "invoices"] as const,
  organizationBilling: (id: string) => ["platform", "organization-billing", id] as const,
};

export const usePlatformOverview = () =>
  useQuery({
    queryKey: platformQueryKeys.overview,
    queryFn: () => platformApi<PlatformOverview>("/overview"),
  });

export const usePlatformOrganizations = (filters: {
  search: string;
  status: string;
  page: number;
  pageSize?: number;
}) =>
  useQuery({
    queryKey: [...platformQueryKeys.organizations, filters],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize ?? 20) });
      if (filters.search.trim()) params.set("search", filters.search.trim());
      if (filters.status) params.set("status", filters.status);
      return platformApi<PlatformOrganizationList>(`/organizations?${params.toString()}`);
    },
  });

export const usePlatformOrganization = (id: string) =>
  useQuery({
    queryKey: platformQueryKeys.organization(id),
    queryFn: () => platformApi<PlatformOrganizationDetail>(`/organizations/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
  });

export const usePlatformAudit = (page: number) =>
  useQuery({
    queryKey: [...platformQueryKeys.audit, page],
    queryFn: () => platformApi<PlatformAuditPage>(`/audit-log?page=${page}&pageSize=50`),
  });

export const usePlatformPlans = () =>
  useQuery({ queryKey: platformQueryKeys.plans, queryFn: () => platformApi<PlatformPlan[]>("/plans") });

export const usePlatformOrganizationBilling = (id: string) =>
  useQuery({
    queryKey: platformQueryKeys.organizationBilling(id),
    queryFn: () => platformApi<PlatformOrganizationBilling>(`/organizations/${encodeURIComponent(id)}/billing`),
    enabled: Boolean(id),
  });

export const usePlatformInvoices = (filters: { search: string; status: string; page: number }) =>
  useQuery({
    queryKey: [...platformQueryKeys.invoices, filters],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(filters.page), pageSize: "25" });
      if (filters.search.trim()) params.set("search", filters.search.trim());
      if (filters.status) params.set("status", filters.status);
      return platformApi<PlatformInvoiceList>(`/invoices?${params.toString()}`);
    },
    refetchInterval: (query) => query.state.data?.items.some((invoice) => invoice.whatsappStatus === "queued") ? 5000 : false,
  });

export const usePlatformInvoice = (id: string) =>
  useQuery({
    queryKey: [...platformQueryKeys.invoices, "detail", id],
    queryFn: () => platformApi<PlatformInvoiceDetail>(`/invoices/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
    refetchInterval: (query) => query.state.data?.whatsappStatus === "queued" ? 5000 : false,
  });

export const usePlatformBillingMutation = <TBody, TResult = unknown>(
  path: string | ((body: TBody) => string),
  method: "POST" | "PUT" | "PATCH",
) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => platformApi<TResult>(typeof path === "string" ? path : path(body), { method, body }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: platformQueryKeys.all }); },
  });
};

export const useCreatePlatformOrganization = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      platformApi<{ organization: { id: string }; existingOwner: boolean }>("/organizations", {
        method: "POST",
        body,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: platformQueryKeys.all });
    },
  });
};

export const useSuspendPlatformOrganization = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      platformApi(`/organizations/${encodeURIComponent(id)}/suspend`, {
        method: "POST",
        body: { reason },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: platformQueryKeys.all });
    },
  });
};

export const useReactivatePlatformOrganization = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      platformApi(`/organizations/${encodeURIComponent(id)}/reactivate`, { method: "POST" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: platformQueryKeys.all });
    },
  });
};

export const useAddPlatformNote = (id: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      platformApi(`/organizations/${encodeURIComponent(id)}/notes`, {
        method: "POST",
        body: { text },
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: platformQueryKeys.organization(id) });
    },
  });
};
