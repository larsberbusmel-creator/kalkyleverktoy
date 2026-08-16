import { NextResponse } from "next/server";
import { verifySuperadmin } from "@/lib/adminAuth";

export async function POST(req: Request) {
  const check = await verifySuperadmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const { authUserId } = await req.json();
    if (!authUserId || typeof authUserId !== "string") {
      return NextResponse.json({ error: "Mangler authUserId." }, { status: 400 });
    }

    // Sletter kun innloggingskontoen i Supabase Auth. Raden i data.userAccess
    // fjernes bevisst IKKE her - klienten håndterer det som et eget steg.
    const { error } = await check.supabaseAdmin.auth.admin.deleteUser(authUserId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Noe gikk galt." }, { status: 500 });
  }
}
