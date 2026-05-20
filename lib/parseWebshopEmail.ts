/**
 * parseWebshopEmail.ts UPDATED
 *
 * Delt parsing-logikk for webshop-ordrer fra e-post.
 * Brukes både i WebshopImportTab (frontend) og /api/inbound-email (backend).
 */

export type ParsedOrderLine = {
  productId: string;
  quantity: number;
};

export type ParsedOrder = {
  id: string;
  orderNumber?: string;
  type: "bakeri";
  customerType: "privat";
  customer: string;
  companyName: string;
  orgNumber: string;
  companyAddress: string;
  phone: string;
  paymentInfo: string;
  deliveryAddress: string;
  date: string;
  time: string;
  note: string;
  guests: number;
  productId: string;
  orderLines: ParsedOrderLine[];
  discountPercent: number;
  isRecurring: boolean;
  recurringDays: string[];
  recurringNote: string;
  allergens: Record<string, number>;
  dietVegan: string;
  dietVegetarian: string;
  dietPregnant: string;
  dietOther: string;
};

export type MatchableProduct = {
  id: string;
  name: string;
  productNumber?: string;
};

const DEFAULT_ALLERGENS = [
  "Gluten", "Hvete", "Rug", "Spelt", "Bygg", "Egg", "Melk", "Laktose",
  "Skalldyr", "Bløtdyr", "Selleri", "Lupin", "Sulfitt", "Nøtter",
  "Peanøtter", "Sesam", "Soya",
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseNorwegianDate(text: string): { date: string; time: string } {
  const months: Record<string, string> = {
    januar: "01", februar: "02", mars: "03", april: "04",
    mai: "05", juni: "06", juli: "07", august: "08",
    september: "09", oktober: "10", november: "11", desember: "12",
  };

  // Støtter "Når: Onsdag 20 mai 11:00-11:15" og "Tidspunkt: Fredag 8 mai 10:00"
  const match = text.match(
    /(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)?\s*(\d{1,2})\s+([a-zæøå]+)\s+(\d{1,2}:\d{2})/i
  );

  if (!match) return { date: today(), time: "" };

  const day = match[1].padStart(2, "0");
  const month = months[match[2].toLowerCase()] || "01";
  const year = new Date().getFullYear();
  const time = match[3];

  return { date: `${year}-${month}-${day}`, time };
}

export function parseWebshopEmail(
  text: string,
  products: MatchableProduct[]
): { order: ParsedOrder; unmatched: string[] } | null {
  const lines = text
    .split(/\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  // ── Ordrenummer ──────────────────────────────────────────────────────────
  const orderNumberMatch =
    text.match(/Bestilling\s+(\d{4,})/i) ||
    text.match(/(?:Ordre|Order)\s*#?\s*(\d{4,})/i) ||
    text.match(/\b(\d{6,})\b/);
  const orderNumber = orderNumberMatch?.[1] || String(Date.now());

  // ── Telefon – hent fra "Telefon: +47..." linjen ──────────────────────────
  const phoneRaw = text.match(/Telefon:\s*(\+?[\d\s]{8,})/i)?.[1]?.trim() || "";
  const phone = phoneRaw.replace(/\s+/g, "");

  // ── Leveringstidspunkt ───────────────────────────────────────────────────
  const naarMatch = text.match(/Når:\s*(.+)/i);
  const tidspunktMatch = text.match(/Tidspunkt:\s*(.+)/i);
  const dateInfo = parseNorwegianDate(naarMatch?.[1] || tidspunktMatch?.[1] || text);

  // ── Leveringsadresse ─────────────────────────────────────────────────────
  const deliveryAddress =
    text.match(/Adresse:\s*(.+)/i)?.[1]?.trim() ||
    (text.match(/Butikk:\s*Brødrene Berbusmel/i) ? "Hentes i butikk" : "");

  // ── Kundenavn ────────────────────────────────────────────────────────────
  let customer = text.match(/Navn:\s*(.+)/i)?.[1]?.trim() || "";
  if (!customer) {
    const customerInfoIndex = lines.findIndex((l) => /kundeinformasjon/i.test(l));
    if (customerInfoIndex >= 0 && lines[customerInfoIndex + 1]) {
      customer = lines[customerInfoIndex + 1];
    }
  }
  if (!customer) {
    const orderHeader = lines.find((l) => /\d+\s*\/\s*/.test(l));
    customer = orderHeader?.split("/")[1]?.trim() || "";
  }

  // ── Betalingsinfo ────────────────────────────────────────────────────────
  const erBetaltPaaNett = /ikke ta imot betaling/i.test(text);
  const erFaktura = /faktura|etterskudd|ved henting|kontant/i.test(text);
  const paymentInfo = erBetaltPaaNett
    ? "Betalt på nett"
    : erFaktura
      ? "Faktura / betaling ved henting"
      : text.match(/Betalingsinformasjon\s*([\s\S]*?)(?:Leveringinformasjon|Tidspunkt:|Produkt|$)/i)?.[1]?.trim() || "Betalt på nett";

  // ── Notat / beskjed til sjåfør ───────────────────────────────────────────
  const driverNote =
    text.match(/Beskjed til sjåfør:\s*([\s\S]*?)(?:\n\n|\nKundeinformasjon|\nHusk)/i)?.[1]?.trim() ||
    text.match(/Melding til sjåfør:\s*([\s\S]*?)(?:\n\n|$)/i)?.[1]?.trim() || "";

  // ── Produktlinjer ────────────────────────────────────────────────────────
  const nextUnmatched: string[] = [];
  const orderLines: ParsedOrderLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const productCodeMatch = lines[i].match(/^([A-ZÆØÅ]{1,4}\d{3,})$/i);
    if (!productCodeMatch) continue;

    const productCode = productCodeMatch[1];
    const product = products.find(
      (p) => p.productNumber?.toLowerCase() === productCode.toLowerCase()
    );

    if (!product) {
      nextUnmatched.push(lines[i]);
      continue;
    }

    // Søk antall i de neste 5 linjene (trim for å fjerne trailing spaces)
    let quantity = 1;
    const nextFive = lines.slice(i + 1, i + 6).map((l) => l.trim());

    for (let j = 0; j < nextFive.length; j++) {
      // Stopp ved neste produktkode
      if (/^[A-ZÆØÅ]{1,4}\d{3,}$/i.test(nextFive[j])) break;
      // Linje med kun tall
      if (/^\d+$/.test(nextFive[j])) {
        quantity = Number(nextFive[j]);
        break;
      }
    }

    // Fallback: gammel format "10 195,00 kr"
    if (quantity === 1) {
      const combined = nextFive.join(" ");
      const oldFormat = combined.match(/\b(\d+)\s+\d+[,.]?\d*/i);
      if (oldFormat && Number(oldFormat[1]) > 1) quantity = Number(oldFormat[1]);
    }

    orderLines.push({ productId: product.id, quantity });
  }

  // Dedupliser – behold høyeste antall per produkt
  const uniqueLines = Object.values(
    orderLines.reduce((acc, line) => {
      if (!acc[line.productId] || line.quantity > acc[line.productId].quantity) {
        acc[line.productId] = line;
      }
      return acc;
    }, {} as Record<string, ParsedOrderLine>)
  );

  if (uniqueLines.length === 0) return null;

  const unmatchedNote = nextUnmatched.length
    ? `Ikke matchet tekst:\n${nextUnmatched.join("\n")}`
    : "";
  const note = [driverNote, unmatchedNote].filter(Boolean).join("\n\n");

  const order: ParsedOrder = {
    id: `webshop-${orderNumber}-${Date.now()}`,
    orderNumber,
    type: "bakeri",
    customerType: "privat",
    customer: customer || "Webshopkunde",
    companyName: "",
    orgNumber: "",
    companyAddress: "",
    phone,
    paymentInfo,
    deliveryAddress,
    date: dateInfo.date,
    time: dateInfo.time,
    note,
    guests: 1,
    productId: uniqueLines[0]?.productId || "",
    orderLines: uniqueLines,
    discountPercent: 0,
    isRecurring: false,
    recurringDays: [],
    recurringNote: `Importert fra webshop. Ordrenr: ${orderNumber}`,
    allergens: Object.fromEntries(DEFAULT_ALLERGENS.map((a) => [a, 0])),
    dietVegan: "0",
    dietVegetarian: "0",
    dietPregnant: "0",
    dietOther: "",
  };

  return { order, unmatched: nextUnmatched };
}