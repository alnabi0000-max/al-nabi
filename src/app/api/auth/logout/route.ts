import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const res = NextResponse.json({ ok: true, message: "Signed out" });
  clearSessionCookie(res);

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      if (supabase) await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
  }

  return res;
}
