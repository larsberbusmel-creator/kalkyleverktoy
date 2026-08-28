import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// DEL F: "Be om endring" - kunden ber om en endring av en bestilling for en
// dato der fristen allerede er passert (portalens vanlige rediger/avbestill-
// flyt er blokkert der). Oppretter en PendingOrderChangeRequest til
// godkjenning, IKKE en direkte endring - samme PIN-validerte,
// service-rolle-mønster som /api/kunde/submit.
export async function POST(req: Request) {
  try {
    const { pin, date, lines } = await req.json();
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

    if (!cleanLines.length) {
      return NextResponse.json({ error: "Ingen varer valgt" }, { status: 400 });
    }

    const changeRequest = {
      id: `changereq-${Date.now()}`,
      customerId: customer.id,
      date,
      requestedLines: cleanLines,
      submittedAt: new Date().toISOString(),
      status: "pending",
    };

    const { error: rpcError } = await supabaseAdmin.rpc("update_list_items", {
      p_list_key: "pendingOrderChangeRequests",
      p_items: { [changeRequest.id]: changeRequest },
    });

    if (rpcError) {
      console.error("update_list_items feilet:", rpcError);
      return NextResponse.json({ error: `Kunne ikke sende endringsforespørselen: ${rpcError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, requestId: changeRequest.id });
  } catch (e) {
    return NextResponse.json({ error: "Noe gikk galt" }, { status: 500 });
  }
}
