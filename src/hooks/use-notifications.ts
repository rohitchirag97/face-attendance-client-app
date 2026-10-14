import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/hooks/use-payroll-api";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export const unreadCountQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["notifications", organizationId, "unread"] as const,
    queryFn: () => request<{ count: number }>("/notification/unread-count", organizationId),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  });

export const notificationsQuery = (organizationId: string, limit: number) =>
  queryOptions({
    queryKey: ["notifications", organizationId, "list", limit] as const,
    queryFn: () =>
      request<{ items: AppNotification[]; nextCursor: string | null }>(
        "/notification",
        organizationId,
        undefined,
        undefined,
        `&limit=${limit}`,
      ),
    staleTime: 0,
  });

export const useMarkNotificationsRead = (organizationId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[] | "all") =>
      request("/notification/read", organizationId, "POST", { ids }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", organizationId] }),
    meta: { organizationId },
  });
};
