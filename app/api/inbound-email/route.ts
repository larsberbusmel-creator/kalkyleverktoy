import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseWebshopEmail } from "@/lib/parseWebshopEmail";

const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_SECRET || "";

// Portalen er i dag knyttet til ÉTT bestemt sted (Berbusmel) via denne faste
// rad-ID-en. Får dere et andre, reelt sted med egen webshop senere, holder
// ikke denne løsningen - da trengs en mer fleksibel mekanisme (f.eks. egen
// e-postadresse/subdomene per sted, mappet til riktig rad-ID). Bevisst
// utenfor omfanget av denne hastefiksen.
const SITE_ROW_ID = process.env.PORTAL_SITE_ROW_ID || "main";

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
      .eq("id", SITE_ROW_ID)
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

    if (result.type === "cancellation") {
      const { orderNumber, reason } = result;
      const existingIndex = appData.orders.findIndex(
        (o: any) => o.orderNumber && o.orderNumber === orderNumber && !o.deletedAt
      );

      if (existingIndex < 0) {
        console.warn(`Kanselleringsmail mottatt for ordrenr ${orderNumber} - ingen matchende, ikke-slettet ordre funnet.`);
        return NextResponse.json({ ok: true, action: "cancelled", orderNumber, found: false });
      }

      const existing = appData.orders[existingIndex];
      const cancelNote = reason ? `Kansellert av kunde: ${reason}` : "Kansellert av kunde";
      const cancelledOrder = {
        ...existing,
        deletedAt: new Date().toISOString(),
        note: [existing.note, cancelNote].filter(Boolean).join("\n\n"),
      };
      const updatedOrders = appData.orders.map((o: any, i: number) => (i === existingIndex ? cancelledOrder : o));

      const { error: cancelSaveError } = await supabaseAdmin
        .from("app_data")
        .update({
          data: { ...appData, orders: updatedOrders },
          updated_at: new Date().toISOString(),
        })
        .eq("id", SITE_ROW_ID);

      if (cancelSaveError) {
        console.error("Kunne ikke lagre kansellering:", cancelSaveError);
        return NextResponse.json({ error: "Kunne ikke lagre kansellering" }, { status: 500 });
      }

      console.log(`❌ Ordre kansellert: ${orderNumber} | Årsak: ${reason || "(ikke oppgitt)"}`);
      return NextResponse.json({ ok: true, action: "cancelled", orderNumber, found: true });
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
      .eq("id", SITE_ROW_ID);

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