import { queryOptions } from "@tanstack/react-query";

import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  author: string | null;
};

export const announcementsQuery = (organizationId: string) =>
  queryOptions({
    queryKey: ["announcements", organizationId] as const,
    queryFn: () => request<Announcement[]>("/announcements", organizationId),
  });

export const usePublishAnnouncement = (organizationId: string) =>
  useOrgMutation(organizationId, [["announcements", organizationId]], (input: { title: string; body: string }) =>
    request("/announcements", organizationId, "POST", input),
  );

export const useDeleteAnnouncement = (organizationId: string) =>
  useOrgMutation(organizationId, [["announcements", organizationId]], (id: string) =>
    request(`/announcements/${id}`, organizationId, "DELETE"),
  );
