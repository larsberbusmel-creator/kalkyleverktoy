import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Server-only client — uses the service role key, never exposed to the browser.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

function priceForCustomer(product: any, customerId: string, customer: any, specialPrices: any[]) {
  if (customer?.internal) return 0;
  const special = (specialPrices || []).find(
    (s: any) => s.customerId === customerId && s.productId === product.id
  );
  if (special) return special.priceExVat;
  return product.storkjokkenPriceExVat || 0;
}

export async function POST(req: Request) {
  try {
    const { pin } = await req.json();
    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ error: "PIN mangler" }, { status: 400 });
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

    // Only products explicitly priced for storkjøkken — the curated selection.
    const products = (appData.products || [])
      .filter((p: any) => p.storkjokkenPriceExVat)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        priceExVat: priceForCustomer(p, customer.id, customer, appData.storkjokkenSpecialPrices),
      }));

    // Order history: this customer's own pickup orders + pending portal orders only.
    const history = (appData.storkjokkenPickupOrders || [])
      .filter((p: any) => p.customerId === customer.id)
      .sort((a: any, b: any) => b.date.localeCompare(a.date))
      .slice(0, 50)
      .map((p: any) => ({
        date: p.date,
        productName: (appData.products || []).find((prod: any) => prod.id === p.productId)?.name || "Ukjent",
        quantity: p.quantity,
      }));

    const pending = (appData.pendingPortalOrders || [])
      .filter((p: any) => p.customerId === customer.id && p.status === "pending")
      .map((p: any) => ({
        id: p.id,
        date: p.date,
        submittedAt: p.submittedAt,
        lines: p.lines.map((l: any) => ({
          productName: (appData.products || []).find((prod: any) => prod.id === l.productId)?.name || "Ukjent",
          quantity: l.quantity,
        })),
      }));

    return NextResponse.json({
      customer: { id: customer.id, name: customer.name },
      products,
      history,
      pending,
    });
  } catch (e) {
    return NextResponse.json({ error: "Noe gikk galt" }, { status: 500 });
  }
}