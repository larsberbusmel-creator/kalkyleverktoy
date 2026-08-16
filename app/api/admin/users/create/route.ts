import { NextResponse } from "next/server";
import { verifySuperadmin } from "@/lib/adminAuth";

export async function POST(req: Request) {
  const check = await verifySuperadmin(req);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  try {
    const { email, name } = await req.json();
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Ugyldig e-postadresse." }, { status: 400 });
    }

    const { data, error } = await check.supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: "https://misemetrics.app/login",
        ...(name && typeof name === "string" && name.trim() ? { data: { name: name.trim() } } : {}),
      }
    );

    if (error || !data?.user) {
      return NextResponse.json({ error: error?.message || "Kunne ikke opprette innlogging." }, { status: 500 });
    }

    return NextResponse.json({ authUserId: data.user.id });
  } catch (e) {
    return NextResponse.json({ error: "Noe gikk galt." }, { status: 500 });
  }
}
