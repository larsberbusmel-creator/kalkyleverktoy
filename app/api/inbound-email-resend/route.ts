import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseWebshopEmail } from "@/lib/parseWebshopEmail";

// Parallell rute til app/api/inbound-email/route.ts (Postmark) - IKKE en
// erstatning. Samme nedstrøms-flyt (hent app_data, parseWebshopEmail,
// match på orderNumber, opprett/oppdater, lagre), men henter selve
// e-postinnholdet i to steg slik Resend krever: (1) verifiser
// webhook-signaturen og les email_id fra "email.received"-eventet, (2)
// hent fullt innhold (html/text) via Resend sin Receiving API med den id-en.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || "";

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
    if (!resend) {
      return NextResponse.json({ error: "Resend ikke konfigurert (RESEND_API_KEY mangler)" }, { status: 500 });
    }
    if (!RESEND_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET er ikke satt" }, { status: 500 });
    }

    // Svix/Standard Webhooks krever den EKSAKTE, uparsede body-strengen for
    // signaturberegningen - IKKE req.json() her.
    const rawBody = await req.text();
    const svixId = req.headers.get("svix-id") || "";
    const svixTimestamp = req.headers.get("svix-timestamp") || "";
    const svixSignature = req.headers.get("svix-signature") || "";

    let event;
    try {
      event = resend.webhooks.verify({
        payload: rawBody,
        headers: { id: svixId, timestamp: svixTimestamp, signature: svixSignature },
        webhookSecret: RESEND_WEBHOOK_SECRET,
      });
    } catch (err) {
      console.error("Ugyldig Resend webhook-signatur:", err);
      return NextResponse.json({ error: "Ugyldig signatur" }, { status: 401 });
    }

    // Resend kan sende flere event-typer til samme endepunkt (leverings-
    // kvitteringer, åpninger osv.) - ignorer alt annet enn selve mottaket.
    if (event.type !== "email.received") {
      return NextResponse.json({ ok: true, ignored: event.type });
    }

    const emailId = event.data.email_id;
    const { data: receivedEmail, error: receivingError } = await resend.emails.receiving.get(emailId);

    if (receivingError || !receivedEmail) {
      console.error("Kunne ikke hente e-postinnhold fra Resend:", receivingError);
      return NextResponse.json({ error: "Kunne ikke hente e-postinnhold" }, { status: 500 });
    }

    const textBody: string = receivedEmail.text || receivedEmail.html || "";
    const subject: string = receivedEmail.subject || "";
    const from: string = receivedEmail.from || "";

    if (!textBody) {
      return NextResponse.json({ error: "Ingen e-posttekst" }, { status: 400 });
    }

    // ── Fra herav: EKSAKT samme flyt som Postmark-ruten ────────────────────

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
    console.error("Inbound email (Resend) feil:", err);
    return NextResponse.json({ error: "Intern serverfeil" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Inbound email (Resend) endpoint er aktivt." });
}
