import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Hvor lenge en portal-bestilling kan stå som "pending" før kunden får en
// påminnelse - ingen eksisterende terskel for dette i prosjektet fra før,
// 24 timer er et rimelig, hardkodet utgangspunkt.
const REMINDER_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const { data: row, error } = await supabaseAdmin
      .from("app_data")
      .select("data")
      .eq("id", "main")
      .single();

    if (error || !row) {
      return NextResponse.json({ error: "Kunne ikke hente data" }, { status: 500 });
    }

    const appData = row.data as any;
    const pending: any[] = appData.pendingPortalOrders || [];
    const customers: any[] = appData.storkjokkenCustomers || [];
    const now = Date.now();

    const due = pending.filter((p) =>
      p.status === "pending" &&
      !p.reminderSentAt &&
      now - new Date(p.submittedAt).getTime() > REMINDER_THRESHOLD_MS
    );

    if (!due.length) {
      return NextResponse.json({ ok: true, sent: 0, checked: 0 });
    }

    const updates: Record<string, any> = {};
    let sent = 0;

    for (const order of due) {
      const customer = customers.find((c) => c.id === order.customerId);
      const email = customer?.email;
      if (email && resend) {
        try {
          const result = await resend.emails.send({
            from: "Misemetrics <onboarding@resend.dev>",
            to: [email],
            subject: `Påminnelse: bestilling venter på godkjenning – levering ${order.date}`,
            html: `<p>Hei${customer?.name ? ` ${customer.name}` : ""},</p><p>Du har en bestilling for levering <b>${order.date}</b> som fortsatt venter på godkjenning fra oss. Vi kommer tilbake til deg snart - ta gjerne kontakt hvis det haster.</p>`,
          });
          console.log("Resend-svar (påminnelse):", JSON.stringify(result));
          sent++;
        } catch (e) {
          console.error("Kunne ikke sende påminnelse-e-post:", e);
        }
      } else if (!email) {
        console.error(`Påminnelse hoppet over for bestilling ${order.id}: kunden har ingen registrert e-postadresse.`);
      } else if (!resend) {
        console.error("Påminnelse hoppet over: RESEND_API_KEY er ikke satt.");
      }
      // Merkes som håndtert uansett utfall (også når e-post mangler), for å
      // unngå at cronjobben prøver på nytt hver time i det uendelige.
      updates[order.id] = { ...order, reminderSentAt: new Date().toISOString() };
    }

    const { error: rpcError } = await supabaseAdmin.rpc("update_list_items", {
      p_list_key: "pendingPortalOrders",
      p_items: updates,
    });

    if (rpcError) {
      console.error("update_list_items feilet (påminnelser):", rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sent, checked: due.length });
  } catch (e) {
    console.error("Cron-feil (pending-order-reminders):", e);
    return NextResponse.json({ error: "Noe gikk galt" }, { status: 500 });
  }
}
