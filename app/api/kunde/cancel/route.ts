import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

function getDeadlineForDate(deadlines: any, date: string) {
  const exception = deadlines?.exceptions?.[date];
  if (exception) return { closed: !!exception.closed, cutoffTime: exception.cutoffTime || "12:00" };
  const dow = new Date(date + "T00:00:00").getDay();
  const weekdayNum = dow === 0 ? 7 : dow;
  const wd = deadlines?.weekday?.[weekdayNum];
  return { closed: !!wd?.closed, cutoffTime: wd?.cutoffTime || "12:00" };
}

function isPastDeadline(deadlines: any, date: string) {
  const d = getDeadlineForDate(deadlines, date);
  if (d.closed) return true;
  const cutoff = new Date(date + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - 1);
  const [h, m] = d.cutoffTime.split(":").map(Number);
  cutoff.setHours(h, m, 0, 0);
  return new Date() > cutoff;
}

export async function POST(req: Request) {
  try {
    const { pin, orderId, kind, reason } = await req.json(); // kind: "pending" | "pickup" | "recurring", reason: "cancel" | "edit"
    if (!pin || !orderId || !kind) {
      return NextResponse.json({ error: "Mangler felt" }, { status: 400 });
    }

    const { data: row, error } = await supabaseAdmin
      .from("app_data")
      .select("data")
      .eq("id", "main")
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

    const deadlines = appData.portalDeadlines || { weekday: { 7: { closed: true } }, exceptions: {} };

    function pushCancelNotification(date: string, lines: { productId: string; quantity: number }[]) {
      const productName = (id: string) => (appData.products || []).find((prod: any) => prod.id === id)?.name || "Ukjent";
      appData.cancelledOrderNotifications = [
        ...(appData.cancelledOrderNotifications || []),
        {
          id: `cancelnote-${Date.now()}`,
          customerId: customer.id,
          customerName: customer.name,
          date,
          lines: lines.map((l) => ({ productName: productName(l.productId), quantity: l.quantity })),
          cancelledAt: new Date().toISOString(),
          type: reason === "edit" ? "edited" : "cancelled",
        },
      ];
    }

    if (kind === "pending") {
      const order = (appData.pendingPortalOrders || []).find((o: any) => o.id === orderId);
      if (!order || order.customerId !== customer.id) {
        return NextResponse.json({ error: "Fant ikke bestillingen" }, { status: 404 });
      }
      if (isPastDeadline(deadlines, order.date)) {
        return NextResponse.json({ error: "Fristen for denne datoen er passert, kan ikke avbestille." }, { status: 403 });
      }
      pushCancelNotification(order.date, order.lines);
      appData.pendingPortalOrders = (appData.pendingPortalOrders || []).filter((o: any) => o.id !== orderId);
    } else if (kind === "pickup") {
      const order = (appData.storkjokkenPickupOrders || []).find((o: any) => o.id === orderId);
      if (!order || order.customerId !== customer.id) {
        return NextResponse.json({ error: "Fant ikke bestillingen" }, { status: 404 });
      }
      if (isPastDeadline(deadlines, order.date)) {
        return NextResponse.json({ error: "Fristen for denne datoen er passert, kan ikke avbestille." }, { status: 403 });
      }
      pushCancelNotification(order.date, [{ productId: order.productId, quantity: order.quantity }]);
      appData.storkjokkenPickupOrders = (appData.storkjokkenPickupOrders || []).filter((o: any) => o.id !== orderId);
    } else if (kind === "recurring") {
      const reqOrder = (appData.pendingRecurringOrderRequests || []).find((o: any) => o.id === orderId);
      if (!reqOrder || reqOrder.customerId !== customer.id) {
        return NextResponse.json({ error: "Fant ikke forespørselen" }, { status: 404 });
      }
      if (reqOrder.status !== "pending") {
        return NextResponse.json({ error: "Denne er allerede behandlet og kan ikke trekkes tilbake her — ta kontakt for endring." }, { status: 403 });
      }
      appData.pendingRecurringOrderRequests = (appData.pendingRecurringOrderRequests || []).filter((o: any) => o.id !== orderId);
    } else {
      return NextResponse.json({ error: "Ugyldig type" }, { status: 400 });
    }

    const { error: writeError } = await supabaseAdmin
      .from("app_data")
      .update({ data: appData, updated_at: new Date().toISOString() })
      .eq("id", "main");

    if (writeError) {
      return NextResponse.json({ error: `Kunne ikke lagre: ${writeError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Noe gikk galt" }, { status: 500 });
  }
}