import { NextResponse } from "next/server";
import { verifySuperadmin } from "@/lib/adminAuth";

export async function POST(req: Request) {
  const check = await verifySuperadmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Ugyldig e-postadresse." }, { status: 400 });
    }

    const { error } = await check.supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo: "https://misemetrics.app/login" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Noe gikk galt." }, { status: 500 });
  }
}
