import { useEffect, useRef } from "react";

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

type GoogleId = {
  initialize: (config: { client_id: string; callback: (res: { credential: string }) => void }) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
};

const getGoogleId = () => (window as unknown as { google?: { accounts: { id: GoogleId } } }).google?.accounts.id;

const loadScript = () =>
  new Promise<void>((resolve, reject) => {
    if (getGoogleId()) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("Could not load Google sign-in")));
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

export function GoogleSignInButton({
  onCredential,
  onError,
}: {
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onCredential, onError });
  useEffect(() => {
    handlers.current = { onCredential, onError };
  });

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        const google = getGoogleId();
        if (cancelled || !google || !container.current) return;
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (res) => handlers.current.onCredential(res.credential),
        });
        google.renderButton(container.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: container.current.clientWidth || 320,
        });
      })
      .catch((err: Error) => handlers.current.onError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!GOOGLE_CLIENT_ID) return null;
  return <div ref={container} className="flex min-h-10 w-full justify-center" />;
}
