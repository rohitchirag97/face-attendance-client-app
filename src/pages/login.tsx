import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGoogleLogin, useSendOtp } from "@/hooks/use-api";
import { GOOGLE_CLIENT_ID, GoogleSignInButton } from "@/components/google-sign-in-button";
import { PHONE_COUNTRY_CODES } from "@/lib/countries";

const Login: React.FC = () => {
  const [countryCode, setCountryCode] = useState("91");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sendOtp = useSendOtp();
  const googleLogin = useGoogleLogin();
  const loading = sendOtp.isPending;
  const navigate = useNavigate();

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const digits = phone.replace(/\D/g, "");
    const fullPhone = `${countryCode}${digits}`;
    if (digits.length < 6 || fullPhone.length < 11) {
      setError("Enter a valid phone number.");
      return;
    }

    sendOtp.mutate(fullPhone, {
      onSuccess: () => navigate("/verify-otp", { state: { phone: fullPhone } }),
      onError: (err) => setError(err.message),
    });
  };

  return (

    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-background p-6 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <img src="/favicon.svg" alt="" className="size-12" />
          <h1 className="text-xl font-semibold tracking-tight">
            Welcome to Vetanly
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your phone number and we'll send you a one-time password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-medium">
              Phone number
            </label>
            <div className="flex gap-2">
              <select
                aria-label="Country code"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={loading}
                className="h-10 w-28 shrink-0 rounded-md border bg-background px-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                {PHONE_COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <Phone className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value.replace(/[^\d\s]/g, ""))
                  }
                  disabled={loading}
                  maxLength={15}
                  className="h-10 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            className="h-10 w-full text-sm"
            disabled={loading}
          >
            {loading && <Loader2 className="animate-spin" />}
            Send OTP
          </Button>
        </form>

        {GOOGLE_CLIENT_ID && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <GoogleSignInButton
              onCredential={(credential) =>
                googleLogin.mutate(credential, {
                  onSuccess: () => navigate("/", { replace: true }),
                  onError: (err) => setError(err.message),
                })
              }
              onError={setError}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Login;


