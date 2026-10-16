import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { ApiError } from "@/lib/api";
import { platformApi } from "@/lib/platform";

export type PlatformAdminSession = { id: string; name: string };

export async function platformLoader({ request }: LoaderFunctionArgs) {
  if (!localStorage.getItem("accessToken")) return redirect("/login");
  if (new URL(request.url).pathname === "/platform/verify") return null;
  try {
    return await platformApi<PlatformAdminSession>("/me");
  } catch (error) {
    if (error instanceof ApiError && error.status === 428) {
      return redirect("/platform/verify");
    }
    if (error instanceof ApiError && error.status === 404) return redirect("/");
    throw error;
  }
}
