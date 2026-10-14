import React, { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSendOtp, useVerifyOtp } from "@/hooks/use-api";

const VerifyOTP: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const phone: string | undefined = location.state?.phone;

  const [otp, setOtp] = useState("");
  const verify = useVerifyOtp();
  const resend = useSendOtp();
  const loading = verify.isPending;
  const resending = resend.isPending;
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!phone) return <Navigate to="/login" replace />;

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (otp.length !== 6) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    verify.mutate(
      { phone, otp },
      {
        onSuccess: () => navigate("/", { replace: true }),
        onError: (err) => setError(err.message),
      },
    );
  };

  const handleResend = () => {
    setError(null);
    setInfo(null);
    resend.mutate(phone, {
      onSuccess: () => setInfo("A new OTP has been sent."),
      onError: (err) => setError(err.message),
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-sm sm:p-8">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Change number
        </button>
        <div className="mb-6 space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Verify OTP</h1>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code sent to <span className="font-medium text-foreground">+{phone}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <input
            aria-label="OTP"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            disabled={loading}
            className="h-12 w-full rounded-md border bg-background text-center text-2xl tracking-[0.5em] outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {info && <p role="status" className="text-sm text-green-600">{info}</p>}
          <Button type="submit" size="lg" className="h-10 w-full text-sm" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            Verify
          </Button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || loading}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {resending ? "Sending..." : "Resend OTP"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerifyOTP;



