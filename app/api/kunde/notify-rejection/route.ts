import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Portalen er i dag knyttet til ÉTT bestemt sted (Berbusmel) via denne faste
// rad-ID-en. Får dere et andre, reelt sted med egne storkjøkkenkunder senere,
// holder ikke denne løsningen - da trengs en mer fleksibel mekanisme (f.eks.
// egen portal-URL/subdomene per sted, eller søk etter PIN-kode på tvers av
// alle site-rader). Bevisst utenfor omfanget av denne oppgaven.
const SITE_ROW_ID = process.env.PORTAL_SITE_ROW_ID || "main";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Kalt (fire-and-forget) fra rejectPendingPortalOrder() i hovedappen rett
// etter at avvisningen selv er lagret. Ingen PIN her - dette er et internt
// varslings-kall fra hovedappen (innlogget admin), ikke fra portalen/kunden
// selv, så autorisasjon skjer allerede der (canEdit-sjekk på Ordre-fanen).
export async function POST(req: Request) {
  try {
    const { customerId, orderId } = await req.json();
    if (!customerId || !orderId) {
      return NextResponse.json({ error: "Mangler felt" }, { status: 400 });
    }

    const { data: row, error } = await supabaseAdmin
      .from("app_data")
      .select("data")
      .eq("id", SITE_ROW_ID)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Kunne ikke hente data" }, { status: 500 });
    }

    const appData = row.data as any;
    const customer = (appData.storkjokkenCustomers || []).find((c: any) => c.id === customerId);
    if (!customer) {
      return NextResponse.json({ ok: true, skipped: "customer-not-found" });
    }

    // Samme "hopp stille over"-prinsipp som resten av varslingskoden bruker
    // for manglende mottakere - ingen feil, bare ingen e-post sendt.
    if (!customer.email) {
      return NextResponse.json({ ok: true, skipped: "no-email" });
    }

    const order = (appData.pendingPortalOrders || []).find((p: any) => p.id === orderId);
    if (!order) {
      return NextResponse.json({ ok: true, skipped: "order-not-found" });
    }

    if (!resend) {
      console.error("Resend-varsel (avvisning) hoppet over: RESEND_API_KEY er ikke satt.");
      return NextResponse.json({ ok: true, skipped: "no-resend" });
    }

    try {
      const result = await resend.emails.send({
        from: "Misemetrics <onboarding@resend.dev>",
        to: [customer.email],
        subject: `Din bestilling for ${order.date} ble avvist`,
        html: `<p>Hei${customer.name ? ` ${customer.name}` : ""},</p><p>Din bestilling for levering <b>${order.date}</b> ble dessverre avvist. Logg inn i portalen for detaljer, eller ta kontakt med oss hvis du lurer på noe.</p>`,
      });
      console.log("Resend-svar (avvisning):", JSON.stringify(result));
    } catch (e) {
      console.error("Kunne ikke sende avvisning-varsel-e-post:", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Noe gikk galt" }, { status: 500 });
  }
}
