import { createClient } from "@supabase/supabase-js";
export const authClient =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      )
    : null;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const session = authClient
    ? (await authClient.auth.getSession()).data.session
    : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (session) headers.Authorization = `Bearer ${session.access_token}`;
  const response = await fetch(`/api/${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(data.error || "Permintaan gagal", response.status);
  return data;
}
