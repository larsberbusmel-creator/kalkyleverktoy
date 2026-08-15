import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

    let visibleProducts = (appData.products || []).filter((p: any) => p.storkjokkenPriceExVat);
    if (Array.isArray(customer.allowedProductIds) && customer.allowedProductIds.length > 0) {
      const allowed = new Set(customer.allowedProductIds);
      visibleProducts = visibleProducts.filter((p: any) => allowed.has(p.id));
    }

    const products = visibleProducts.map((p: any) => {
      const perStkPrice = priceForCustomer(p, customer.id, customer, appData.storkjokkenSpecialPrices);
      const unitsPerCase = Number(p.unitsPerCase) || 1;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        unitsPerCase,
        priceExVat: perStkPrice * unitsPerCase,
      };
    });

    const productName = (id: string) =>
      (appData.products || []).find((prod: any) => prod.id === id)?.name || "Ukjent";

    const byDate: Record<string, { id: string; productId: string; productName: string; quantity: number; priceExVat: number }[]> = {};
    (appData.storkjokkenPickupOrders || [])
      .filter((p: any) => p.customerId === customer.id)
      .forEach((p: any) => {
        if (!byDate[p.date]) byDate[p.date] = [];
        byDate[p.date].push({ id: p.id, productId: p.productId, productName: productName(p.productId), quantity: p.quantity, priceExVat: p.priceExVat || 0 });
      });
    const history = Object.entries(byDate)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 30)
      .map(([date, lines]) => ({ date, lines }));

    const pending = (appData.pendingPortalOrders || [])
      .filter((p: any) => p.customerId === customer.id && p.status === "pending")
      .map((p: any) => ({
        id: p.id,
        date: p.date,
        submittedAt: p.submittedAt,
        lines: p.lines.map((l: any) => ({ productId: l.productId, productName: productName(l.productId), quantity: l.quantity })),
      }));

    const deadlines = appData.portalDeadlines || { weekday: { 7: { closed: true } }, exceptions: {} };

    const activeRecurring = (appData.recurringStorkjokkenOrders || [])
      .filter((r: any) => r.customerId === customer.id && r.active)
      .map((r: any) => ({
        id: r.id,
        weekdays: r.weekdays,
        note: r.note,
        lines: r.lines.map((l: any) => ({
          productName: productName(l.productId),
          quantityByDay: l.quantityByDay,
        })),
      }));

    const pendingRecurring = (appData.pendingRecurringOrderRequests || [])
      .filter((r: any) => r.customerId === customer.id && r.status === "pending")
      .map((r: any) => ({
        id: r.id,
        weekdays: r.weekdays,
        note: r.note,
        submittedAt: r.submittedAt,
        lines: r.lines.map((l: any) => ({ productId: l.productId, productName: productName(l.productId), quantity: l.quantity })),
      }));

    const deliveryProduct = (appData.products || []).find((p: any) => p.isDeliveryProduct);
    const delivery = customer.deliveryAvailable && deliveryProduct
      ? { productId: deliveryProduct.id, name: deliveryProduct.name, priceExVat: priceForCustomer(deliveryProduct, customer.id, customer, appData.storkjokkenSpecialPrices) }
      : null;

    return NextResponse.json({
      customer: { id: customer.id, name: customer.name },
      products,
      delivery,
      history,
      pending,
      deadlines,
      favoriteProductIds: customer.favoriteProductIds || [],
      activeRecurring,
      pendingRecurring,
      vatRate: appData.settings?.foodVat || 15,
    });
  } catch (e) {
    return NextResponse.json({ error: "Noe gikk galt" }, { status: 500 });
  }
}