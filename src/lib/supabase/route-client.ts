import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/auth/config";
import {
  supabaseCookieOptions,
  withPersistentCookieOptions,
} from "@/lib/auth/session-ttl";

type PendingCookie = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

/**
 * Route-handler Supabase client that copies auth cookies onto the JSON
 * response. `cookies().set` can be a no-op in some handler contexts; attaching
 * Set-Cookie on the returned NextResponse is what actually logs the user in.
 */
export function createRouteHandlerClient(request: NextRequest): {
  supabase: SupabaseClient;
  applyCookies: <T extends NextResponse>(response: T) => T;
} | null {
  if (!isSupabaseConfigured()) return null;

  const pending: PendingCookie[] = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pending.push({ name, value, options: options || {} });
            request.cookies.set(name, value);
          });
        },
      },
    }
  );

  return {
    supabase,
    applyCookies(response) {
      for (const { name, value, options } of pending) {
        response.cookies.set(
          name,
          value,
          withPersistentCookieOptions(options)
        );
      }
      return response;
    },
  };
}
