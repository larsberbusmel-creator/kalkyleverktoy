import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseWebshopEmail } from "@/lib/parseWebshopEmail";

const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const incomingSecret = searchParams.get("secret") || "";

    if (WEBHOOK_SECRET && incomingSecret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Ugyldig hemmelighet" }, { status: 401 });
    }

    const payload = await req.json();
    const textBody: string = payload.TextBody || payload.HtmlBody || "";
    const subject: string = payload.Subject || "";
    const from: string = payload.From || "";

    if (!textBody) {
      return NextResponse.json({ error: "Ingen e-posttekst" }, { status: 400 });
    }

    const { data: row, error: fetchError } = await supabaseAdmin
      .from("app_data")
      .select("data")
      .eq("id", "main")
      .single();

    if (fetchError || !row?.data) {
      return NextResponse.json({ error: "Kunne ikke hente app-data" }, { status: 500 });
    }

    const appData = row.data as {
      products: { id: string; name: string; productNumber?: string }[];
      orders: unknown[];
    };

    const result = parseWebshopEmail(textBody, appData.products);

    if (!result) {
      console.warn(`Ingen produkter matchet. Fra: ${from}, Emne: ${subject}`);
      return NextResponse.json({ ok: false, message: "Ingen produkter matchet" });
    }

    const { order, unmatched } = result;
    const updatedOrders = [order, ...(appData.orders as unknown[])];

    const { error: saveError } = await supabaseAdmin
      .from("app_data")
      .update({
        data: { ...appData, orders: updatedOrders },
        updated_at: new Date().toISOString(),
      })
      .eq("id", "main");

    if (saveError) {
      return NextResponse.json({ error: "Kunne ikke lagre ordre" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      customer: order.customer,
      orderLines: order.orderLines.length,
      unmatched,
    });
  } catch (err) {
    console.error("Inbound email feil:", err);
    return NextResponse.json({ error: "Intern serverfeil" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Inbound email endpoint er aktivt." });
}