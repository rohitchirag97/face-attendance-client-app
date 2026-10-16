import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { AlertTriangle, CheckCircle2, Copy, Loader2, MessageCircle, Plus, Save, Send, Trash2, Wallet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, PageHeader, Spinner } from "@/components/form-kit";
import {
  messageLogsQuery,
  messagingQuery,
  PROVIDER_PRESETS,
  STATUS_STYLE,
  useRemoveProvider,
  useRequestAddon,
  useRequestTopUp,
  useSaveCustomProvider,
  useSaveLowBalance,
  useSaveTemplates,
  useSendTest,
  useUseVetanly,
  type CustomConfig,
  type MessagingOverview,
  type TemplateMapping,
} from "@/hooks/use-messaging";
import { inputClass } from "@/lib/form-utils";
import { getActiveOrganizationId } from "@/lib/session";

const rupees = (value: number | string, digits = 2) => `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: 3 })}`;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// ---------- Balance ----------

const BalanceTab: React.FC<{ organizationId: string; data: MessagingOverview }> = ({ organizationId, data }) => {
  const topUp = useRequestTopUp(organizationId);
  const lowBalance = useSaveLowBalance(organizationId);
  const [amount, setAmount] = useState("1000");
  const [note, setNote] = useState("");
  const [threshold, setThreshold] = useState(String(data.lowBalanceThreshold));
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className="space-y-5">
      {data.lowBalance && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" /> Your balance is below {rupees(data.lowBalanceThreshold)}. Add balance so documents keep going out.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs uppercase text-muted-foreground">Balance</p>
          <p className="text-3xl font-semibold">{rupees(data.balance)}</p>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <p>Email: {data.rates.email ? `${rupees(data.rates.email, 2)} per message` : "free"}</p>
            <p>WhatsApp via Vetanly: {rupees(data.rates.whatsappVetanly, 2)} per message</p>
            <p>WhatsApp via your own provider: {rupees(data.rates.whatsappCustom, 2)} per message</p>
            <p className="text-xs">A message that fails is refunded.</p>
          </div>
        </div>
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <h3 className="font-semibold">Add balance</h3>
          {data.isOwner ? (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Amount (₹)">{(id) => <input id={id} type="number" min={100} step="100" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputClass} w-36`} />}</Field>
                <Field label="Note (optional)">{(id) => <input id={id} value={note} maxLength={300} placeholder="Payment reference" onChange={(e) => setNote(e.target.value)} className={`${inputClass} w-64`} />}</Field>
                <Button
                  disabled={topUp.isPending}
                  onClick={() => { setNotice(null); topUp.mutate({ amount: Number(amount), note: note || undefined }, { onSuccess: () => { setNotice("Request sent. We'll add the balance once payment is received."); setNote(""); } }); }}
                >
                  {topUp.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Request top-up
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">We'll share payment details; the balance is added as soon as payment is received.</p>
              {notice && <p className="text-sm text-green-700 dark:text-green-400">{notice}</p>}
              <ErrorText message={topUp.error?.message ?? null} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Only the owner can add balance.</p>
          )}
          {data.pendingTopUps.length > 0 && (
            <ul className="space-y-1 text-sm">
              {data.pendingTopUps.map((t) => <li key={t.id} className="text-amber-700 dark:text-amber-400">Waiting for payment: {rupees(t.amount)} requested {when(t.createdAt)}</li>)}
            </ul>
          )}
          {data.isOwner && (
            <div className="flex flex-wrap items-end gap-3 border-t pt-4">
              <Field label="Warn me below (₹)">{(id) => <input id={id} type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} className={`${inputClass} w-36`} />}</Field>
              <Button variant="outline" disabled={lowBalance.isPending} onClick={() => lowBalance.mutate(Number(threshold || 0))}><Save /> Save</Button>
              {lowBalance.isSuccess && <span className="pb-2 text-sm text-green-700 dark:text-green-400">Saved</span>}
            </div>
          )}
        </div>
      </div>
      <section className="rounded-xl border bg-card">
        <h3 className="border-b px-4 py-3 text-sm font-semibold">Recent transactions</h3>
        {data.transactions.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {data.transactions.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 text-muted-foreground">{when(t.createdAt)}</td>
                  <td className="px-4 py-2">{t.note ?? { top_up: "Balance added", charge: "Message", refund: "Refund", adjustment: "Adjustment" }[t.kind]}{t.reference ? ` · ${t.reference}` : ""}</td>
                  <td className={`px-4 py-2 text-right ${Number(t.amount) < 0 ? "" : "text-green-700 dark:text-green-400"}`}>{Number(t.amount) > 0 ? "+" : ""}{rupees(t.amount, 2)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{rupees(t.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

// ---------- WhatsApp setup ----------

const words = (list: string[] | undefined) => (list ?? []).join(", ");
const toWords = (text: string) => text.split(",").map((w) => w.trim()).filter(Boolean);

const CustomProviderForm: React.FC<{ organizationId: string; data: MessagingOverview }> = ({ organizationId, data }) => {
  const save = useSaveCustomProvider(organizationId);
  const existing = data.provider?.kind === "custom_http" ? data.provider : null;
  const start = existing ? null : PROVIDER_PRESETS[0]!;
  const [name, setName] = useState(existing?.name ?? start!.name);
  const [config, setConfig] = useState<CustomConfig>(() => ({
    url: "",
    method: "POST",
    headers: [],
    bodyTemplate: "{}",
    ...(existing?.config ?? start!.config),
  }));
  const [savedSecrets, setSavedSecrets] = useState<string[]>(existing?.secretNames ?? []);
  const [secrets, setSecrets] = useState<{ name: string; value: string }[]>(() => (existing ? [] : start!.secrets.map((n) => ({ name: n, value: "" }))));
  const [removed, setRemoved] = useState<string[]>([]);
  const [help, setHelp] = useState(existing ? "" : start!.help);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const hook = config.statusWebhook;
  const setHook = (patch: Partial<NonNullable<CustomConfig["statusWebhook"]>>) =>
    setConfig({ ...config, statusWebhook: { messageIdPath: "", statusPath: "", statusMap: {}, ...hook, ...patch } });

  const applyPreset = (id: string) => {
    const preset = PROVIDER_PRESETS.find((p) => p.id === id)!;
    setName(preset.name);
    setConfig({ ...preset.config });
    setSecrets(preset.secrets.filter((n) => !savedSecrets.includes(n)).map((n) => ({ name: n, value: "" })));
    setHelp(preset.help);
  };

  const submit = () => {
    setError(null);
    const secretPayload: Record<string, string | null> = {};
    for (const s of secrets) if (s.name.trim() && s.value) secretPayload[s.name.trim()] = s.value;
    for (const n of removed) secretPayload[n] = null;
    const statusWebhook = hook?.messageIdPath && hook.statusPath ? hook : undefined;
    save.mutate(
      { name, config: { ...config, responseIdPath: config.responseIdPath || undefined, statusWebhook }, secrets: secretPayload },
      {
        onSuccess: () => {
          setSavedSecrets([...savedSecrets.filter((n) => !removed.includes(n)), ...Object.keys(secretPayload).filter((n) => secretPayload[n] !== null && !savedSecrets.includes(n))]);
          setSecrets([]);
          setRemoved([]);
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Your own provider</h3>
        <div className="flex flex-wrap gap-1 text-xs">
          <span className="self-center text-muted-foreground">Start from:</span>
          {PROVIDER_PRESETS.map((p) => <Button key={p.id} size="sm" variant="outline" onClick={() => applyPreset(p.id)}>{p.label}</Button>)}
        </div>
      </div>
      {help && <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{help}</p>}
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <Field label="Name">{(id) => <input id={id} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={inputClass} />}</Field>
        <Field label="Method">
          {(id) => (
            <select id={id} value={config.method} onChange={(e) => setConfig({ ...config, method: e.target.value as CustomConfig["method"] })} className={inputClass}>
              <option>POST</option><option>PUT</option><option>GET</option>
            </select>
          )}
        </Field>
      </div>
      <Field label="API URL" hint="Placeholders work here too, e.g. {{secret.phoneNumberId}}">{(id) => <input id={id} value={config.url} onChange={(e) => setConfig({ ...config, url: e.target.value })} className={inputClass} />}</Field>

      <div className="space-y-2">
        <p className="text-sm font-medium">Secrets <span className="font-normal text-muted-foreground">(API keys and tokens; stored encrypted and never shown again)</span></p>
        {savedSecrets.filter((n) => !removed.includes(n)).map((n) => (
          <div key={n} className="flex items-center gap-2 text-sm">
            <code className="rounded bg-muted px-2 py-1">{n}</code><span className="text-muted-foreground">saved ••••••</span>
            <Button size="sm" variant="ghost" onClick={() => setSecrets([...secrets, { name: n, value: "" }])}>Replace</Button>
            <Button size="sm" variant="ghost" onClick={() => setRemoved([...removed, n])}><Trash2 /></Button>
          </div>
        ))}
        {secrets.map((s, index) => (
          <div key={index} className="flex flex-wrap gap-2">
            <input aria-label="Secret name" value={s.name} placeholder="apiKey" onChange={(e) => setSecrets(secrets.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)))} className={`${inputClass} w-44`} />
            <input aria-label="Secret value" type="password" autoComplete="off" value={s.value} placeholder="Value" onChange={(e) => setSecrets(secrets.map((x, i) => (i === index ? { ...x, value: e.target.value } : x)))} className={`${inputClass} min-w-56 flex-1`} />
            <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setSecrets(secrets.filter((_, i) => i !== index))}><Trash2 /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setSecrets([...secrets, { name: "", value: "" }])}><Plus /> Add secret</Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Headers</p>
        {config.headers.map((h, index) => (
          <div key={index} className="flex flex-wrap gap-2">
            <input aria-label="Header name" value={h.name} placeholder="Authorization" onChange={(e) => setConfig({ ...config, headers: config.headers.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)) })} className={`${inputClass} w-44`} />
            <input aria-label="Header value" value={h.value} placeholder="Bearer {{secret.apiKey}}" onChange={(e) => setConfig({ ...config, headers: config.headers.map((x, i) => (i === index ? { ...x, value: e.target.value } : x)) })} className={`${inputClass} min-w-56 flex-1`} />
            <Button variant="ghost" size="icon" aria-label="Remove header" onClick={() => setConfig({ ...config, headers: config.headers.filter((_, i) => i !== index) })}><Trash2 /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setConfig({ ...config, headers: [...config.headers, { name: "", value: "" }] })}><Plus /> Add header</Button>
      </div>

      {config.method !== "GET" && (
        <Field label="Request body (JSON)">
          {(id) => <textarea id={id} rows={10} spellCheck={false} value={config.bodyTemplate} onChange={(e) => setConfig({ ...config, bodyTemplate: e.target.value })} className={`${inputClass} h-auto py-2 font-mono text-xs`} />}
        </Field>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Placeholders you can use</summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {data.placeholders.map((p) => <li key={p.name}><code className="text-foreground">{p.name}</code> {p.description}</li>)}
        </ul>
      </details>
      <Field label="Message id in the response (optional)" hint='Dot path, e.g. "data.messageId" or "messages.0.id". Needed to follow delivery status.'>
        {(id) => <input id={id} value={config.responseIdPath ?? ""} onChange={(e) => setConfig({ ...config, responseIdPath: e.target.value })} className={inputClass} />}
      </Field>

      <details className="space-y-3 rounded-lg border p-3" open={!!hook?.messageIdPath}>
        <summary className="cursor-pointer text-sm font-medium">Delivery status callbacks (optional)</summary>
        {existing?.statusWebhookUrl ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Give your provider this URL:</span>
            <code className="break-all rounded bg-muted px-2 py-1">{existing.statusWebhookUrl}</code>
            <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(existing.statusWebhookUrl!); setCopied(true); }}><Copy /> {copied ? "Copied" : "Copy"}</Button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Save the provider first to get its callback URL.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Message id path">{(id) => <input id={id} value={hook?.messageIdPath ?? ""} placeholder="id" onChange={(e) => setHook({ messageIdPath: e.target.value })} className={inputClass} />}</Field>
          <Field label="Status path">{(id) => <input id={id} value={hook?.statusPath ?? ""} placeholder="status" onChange={(e) => setHook({ statusPath: e.target.value })} className={inputClass} />}</Field>
          <Field label="Error path (optional)">{(id) => <input id={id} value={hook?.errorPath ?? ""} placeholder="error.message" onChange={(e) => setHook({ errorPath: e.target.value })} className={inputClass} />}</Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {(["sent", "delivered", "read", "failed"] as const).map((s) => (
            <Field key={s} label={`Words meaning “${s}”`}>
              {(id) => <input id={id} value={words(hook?.statusMap?.[s])} placeholder={s} onChange={(e) => setHook({ statusMap: { ...hook?.statusMap, [s]: toWords(e.target.value) } })} className={inputClass} />}
            </Field>
          ))}
        </div>
      </details>

      <ErrorText message={error} />
      <Button disabled={save.isPending} onClick={submit}>{save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save provider</Button>
      {save.isSuccess && <span className="ml-3 text-sm text-green-700 dark:text-green-400">Saved</span>}
    </div>
  );
};

const TemplateMappingForm: React.FC<{ organizationId: string; data: MessagingOverview }> = ({ organizationId, data }) => {
  const save = useSaveTemplates(organizationId);
  const [rows, setRows] = useState(() =>
    data.messageTypes.map((type) => {
      const saved = data.templates.find((t) => t.messageType === type.type);
      return { type, enabled: !!saved, templateName: saved?.templateName ?? "", language: saved?.language ?? "en", params: saved?.params ?? type.variables.map((v) => v.key) };
    }),
  );
  const [error, setError] = useState<string | null>(null);
  const update = (index: number, patch: Partial<(typeof rows)[number]>) => setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const submit = () => {
    setError(null);
    const enabled = rows.filter((r) => r.enabled);
    if (enabled.some((r) => !r.templateName.trim())) return setError("Enter the template or campaign name for each message you turn on.");
    const mapping: TemplateMapping[] = enabled.map((r) => ({ messageType: r.type.type, templateName: r.templateName.trim(), language: r.language || "en", params: r.params }));
    save.mutate(mapping, { onError: (e) => setError(e.message) });
  };
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h3 className="font-semibold">Template mapping</h3>
        <p className="text-sm text-muted-foreground">Which of your provider's approved templates each message uses, and the variables it fills, in order ({"{{param1}}"}, {"{{param2}}"}, … or {"{{params_json}}"}). A message without a template is not sent by WhatsApp.</p>
      </div>
      {rows.map((row, index) => (
        <div key={row.type.type} className="space-y-2 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="accent-primary" checked={row.enabled} onChange={(e) => update(index, { enabled: e.target.checked })} />
            {row.type.label}{row.type.hasDocument ? <span className="text-xs font-normal text-muted-foreground">· PDF attached as {"{{document_url}}"}</span> : null}
          </label>
          {row.enabled && (
            <>
              <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
                <input aria-label="Template name" value={row.templateName} placeholder="Template or campaign name" onChange={(e) => update(index, { templateName: e.target.value })} className={inputClass} />
                <input aria-label="Language" value={row.language} placeholder="en" onChange={(e) => update(index, { language: e.target.value })} className={inputClass} />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {row.type.variables.map((v) => {
                  const position = row.params.indexOf(v.key);
                  return (
                    <button
                      key={v.key}
                      type="button"
                      title={`e.g. ${v.example}`}
                      onClick={() => update(index, { params: position >= 0 ? row.params.filter((p) => p !== v.key) : [...row.params, v.key] })}
                      className={`rounded-full border px-2.5 py-1 ${position >= 0 ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}
                    >
                      {position >= 0 ? `${position + 1}. ` : ""}{v.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">Click variables in the order your template expects them.</p>
            </>
          )}
        </div>
      ))}
      <ErrorText message={error} />
      <Button disabled={save.isPending} onClick={submit}>{save.isPending ? <Loader2 className="animate-spin" /> : <Save />} Save mapping</Button>
      {save.isSuccess && <span className="ml-3 text-sm text-green-700 dark:text-green-400">Saved</span>}
    </div>
  );
};

const TestMessage: React.FC<{ organizationId: string; data: MessagingOverview }> = ({ organizationId, data }) => {
  const test = useSendTest(organizationId);
  const [phone, setPhone] = useState("91");
  const provider = data.provider!;
  return (
    <div className="space-y-3 rounded-xl border bg-card p-5">
      <h3 className="font-semibold">Send a test message</h3>
      <p className="text-sm text-muted-foreground">
        Free. {provider.kind === "custom_http" ? "Uses the template mapped to “Test message”." : `Uses Vetanly's “${data.vetanly.templates.test}” template.`}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="WhatsApp number" hint="Country code and number, digits only">{(id) => <input id={id} inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className={`${inputClass} w-52`} />}</Field>
        <Button disabled={test.isPending || phone.length < 11} onClick={() => test.mutate(phone)}>{test.isPending ? <Loader2 className="animate-spin" /> : <Send />} Send test</Button>
      </div>
      {test.data && (
        <p className={`flex items-center gap-2 text-sm ${test.data.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
          {test.data.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />} {test.data.message}
        </p>
      )}
      <ErrorText message={test.error?.message ?? null} />
      {!test.data && provider.lastTestAt && (
        <p className="text-xs text-muted-foreground">Last test {when(provider.lastTestAt)}: {provider.lastTestMessage}</p>
      )}
    </div>
  );
};

const WhatsAppTab: React.FC<{ organizationId: string; data: MessagingOverview }> = ({ organizationId, data }) => {
  const switchToVetanly = useUseVetanly(organizationId);
  const remove = useRemoveProvider(organizationId);
  const [choice, setChoice] = useState<"vetanly" | "custom_http" | null>(data.provider?.kind ?? null);
  const kind = data.provider?.kind ?? null;
  if (!data.isOwner) {
    return (
      <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        {kind ? `WhatsApp is sent through ${data.provider!.name}.` : "WhatsApp is not set up yet."} Only the owner can change this.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        {[
          { id: "vetanly" as const, title: "Vetanly WhatsApp", body: `Sent from Vetanly's verified WhatsApp number with your organization's name in the message. Nothing to set up. ${rupees(data.rates.whatsappVetanly)} per message.` },
          { id: "custom_http" as const, title: "Your own provider", body: `Keep your existing number: AiSensy, Meta Cloud API, Interakt, Gupshup or any provider with an HTTP API. You pay your provider; Vetanly charges ${rupees(data.rates.whatsappCustom)} per message.` },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setChoice(option.id)}
            className={`rounded-xl border p-4 text-left ${choice === option.id ? "border-primary ring-2 ring-primary/30" : "hover:bg-muted/40"}`}
          >
            <p className="flex items-center gap-2 font-semibold">
              <MessageCircle className="size-4" /> {option.title}
              {kind === option.id && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">In use</span>}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{option.body}</p>
          </button>
        ))}
      </div>

      {choice === "vetanly" && kind !== "vetanly" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-5">
          <p className="flex-1 text-sm">{kind === "custom_http" ? "Switching removes your own provider's settings and secrets." : "Messages will go out from Vetanly's number."}</p>
          <Button disabled={switchToVetanly.isPending} onClick={() => switchToVetanly.mutate(undefined)}>{switchToVetanly.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Use Vetanly WhatsApp</Button>
          <ErrorText message={switchToVetanly.error?.message ?? null} />
        </div>
      )}
      {choice === "vetanly" && kind === "vetanly" && !data.vetanly.configured && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Vetanly WhatsApp is being connected. Until then, messages are recorded as not sent and nothing is charged.</p>
      )}
      {choice === "custom_http" && <CustomProviderForm key={data.provider?.id ?? "new"} organizationId={organizationId} data={data} />}
      {kind === "custom_http" && choice === "custom_http" && <TemplateMappingForm key={`t-${data.provider!.id}`} organizationId={organizationId} data={data} />}
      {kind && choice === kind && <TestMessage organizationId={organizationId} data={data} />}
      {kind && (
        <Button variant="ghost" disabled={remove.isPending} onClick={() => { if (window.confirm("Turn off WhatsApp sending? Email keeps working.")) remove.mutate(undefined, { onSuccess: () => setChoice(null) }); }}>
          <Trash2 /> Turn off WhatsApp
        </Button>
      )}
    </div>
  );
};

// ---------- Message log ----------

const LogTab: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [offset, setOffset] = useState(0);
  const { data, isLoading, error } = useQuery(messageLogsQuery(organizationId, { status, channel, offset }));
  const type = { salary_slip: "Salary slip", loan_noc: "Loan NOC", test: "Test" } as const;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }} className={`${inputClass} w-48`}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_STYLE).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
        </select>
        <select aria-label="Channel" value={channel} onChange={(e) => { setChannel(e.target.value); setOffset(0); }} className={`${inputClass} w-40`}>
          <option value="">Email and WhatsApp</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
        </select>
      </div>
      {isLoading ? (
        <Spinner />
      ) : !data ? (
        <ErrorText message={error?.message ?? "Could not load the log."} />
      ) : data.logs.length === 0 ? (
        <EmptyState text="No messages yet." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Message</th><th className="px-3 py-2">To</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Charge</th></tr>
              </thead>
              <tbody className="divide-y">
                {data.logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{when(log.createdAt)}</td>
                    <td className="px-3 py-2">
                      {type[log.messageType]} <span className="text-xs text-muted-foreground">· {log.channel === "email" ? "Email" : log.providerKind === "vetanly" ? "Vetanly WhatsApp" : "Own provider"}</span>
                      {log.error && <span className="block text-xs text-red-600">{log.error}</span>}
                    </td>
                    <td className="px-3 py-2">{log.recipientMasked}</td>
                    <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[log.status].className}`}>{STATUS_STYLE[log.status].label}</span></td>
                    <td className="px-3 py-2 text-right">{Number(log.charge) ? `${rupees(log.charge, 2)}${log.refunded ? " refunded" : ""}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{offset + 1}–{offset + data.logs.length} of {data.total}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</Button>
              <Button size="sm" variant="outline" disabled={offset + 50 >= data.total} onClick={() => setOffset(offset + 50)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ---------- Page ----------

const AddonOff: React.FC<{ organizationId: string; data: MessagingOverview }> = ({ organizationId, data }) => {
  const request = useRequestAddon(organizationId);
  return (
    <div className="space-y-4 rounded-xl border bg-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold"><Wallet className="size-5" /> Email and WhatsApp delivery</h2>
      <p className="text-sm text-muted-foreground">
        Send salary slips and certificates straight to employees by email or WhatsApp. Without it, everyone can still view, print and download their documents in Vetanly.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Prepaid balance: each message is charged from it ({data.rates.email ? `email ${rupees(data.rates.email)}, ` : "email free, "}WhatsApp {rupees(data.rates.whatsappVetanly)} via Vetanly or {rupees(data.rates.whatsappCustom)} via your own provider).</li>
        <li>Use Vetanly's WhatsApp number, or keep your own number through AiSensy, Meta Cloud API or any provider.</li>
        <li>A log of every message with its delivery status; failed messages are refunded.</li>
      </ul>
      {data.isOwner ? (
        data.addonRequestedAt ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">Requested {when(data.addonRequestedAt)}. We'll turn it on shortly.</p>
        ) : (
          <Button disabled={request.isPending} onClick={() => request.mutate(undefined)}>{request.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Request the add-on</Button>
        )
      ) : (
        <p className="text-sm text-muted-foreground">Ask the owner to turn it on.</p>
      )}
      <ErrorText message={request.error?.message ?? null} />
    </div>
  );
};

/** The report delivery add-on: balance, WhatsApp provider and message log. Owners manage; admins read. */
const MessagingPage: React.FC = () => {
  const organizationId = getActiveOrganizationId() ?? "";
  const { data, isLoading, error } = useQuery(messagingQuery(organizationId));
  const [params, setParams] = useSearchParams();
  const tab = ["whatsapp", "log"].includes(params.get("tab") ?? "") ? params.get("tab")! : "balance";
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="Messaging" description="Send salary slips and documents by email or WhatsApp, and see what was delivered." />
      {isLoading ? (
        <Spinner />
      ) : !data ? (
        <ErrorText message={error?.message ?? "Could not load messaging."} />
      ) : !data.addonEnabled ? (
        <AddonOff organizationId={organizationId} data={data} />
      ) : (
        <>
          <div className="flex gap-1 overflow-x-auto border-b">
            {[
              { id: "balance", label: `Balance · ${rupees(data.balance)}` },
              { id: "whatsapp", label: "WhatsApp setup" },
              { id: "log", label: "Message log" },
            ].map((t) => (
              <button key={t.id} type="button" onClick={() => setParams({ tab: t.id })}
                className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t.label}{t.id === "balance" && data.lowBalance ? " ⚠" : ""}
              </button>
            ))}
          </div>
          {tab === "balance" && <BalanceTab organizationId={organizationId} data={data} />}
          {tab === "whatsapp" && <WhatsAppTab organizationId={organizationId} data={data} />}
          {tab === "log" && <LogTab organizationId={organizationId} />}
        </>
      )}
    </div>
  );
};

export default MessagingPage;
