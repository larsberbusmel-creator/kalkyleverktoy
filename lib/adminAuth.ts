import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SuperadminCheck =
  | { ok: true; email: string; supabaseAdmin: SupabaseClient }
  | { ok: false; status: number; error: string };

// Server-side-only authorization gate for app/api/admin/* routes. Never trust an
// email or role sent in the request body — always re-derive identity from the
// bearer token, then re-check role against app_data.userAccess, which is the
// same source of truth the UI uses. The UI hiding a button is cosmetic only.
export async function verifySuperadmin(req: Request): Promise<SuperadminCheck> {
  if (!supabaseAdmin) {
    return { ok: false, status: 500, error: "Server er ikke konfigurert (mangler SUPABASE_SERVICE_ROLE_KEY)." };
  }

  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  const token = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return { ok: false, status: 401, error: "Mangler innloggingstoken." };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  const email = userData?.user?.email;
  if (userError || !email) {
    return { ok: false, status: 401, error: "Ugyldig eller utløpt innlogging." };
  }

  const { data: row, error: rowError } = await supabaseAdmin
    .from("app_data")
    .select("data")
    .eq("id", "main")
    .single();

  if (rowError || !row) {
    return { ok: false, status: 500, error: "Kunne ikke hente brukerdata." };
  }

  const userAccess = ((row.data as any)?.userAccess || []) as { email: string; role: string }[];
  const isSuperadmin = userAccess.some(
    (u) => u.email?.toLowerCase() === email.toLowerCase() && u.role === "superadmin"
  );

  if (!isSuperadmin) {
    return { ok: false, status: 403, error: "Du har ikke superadmin-tilgang." };
  }

  return { ok: true, email, supabaseAdmin };
}
