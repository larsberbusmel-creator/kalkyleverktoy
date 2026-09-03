import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

// "Min side" - kunden kan oppdatere sin egen kontaktinfo. orgNumber og pin
// kan ALDRI endres herfra, uansett hva request-bodyen inneholder - dette er
// en bevisst sikkerhetsbarriere (steg 4/5 under), ikke bare en utelatelse.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { pin } = body;
    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ error: "PIN mangler" }, { status: 400 });
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
    const customer = (appData.storkjokkenCustomers || []).find(
      (c: any) => c.pin === pin && c.active !== false
    );
    if (!customer) {
      return NextResponse.json({ error: "Feil PIN-kode" }, { status: 401 });
    }

    // update_list_items erstatter HELE elementet for denne id-en - start
    // derfor fra en kopi av eksisterende kunde, og bygg videre KUN på de
    // feltene som faktisk er en del av denne oppgaven. Delvis oppdatering:
    // et felt som ikke er med i requesten beholder sin eksisterende verdi.
    const patch: Record<string, any> = { ...customer };

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ error: "Firmanavn kan ikke være tomt" }, { status: 400 });
      }
      patch.name = body.name.trim();
    }
    if (body.email !== undefined) {
      if (typeof body.email !== "string" || !body.email.trim()) {
        return NextResponse.json({ error: "E-post kan ikke være tom" }, { status: 400 });
      }
      patch.email = body.email.trim();
    }
    if (body.phone !== undefined) {
      if (typeof body.phone !== "string" || !body.phone.trim()) {
        return NextResponse.json({ error: "Telefon kan ikke være tom" }, { status: 400 });
      }
      patch.phone = body.phone.trim();
    }
    if (body.address !== undefined) {
      patch.address = typeof body.address === "string" ? body.address.trim() : customer.address;
    }
    if (body.deliveryAddress !== undefined) {
      patch.deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : customer.deliveryAddress;
    }

    // Eksplisitt, ubetinget gjenoppretting - selv om noen skulle sende
    // orgNumber/pin/id i request-bodyen, overskriver dette dem alltid
    // tilbake til de faktiske, eksisterende verdiene rett før skriving.
    patch.id = customer.id;
    patch.orgNumber = customer.orgNumber;
    patch.pin = customer.pin;

    const { error: rpcError } = await supabaseAdmin.rpc("update_list_items", {
      p_list_key: "storkjokkenCustomers",
      p_items: { [customer.id]: patch },
      p_row_id: SITE_ROW_ID,
    });

    if (rpcError) {
      console.error("update_list_items feilet (oppdater profil):", rpcError);
      return NextResponse.json({ error: `Kunne ikke lagre: ${rpcError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      profile: {
        name: patch.name,
        address: patch.address || "",
        deliveryAddress: patch.deliveryAddress || "",
        phone: patch.phone || "",
        email: patch.email || "",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Noe gikk galt" }, { status: 500 });
  }
}
