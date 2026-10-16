import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { platformApi } from "@/lib/platform";

export type Rates = { email: number; whatsappVetanly: number; whatsappCustom: number };

export type PlatformTopUp = {
  id: string;
  organizationId: string;
  organizationName?: string;
  amount: string;
  status: "pending" | "credited" | "cancelled";
  note: string | null;
  createdAt: string;
};

export type PlatformMessagingOverview = {
  rates: Rates;
  pendingTopUps: PlatformTopUp[];
  addonRequests: { organizationId: string; name: string; requestedAt: string }[];
  vetanlyConfigured: boolean;
};

export type PlatformOrgMessaging = {
  addonEnabled: boolean;
  addonRequestedAt: string | null;
  balance: number;
  lowBalanceThreshold: number;
  rateOverrides: Partial<Rates>;
  platformRates: Rates;
  effectiveRates: Rates;
  provider: { kind: "vetanly" | "custom_http"; name: string; lastTestOk: boolean | null; lastTestAt: string | null } | null;
  usageLast30Days: { channel: "email" | "whatsapp"; status: string; n: number }[];
  topUps: PlatformTopUp[];
  transactions: { id: string; kind: string; amount: string; balanceAfter: string; reference: string | null; note: string | null; createdAt: string }[];
};

const keys = {
  all: ["platform"] as const,
  overview: ["platform", "messaging"] as const,
  organization: (id: string) => ["platform", "messaging", id] as const,
};

export const usePlatformMessaging = () =>
  useQuery({ queryKey: keys.overview, queryFn: () => platformApi<PlatformMessagingOverview>("/messaging") });

export const usePlatformOrgMessaging = (organizationId: string) =>
  useQuery({
    queryKey: keys.organization(organizationId),
    queryFn: () => platformApi<PlatformOrgMessaging>(`/organizations/${encodeURIComponent(organizationId)}/messaging`),
    enabled: Boolean(organizationId),
  });

const useMessagingMutation = <TBody>(path: (body: TBody) => string, method: "POST" | "PUT") => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) => platformApi(path(body), { method, body }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.all });
    },
  });
};

export const useSavePlatformRates = () => useMessagingMutation<Rates>(() => "/messaging/rates", "PUT");

export const useSetOrgMessaging = (organizationId: string) =>
  useMessagingMutation<{ addonEnabled?: boolean; rateOverrides?: Partial<Rates> }>(() => `/organizations/${encodeURIComponent(organizationId)}/messaging`, "PUT");

export const useCreditWallet = () =>
  useMessagingMutation<{ organizationId: string; amount: number; reference?: string; note?: string; topUpRequestId?: string }>(
    (body) => `/organizations/${encodeURIComponent(body.organizationId)}/messaging/credit`,
    "POST",
  );

export const useCancelTopUp = () => useMessagingMutation<{ id: string }>((body) => `/messaging/top-ups/${encodeURIComponent(body.id)}/cancel`, "POST");
