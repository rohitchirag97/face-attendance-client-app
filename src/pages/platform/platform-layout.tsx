import React from "react";
import { Activity, Building2, CreditCard, FileText, LayoutDashboard, LogOut, MessageCircle, ShieldCheck } from "lucide-react";
import { Link, NavLink, Outlet, useLoaderData, useNavigate } from "react-router";

import { signOut } from "@/lib/api";
import { platformApi } from "@/lib/platform";
import type { PlatformAdminSession } from "./platform-loader";
import "./platform.css";

const navigation = [
  { to: "/platform", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/platform/organizations", label: "Organizations", icon: Building2, end: false },
  { to: "/platform/plans", label: "Plans", icon: CreditCard, end: false },
  { to: "/platform/invoices", label: "Invoices", icon: FileText, end: false },
  { to: "/platform/messaging", label: "Messaging", icon: MessageCircle, end: false },
  { to: "/platform/audit", label: "Platform audit", icon: Activity, end: false },
];

export function PlatformLayout() {
  const admin = useLoaderData() as PlatformAdminSession | null;
  const navigate = useNavigate();
  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="platform-shell dark min-h-screen bg-[#0b1220] text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/95">
        <div className="mx-auto flex max-w-360 flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" className="size-10" />
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">VETANLY</p>
              <p className="text-xs text-slate-400">Platform control room</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:inline">{admin?.name ?? "Verified platform admin"}</span>
            <Link to="/" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
              Customer app
            </Link>
            <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-360 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8 lg:py-8">
        <aside className="rounded-2xl border border-white/10 bg-slate-900/70 p-3 lg:h-fit">
          <div className="px-3 pb-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</div>
          <nav className="flex gap-2 overflow-x-auto lg:flex-col">
            {navigation.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => `inline-flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? "bg-sky-400/10 text-sky-200 ring-1 ring-inset ring-sky-300/20" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-5 hidden rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs leading-5 text-slate-500 lg:block">
            Billing profiles, plan assignments, and platform invoices are managed here. Employee and operational records stay behind organization access controls.
          </div>
        </aside>
        <main className="min-w-0 text-slate-900 dark:text-slate-100">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PlatformReauthPage() {
  const navigate = useNavigate();
  const [otp, setOtp] = React.useState("");
  const [message, setMessage] = React.useState("A fresh verification code is required to open the platform console.");
  const [error, setError] = React.useState("");
  // A code is requested as soon as the page opens, so it starts out sending.
  const [sending, setSending] = React.useState(true);
  const [verifying, setVerifying] = React.useState(false);
  const [resendIn, setResendIn] = React.useState(0);
  const requested = React.useRef(false);

  const sendCode = React.useCallback(async () => {
    try {
      const result = await platformApi<{ resendInSeconds?: number; alreadySent?: boolean }>("/reauth/send-otp", { method: "POST" });
      setMessage(result?.alreadySent
        ? "A code was sent to your account phone moments ago. Use that code."
        : "Verification code sent to your account phone.");
      setResendIn(result?.resendInSeconds ?? 60);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send a code.");
    } finally {
      setSending(false);
    }
  }, []);

  // React's development mode runs effects twice; the ref keeps this to one request per visit.
  React.useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    void sendCode();
  }, [sendCode]);

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const resend = () => {
    setError("");
    setSending(true);
    void sendCode();
  };

  const verify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setVerifying(true);
    try {
      await platformApi("/reauth/verify-otp", { method: "POST", body: { otp } });
      navigate("/platform", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[65vh] max-w-md items-center">
      <section className="w-full rounded-3xl border border-white/10 bg-slate-900 p-7 text-slate-100 shadow-2xl shadow-black/30">
        <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-sky-400/10 text-sky-300"><ShieldCheck className="size-6" /></div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Step-up verification</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Verify it’s you</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{message} Platform access lasts 30 minutes after verification.</p>
        {sending && <p role="status" className="mt-4 text-sm text-slate-400">Sending code…</p>}
        <form className="mt-6 space-y-4" onSubmit={(event) => void verify(event)}>
          <label className="block text-sm font-medium text-slate-300" htmlFor="platform-otp">Six-digit code</label>
          <input id="platform-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} className="h-12 w-full rounded-xl border border-white/10 bg-slate-950 px-4 text-center text-lg tracking-[0.35em] text-white outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20" />
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          <button type="submit" disabled={verifying || otp.length !== 6} className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50">{verifying ? "Verifying…" : "Open platform console"}</button>
        </form>
        <div className="mt-4 text-center text-sm">
          {resendIn > 0 ? (
            <span className="text-slate-500">Resend code in {resendIn}s</span>
          ) : (
            <button type="button" onClick={resend} disabled={sending} className="font-medium text-sky-300 hover:text-sky-200 disabled:opacity-50">Resend code</button>
          )}
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-500">The code expires after 10 minutes. Failed attempts are rate-limited.</p>
      </section>
    </div>
  );
}

