import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseWebshopEmail } from "@/lib/parseWebshopEmail";

const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Supabase ikke konfigurert" }, { status: 500 });
    }

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

    // Hent gjeldende app-data
    const { data: row, error: fetchError } = await supabaseAdmin
      .from("app_data")
      .select("data")
      .eq("id", "main")
      .single();

    if (fetchError || !row?.data) {
      console.error("Kunne ikke hente app_data:", fetchError);
      return NextResponse.json({ error: "Kunne ikke hente app-data" }, { status: 500 });
    }

    const appData = row.data as {
      products: { id: string; name: string; productNumber?: string }[];
      orders: any[];
    };

    // Parser e-posten
    const result = parseWebshopEmail(textBody, appData.products);

    if (!result) {
  console.warn(`Ingen produkter matchet. Fra: ${from}, Emne: ${subject}`);
  console.warn(`Produkter i databasen: ${appData.products.map((p) => p.productNumber).join(", ")}`);
  console.warn(`TextBody (første 500 tegn): ${textBody.slice(0, 500)}`);
  return NextResponse.json({
    ok: false,
    message: "Ingen produkter matchet – ordre ikke opprettet",
    produkterIDatabase: appData.products.map((p) => p.productNumber),
  });
}

    const { order, unmatched } = result;

    // Sjekk om ordre med samme ordrenr allerede finnes
    const existingIndex = appData.orders.findIndex(
      (o: any) => o.orderNumber && o.orderNumber === order.orderNumber && !o.deletedAt
    );

    let updatedOrders: any[];
    let action: "created" | "updated";

    if (existingIndex >= 0) {
      // Oppdater eksisterende ordre – behold id
      const existingId = appData.orders[existingIndex].id;
      updatedOrders = appData.orders.map((o: any, i: number) =>
        i === existingIndex ? { ...order, id: existingId } : o
      );
      action = "updated";
      console.log(`🔄 Ordre oppdatert: ${order.orderNumber} | Kunde: ${order.customer}`);
    } else {
      // Ny ordre
      updatedOrders = [order, ...appData.orders];
      action = "created";
      console.log(`✅ Ordre opprettet: ${order.id} | Kunde: ${order.customer}`);
    }

    const { error: saveError } = await supabaseAdmin
      .from("app_data")
      .update({
        data: { ...appData, orders: updatedOrders },
        updated_at: new Date().toISOString(),
      })
      .eq("id", "main");

    if (saveError) {
      console.error("Kunne ikke lagre ordre:", saveError);
      return NextResponse.json({ error: "Kunne ikke lagre ordre" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      action,
      orderId: order.id,
      orderNumber: order.orderNumber,
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