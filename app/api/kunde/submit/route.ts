import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendOrderNotification(customerName: string, date: string, lines: { productId: string; quantity: number }[], products: any[], notificationEmails: string[]) {
  const recipients = notificationEmails.length ? notificationEmails : (process.env.NOTIFY_EMAIL ? [process.env.NOTIFY_EMAIL] : []);
  if (!resend) {
    console.error("Resend-varsel hoppet over: RESEND_API_KEY er ikke satt.");
    return;
  }
  if (!recipients.length) {
    console.error("Resend-varsel hoppet over: ingen mottakere funnet (verken i Innstillinger eller NOTIFY_EMAIL).");
    return;
  }
  const productName = (id: string) => products.find((p: any) => p.id === id)?.name || "Ukjent";
  const linesHtml = lines.map((l) => `<li>${l.quantity} × ${productName(l.productId)}</li>`).join("");
  try {
    const result = await resend.emails.send({
      from: "Misemetrics <onboarding@resend.dev>",
      to: recipients,
      subject: `Ny bestilling fra ${customerName} – levering ${date}`,
      html: `<p><b>${customerName}</b> har sendt inn en bestilling for levering <b>${date}</b>:</p><ul>${linesHtml}</ul><p>Logg inn i appen for å godkjenne.</p>`,
    });
    console.log("Resend-svar:", JSON.stringify(result));
  } catch (e) {
    console.error("Kunne ikke sende varsel-e-post:", e);
  }
}

export async function POST(req: Request) {
  try {
    const { pin, date, lines, wantsDelivery } = await req.json();
    if (!pin || !date || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: "Mangler felt" }, { status: 400 });
    }

    const { data: row, error } = await supabaseAdmin
      .from("app_data")
      .select("data")
      .limit(1)
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Kunne ikke hente data" }, { status: 500 });
    }

    const appData = row.data as any;
    const customer = (appData.storkjokkenCustomers || []).find(
      (c: any) => c.pin === pin && c.active !== false
    );
    if (!customer) {
      return NextResponse.json({ error: "Feil PIN-kode" }, { status: 401 });
    }

    const cleanLines = lines
      .map((l: any) => {
        const product = (appData.products || []).find((p: any) => p.id === l.productId);
        const unitsPerCase = Number(product?.unitsPerCase) || 1;
        return { productId: String(l.productId), quantity: (Number(l.quantity) || 0) * unitsPerCase };
      })
      .filter((l: any) => l.quantity > 0);

    if (wantsDelivery && customer.deliveryAvailable) {
      const deliveryProduct = (appData.products || []).find((p: any) => p.isDeliveryProduct);
      if (deliveryProduct) cleanLines.push({ productId: deliveryProduct.id, quantity: 1 });
    }

    if (!cleanLines.length) {
      return NextResponse.json({ error: "Ingen varer valgt" }, { status: 400 });
    }

    const newOrder = {
      id: `portal-${Date.now()}`,
      customerId: customer.id,
      date,
      lines: cleanLines,
      submittedAt: new Date().toISOString(),
      status: "pending",
    };

    // Reuses the same merge RPC the main app uses for safe concurrent list updates.
    const { error: rpcError } = await supabaseAdmin.rpc("update_list_items", {
      p_list_key: "pendingPortalOrders",
      p_items: { [newOrder.id]: newOrder },
    });

    if (rpcError) {
      console.error("update_list_items feilet:", rpcError);
      return NextResponse.json({ error: `Kunne ikke lagre bestillingen: ${rpcError.message}` }, { status: 500 });
    }

    await sendOrderNotification(customer.name, date, cleanLines, appData.products || [], appData.settings?.notificationEmails || []);

    return NextResponse.json({ ok: true, orderId: newOrder.id });
  } catch (e) {
    return NextResponse.json({ error: "Noe gikk galt" }, { status: 500 });
  }
}