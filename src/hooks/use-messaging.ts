import { queryOptions } from "@tanstack/react-query";
import { request, useOrgMutation } from "@/hooks/use-payroll-api";

export type MessageType = "salary_slip" | "loan_noc" | "test";
export type MessageStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "simulated";
export type Rates = { email: number; whatsappVetanly: number; whatsappCustom: number };

export type CustomConfig = {
  url: string;
  method: "POST" | "PUT" | "GET";
  headers: { name: string; value: string }[];
  bodyTemplate: string;
  responseIdPath?: string;
  statusWebhook?: {
    messageIdPath: string;
    statusPath: string;
    errorPath?: string;
    statusMap: { sent?: string[]; delivered?: string[]; read?: string[]; failed?: string[] };
  };
};

export type Provider = {
  id: string;
  kind: "vetanly" | "custom_http";
  name: string;
  config: Partial<CustomConfig>;
  secretNames: string[];
  statusWebhookUrl: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
};

export type TemplateMapping = { messageType: MessageType; templateName: string; language: string; params: string[] };

export type WalletTransaction = {
  id: string;
  kind: "top_up" | "charge" | "refund" | "adjustment";
  amount: string;
  balanceAfter: string;
  reference: string | null;
  note: string | null;
  createdAt: string;
};

export type TopUpRequest = { id: string; amount: string; status: "pending" | "credited" | "cancelled"; note: string | null; createdAt: string };

export type MessagingOverview = {
  isOwner: boolean;
  addonEnabled: boolean;
  addonRequestedAt: string | null;
  balance: number;
  lowBalanceThreshold: number;
  lowBalance: boolean;
  rates: Rates;
  provider: Provider | null;
  templates: TemplateMapping[];
  vetanly: { configured: boolean; templates: Record<string, string> };
  messageTypes: { type: MessageType; label: string; hasDocument: boolean; variables: { key: string; label: string; example: string }[] }[];
  placeholders: { name: string; description: string }[];
  pendingTopUps: TopUpRequest[];
  transactions: WalletTransaction[];
};

export type MessageLog = {
  id: string;
  channel: "email" | "whatsapp";
  providerKind: "vetanly" | "custom_http" | "email";
  messageType: MessageType;
  recipientMasked: string;
  status: MessageStatus;
  providerMessageId: string | null;
  error: string | null;
  charge: string;
  refunded: boolean;
  createdAt: string;
  updatedAt: string;
};

const key = (organizationId: string) => ["messaging", organizationId] as const;

export const messagingQuery = (organizationId: string) =>
  queryOptions({
    queryKey: [...key(organizationId), "overview"] as const,
    queryFn: () => request<MessagingOverview>("/messaging", organizationId),
    enabled: !!organizationId,
  });

export const messageLogsQuery = (organizationId: string, filters: { status?: string; channel?: string; offset: number }) =>
  queryOptions({
    queryKey: [...key(organizationId), "logs", filters] as const,
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50", offset: String(filters.offset) });
      if (filters.status) params.set("status", filters.status);
      if (filters.channel) params.set("channel", filters.channel);
      return request<{ total: number; logs: MessageLog[] }>("/messaging/logs", organizationId, undefined, undefined, `&${params}`);
    },
    enabled: !!organizationId,
    refetchInterval: 15_000,
  });

const invalidate = (organizationId: string) => [key(organizationId)];

export const useRequestAddon = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), () => request("/messaging/addon-request", organizationId, "POST"));

export const useUseVetanly = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), () => request("/messaging/provider/vetanly", organizationId, "PUT"));

export const useSaveCustomProvider = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (body: { name: string; config: CustomConfig; secrets?: Record<string, string | null> }) =>
    request("/messaging/provider/custom", organizationId, "PUT", body),
  );

export const useRemoveProvider = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), () => request("/messaging/provider", organizationId, "DELETE"));

export const useSaveTemplates = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (templates: TemplateMapping[]) => request("/messaging/templates", organizationId, "PUT", { templates }));

export const useSendTest = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (phone: string) =>
    request<{ ok: boolean; status: string; message: string }>("/messaging/test", organizationId, "POST", { phone }),
  );

export const useSaveLowBalance = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (threshold: number) => request("/messaging/low-balance", organizationId, "PUT", { threshold }));

export const useRequestTopUp = (organizationId: string) =>
  useOrgMutation(organizationId, invalidate(organizationId), (body: { amount: number; note?: string }) => request("/messaging/top-up-requests", organizationId, "POST", body));

export const STATUS_STYLE: Record<MessageStatus, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", className: "bg-sky-100 text-sky-800" },
  delivered: { label: "Delivered", className: "bg-green-100 text-green-800" },
  read: { label: "Read", className: "bg-emerald-100 text-emerald-800" },
  failed: { label: "Failed", className: "bg-red-100 text-red-800" },
  simulated: { label: "Not sent (simulated)", className: "bg-amber-100 text-amber-800" },
};

/** Starting points for common providers; the owner fills in their own secrets and template names. */
export const PROVIDER_PRESETS: { id: string; label: string; name: string; config: CustomConfig; secrets: string[]; help: string }[] = [
  {
    id: "aisensy",
    label: "AiSensy",
    name: "AiSensy",
    secrets: ["apiKey"],
    help: "Use your AiSensy API key as the apiKey secret, and your live API campaign names in the template mapping.",
    config: {
      url: "https://backend.aisensy.com/campaign/t1/api/v2",
      method: "POST",
      headers: [],
      bodyTemplate:
        '{\n  "apiKey": "{{secret.apiKey}}",\n  "campaignName": "{{template}}",\n  "destination": "{{phone_plus}}",\n  "userName": "{{recipient_name}}",\n  "templateParams": {{params_json}},\n  "media": { "url": "{{document_url}}", "filename": "{{document_filename}}" }\n}',
    },
  },
  {
    id: "meta",
    label: "Meta Cloud API",
    name: "WhatsApp Cloud API",
    secrets: ["accessToken", "phoneNumberId"],
    help: "Add your permanent access token and phone number ID as secrets. Set the webhook in Meta to the status URL below; its verify token is the last part of that URL. Adjust the body's parameters to match each template.",
    config: {
      url: "https://graph.facebook.com/v21.0/{{secret.phoneNumberId}}/messages",
      method: "POST",
      headers: [{ name: "Authorization", value: "Bearer {{secret.accessToken}}" }],
      bodyTemplate:
        '{\n  "messaging_product": "whatsapp",\n  "to": "{{phone}}",\n  "type": "template",\n  "template": {\n    "name": "{{template}}",\n    "language": { "code": "{{language}}" },\n    "components": [\n      { "type": "header", "parameters": [{ "type": "document", "document": { "link": "{{document_url}}", "filename": "{{document_filename}}" } }] },\n      { "type": "body", "parameters": [{ "type": "text", "text": "{{param1}}" }, { "type": "text", "text": "{{param2}}" }] }\n    ]\n  }\n}',
      responseIdPath: "messages.0.id",
      statusWebhook: {
        messageIdPath: "entry.0.changes.0.value.statuses.0.id",
        statusPath: "entry.0.changes.0.value.statuses.0.status",
        errorPath: "entry.0.changes.0.value.statuses.0.errors.0.title",
        statusMap: { sent: ["sent"], delivered: ["delivered"], read: ["read"], failed: ["failed"] },
      },
    },
  },
  {
    id: "blank",
    label: "Other (blank)",
    name: "My WhatsApp provider",
    secrets: ["apiKey"],
    help: "Fill in your provider's API URL, headers and request body from their documentation.",
    config: { url: "https://", method: "POST", headers: [], bodyTemplate: '{\n  "to": "{{phone}}",\n  "template": "{{template}}",\n  "params": {{params_json}}\n}' },
  },
];
