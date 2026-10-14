import React, { useState } from "react";
import { CheckCircle2, Loader2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GOOGLE_CLIENT_ID, GoogleSignInButton } from "@/components/google-sign-in-button";
import { useLinkGoogle, useSendLinkPhoneOtp, useVerifyLinkPhone } from "@/hooks/use-api";
import { PHONE_COUNTRY_CODES } from "@/lib/countries";
import { displayPhone, type User } from "@/lib/session";

const inputClass =
  "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

const Linked: React.FC = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
    <CheckCircle2 className="size-3" /> Linked
  </span>
);

const PhoneLinker: React.FC<{ onDone: () => void; onCancel: () => void }> = ({ onDone, onCancel }) => {
  const [countryCode, setCountryCode] = useState("91");
  const [number, setNumber] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = useSendLinkPhoneOtp();
  const verify = useVerifyLinkPhone();
  const busy = send.isPending || verify.isPending;

  const sendCode = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const digits = number.replace(/\D/g, "");
    const phone = `${countryCode}${digits}`;
    if (digits.length < 6 || phone.length < 11) {
      setError("Enter a valid phone number.");
      return;
    }
    send.mutate(phone, {
      onSuccess: () => {
        setOtp("");
        setSentTo(phone);
      },
      onError: (err) => setError(err.message),
    });
  };

  const verifyCode = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!sentTo) return;
    if (otp.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    verify.mutate({ phone: sentTo, otp }, { onSuccess: onDone, onError: (err) => setError(err.message) });
  };

  return sentTo ? (
    <form onSubmit={verifyCode} className="mt-3 space-y-3" noValidate>
      <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to +{sentTo}.</p>
      <input
        aria-label="OTP"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={otp}
        disabled={busy}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
        className={`${inputClass} max-w-40 tracking-[0.4em]`}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-9" disabled={busy}>
          {verify.isPending && <Loader2 className="animate-spin" />} Verify and link
        </Button>
        <Button type="button" variant="ghost" className="h-9" disabled={busy} onClick={() => setSentTo(null)}>
          Use a different number
        </Button>
      </div>
    </form>
  ) : (
    <form onSubmit={sendCode} className="mt-3 space-y-3" noValidate>
      <div className="flex max-w-md gap-2">
        <select
          aria-label="Country code"
          value={countryCode}
          disabled={busy}
          onChange={(e) => setCountryCode(e.target.value)}
          className="h-10 w-28 shrink-0 rounded-md border bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        >
          {PHONE_COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
        <input
          aria-label="Phone number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98765 43210"
          autoFocus
          maxLength={15}
          value={number}
          disabled={busy}
          onChange={(e) => setNumber(e.target.value.replace(/[^\d\s]/g, ""))}
          className={inputClass}
        />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" className="h-9" disabled={busy}>
          {send.isPending && <Loader2 className="animate-spin" />} Send OTP
        </Button>
        <Button type="button" variant="ghost" className="h-9" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

/** Lets a user sign in with both their phone (OTP) and Google by linking whichever one is missing. */
const SignInMethods: React.FC<{ user: User; onUpdated: () => void }> = ({ user, onUpdated }) => {
  const [linkingPhone, setLinkingPhone] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const linkGoogle = useLinkGoogle();

  const phone = displayPhone(user);
  const phoneLinked = Boolean(phone && user.phoneVerified);
  const googleLinked = Boolean(user.email && user.emailVerified);

  const handleCredential = (credential: string) => {
    setGoogleError(null);
    linkGoogle.mutate(credential, {
      onSuccess: () => {
        setLinkingGoogle(false);
        setNotice("Google account linked. You can now sign in with Google.");
        onUpdated();
      },
      onError: (err) => setGoogleError(err.message),
    });
  };

  return (
    <section className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Sign-in methods</h2>
        <p className="text-sm text-muted-foreground">
          Link both so you can sign in with your phone number or your Google account.
        </p>
      </div>

      <div className="divide-y">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Phone className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Phone number (OTP)</p>
              <p className="truncate text-sm text-muted-foreground">
                {phone ?? "Not linked"}
                {phone && !user.phoneVerified && " · not verified"}
              </p>
            </div>
            {phoneLinked && <Linked />}
            {!linkingPhone && (
              <Button variant="outline" className="h-8" onClick={() => { setNotice(null); setLinkingPhone(true); }}>
                {!phone ? "Link phone" : phoneLinked ? "Change" : "Verify"}
              </Button>
            )}
          </div>
          {linkingPhone && (
            <PhoneLinker
              onCancel={() => setLinkingPhone(false)}
              onDone={() => {
                setLinkingPhone(false);
                setNotice("Phone number linked. You can now sign in with an OTP.");
                onUpdated();
              }}
            />
          )}
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Mail className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Google account</p>
              <p className="truncate text-sm text-muted-foreground">
                {googleLinked ? user.email : "Not linked"}
              </p>
            </div>
            {googleLinked && <Linked />}
            {GOOGLE_CLIENT_ID && !linkingGoogle && (
              <Button variant="outline" className="h-8" onClick={() => { setNotice(null); setLinkingGoogle(true); }}>
                {googleLinked ? "Change" : "Link Google"}
              </Button>
            )}
          </div>
          {!GOOGLE_CLIENT_ID && (
            <p className="mt-2 text-sm text-muted-foreground">Google sign-in is not configured.</p>
          )}
          {linkingGoogle && (
            <div className="mt-3 max-w-xs space-y-2">
              {linkGoogle.isPending ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Linking your Google account…
                </p>
              ) : (
                <GoogleSignInButton onCredential={handleCredential} onError={setGoogleError} />
              )}
              <Button variant="ghost" className="h-8" disabled={linkGoogle.isPending} onClick={() => setLinkingGoogle(false)}>
                Cancel
              </Button>
            </div>
          )}
          {googleError && <p role="alert" className="mt-2 text-sm text-destructive">{googleError}</p>}
        </div>
      </div>

      {notice && (
        <p role="status" className="border-t px-4 py-3 text-sm text-green-600">{notice}</p>
      )}
    </section>
  );
};

export default SignInMethods;
