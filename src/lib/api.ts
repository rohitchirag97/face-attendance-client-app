import { API_URL } from "@/lib/config";
import { clearSession } from "@/lib/session";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
};

type RefreshResponse = {
  data?: {
    accessToken?: string;
  };
  message?: string;
};

let refreshRequest: Promise<string> | null = null;

const expireSession = () => {
  clearSession();
  window.location.replace("/login");
};

const refreshAccessToken = (): Promise<string> => {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        expireSession();
        throw new ApiError("Your session has expired. Please sign in again.", 401);
      }

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const json = (await response.json().catch(() => null)) as RefreshResponse | null;
      const accessToken = json?.data?.accessToken;

      if (!response.ok || typeof accessToken !== "string") {
        expireSession();
        throw new ApiError(
          json?.message ?? "Your session has expired. Please sign in again.",
          response.status || 401,
        );
      }

      localStorage.setItem("accessToken", accessToken);
      return accessToken;
    })().finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
};

export async function signOut() {
  try {
    await api("/auth/logout", { method: "POST", auth: true });
  } catch {
    // The session is cleared locally even if the server is unreachable.
  }
  clearSession();
}

/** Authenticated file download that saves the response as a file. */
export async function apiDownload(path: string): Promise<void> {
  const send = (token: string | null) =>
    fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

  let token = localStorage.getItem("accessToken");
  let res = await send(token);
  if (res.status === 401) {
    const current = localStorage.getItem("accessToken");
    token = current && current !== token ? current : await refreshAccessToken();
    res = await send(token);
    if (res.status === 401) expireSession();
  }
  if (res.status === 428 && path.startsWith("/platform")) {
    window.location.replace("/platform/verify");
    throw new ApiError("Platform verification is required.", 428);
  }
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new ApiError(json?.message ?? "Could not generate the report", res.status);
  }
  const name =
    /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "report";
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export async function api<T = unknown>(
  path: string,
  { method = "GET", body, auth = false }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  const serializedBody =
    body === undefined ? undefined : isForm ? body : JSON.stringify(body);

  const sendRequest = (accessToken: string | null) => {
    const requestHeaders = { ...headers };
    if (auth && accessToken) requestHeaders.Authorization = `Bearer ${accessToken}`;
    return fetch(`${API_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: serializedBody,
    });
  };

  let accessToken = auth ? localStorage.getItem("accessToken") : null;
  let res = await sendRequest(accessToken);

  if (res.status === 401 && auth) {
    const currentAccessToken = localStorage.getItem("accessToken");
    accessToken =
      currentAccessToken && currentAccessToken !== accessToken
        ? currentAccessToken
        : await refreshAccessToken();

    res = await sendRequest(accessToken);
    if (res.status === 401) {
      expireSession();
    }
  }

  if (res.status === 428 && path.startsWith("/platform") && !path.includes("/reauth/")) {
    window.location.replace("/platform/verify");
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(json?.message ?? "Something went wrong", res.status);
  return json as T;
}
