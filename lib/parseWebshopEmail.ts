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
  customerType: "privat" | "bedrift";
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
  januar: "01", februar: "02", mars: "03", april: "04", mai: "05", juni: "06",
  juli: "07", august: "08", september: "09", oktober: "10", november: "11", desember: "12",
  jan: "01", feb: "02", mar: "03", apr: "04", jun: "06",
  jul: "07", aug: "08", sep: "09", okt: "10", nov: "11", des: "12",
  "jan.": "01", "feb.": "02", "mar.": "03", "apr.": "04", "jun.": "06",
  "jul.": "07", "aug.": "08", "sep.": "09", "okt.": "10", "nov.": "11", "des.": "12",
};

  const match = text.match(
    /(?:mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag)?\s*(\d{1,2})\s+([a-zæøå.]+)\s+(\d{1,2}:\d{2})/i
  );

  if (!match) return { date: today(), time: "" };

  const day = match[1].padStart(2, "0");
  const month = months[match[2].toLowerCase()] || "01";
  const year = new Date().getFullYear();
  const time = match[3];

  return { date: `${year}-${month}-${day}`, time };
}

export type ParseResult =
  | { type: "order"; order: ParsedOrder; unmatched: string[] }
  | { type: "cancellation"; orderNumber: string; reason: string };

export function parseWebshopEmail(
  text: string,
  products: MatchableProduct[]
): ParseResult | null {

  // Fjern SendGrid tracking-URLer og andre URLs før parsing
  const cleanText = text
    .replace(/https?:\/\/[^\s\]]+/g, "")
    .replace(/\[[\s]*\]/g, "");

  const lines = cleanText
    .split(/\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  // ── Ordrenummer ── (flyttet øverst - gjenbrukes av BÅDE kansellering og vanlig ordre)
  const orderNumberMatch =
    cleanText.match(/Bestilling\s+(\d{4,})/i) ||
    cleanText.match(/(?:Ordre|Order)\s*#?\s*(\d{4,})/i) ||
    cleanText.match(/\b(\d{6,})\b/);
  const orderNumber = orderNumberMatch?.[1] || String(Date.now());

  // ── Kansellering ─────────────────────────────────────────────────────────
  // "Bestillingen er kansellert" er den bekreftede, eksakte frasen som
  // faktisk brukes - primærsjekk. "kansellering"/"avbestilt" er et bredere
  // sikkerhetsnett i tillegg.
  const isCancellation =
    /Bestillingen er kansellert/i.test(cleanText) ||
    /kansellering/i.test(cleanText) ||
    /avbestilt/i.test(cleanText);

  if (isCancellation && orderNumberMatch) {
    // "Årsak til avbestilling" står alene på egen linje, med selve
    // årsaksteksten på linjen RETT UNDER - samme "label alene på linje,
    // verdi på neste linje"-mønster som Kundeinformasjon-blokken lenger ned.
    const reasonLabelIndex = lines.findIndex((l) => /årsak til avbestilling/i.test(l));
    const reason = reasonLabelIndex >= 0 ? (lines[reasonLabelIndex + 1] || "") : "";
    return { type: "cancellation", orderNumber, reason };
  }
  // Kanselleringsmail UTEN gjenkjennbart ordrenummer (usannsynlig, men ikke
  // gjett): faller videre til vanlig ordre-parsing som fallback i stedet for
  // å returnere null blindt her.

  // Prøv Telefon:-feltet først, deretter telefonnummer fra Kundeinformasjon-blokken
const phoneRaw =
  cleanText.match(/Telefon:\s*(\+?[\d\s]{8,})/i)?.[1]?.trim() ||
  cleanText.match(/Kundeinformasjon[\s\S]*?(\+47\d{8,}|\+47\s*\d[\d\s]{7,})/i)?.[1]?.trim() || "";
const phone = phoneRaw.replace(/\s+/g, "");

  // ── Leveringstidspunkt ───────────────────────────────────────────────────
  const naarMatch = cleanText.match(/Når:\s*(.+)/i);
  const tidspunktMatch = cleanText.match(/Tidspunkt:\s*(.+)/i);
  const dateInfo = parseNorwegianDate(naarMatch?.[1] || tidspunktMatch?.[1] || cleanText);

 const deliveryAddress =
  cleanText.match(/Adresse:\s*(.+)/i)?.[1]?.trim() ||
  cleanText.match(/Hentested:\s*(.+)/i)?.[1]?.trim() ||
  (cleanText.match(/Butikk:\s*Brødrene Berbusmel/i) ? "Hentes i butikk" : "Hentes i butikk");

  // ── Kundenavn ────────────────────────────────────────────────────────────
 let customer = cleanText.match(/Navn:\s*(.+)/i)?.[1]?.trim() || "";
let companyName = "";
const customerInfoIndex = lines.findIndex((l) => /kundeinformasjon/i.test(l));
if (customerInfoIndex >= 0) {
  // Første linje etter Kundeinformasjon kan være bedriftsnavn (store bokstaver)
  const line1 = lines[customerInfoIndex + 1] || "";
  const line2 = lines[customerInfoIndex + 2] || "";
  if (line1 && line1 === line1.toUpperCase() && line1.length > 3) {
    companyName = line1;
    if (!customer) customer = line2;
  } else {
    if (!customer) customer = line1;
  }
}
  if (!customer) {
    const orderHeader = lines.find((l) => /\d+\s*\/\s*/.test(l));
    customer = orderHeader?.split("/")[1]?.trim() || "";
  }

  // ── Betalingsinfo ────────────────────────────────────────────────────────
  const erBetaltPaaNett = /ikke ta imot betaling/i.test(cleanText);
  const erFaktura = /faktura|etterskudd|ved henting|kontant/i.test(cleanText);
  const paymentInfo = erBetaltPaaNett
    ? "Betalt på nett"
    : erFaktura
      ? "Faktura / betaling ved henting"
      : cleanText.match(/Betalingsinformasjon\s*([\s\S]*?)(?:Leveringinformasjon|Tidspunkt:|Produkt|$)/i)?.[1]?.trim() || "Betalt på nett";

  // ── Notat / beskjed til sjåfør ───────────────────────────────────────────
  const driverNote =
    cleanText.match(/Beskjed til sjåfør:\s*([\s\S]*?)(?:\n\n|\nKundeinformasjon|\nHusk)/i)?.[1]?.trim() ||
    cleanText.match(/Melding til sjåfør:\s*([\s\S]*?)(?:\n\n|$)/i)?.[1]?.trim() || "";

  // ── Produktlinjer ────────────────────────────────────────────────────────
  const nextUnmatched: string[] = [];
  const orderLines: ParsedOrderLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    // Varenummeret kan stå alene på linjen ("PA000007"), ELLER sammen med
    // annen tekst på samme linje (f.eks. "Endret    PA000002" - dette skjer
    // typisk for den FØRSTE endrede varen i en "ordre endret"-e-post, der
    // "Endret"-merkelappen havner på samme rad som selve varenummeret).
    // Match derfor varenummeret som et avgrenset "ord" hvor som helst i
    // linjen, ikke bare når det er hele linjens eneste innhold.
    const productCodeMatch = lines[i].match(/(?:^|\s)([A-ZÆØÅ]{1,4}\d{3,})(?:\s|$)/i);
    if (!productCodeMatch) continue;

    const productCode = productCodeMatch[1];
    const product = products.find(
      (p) => p.productNumber?.toLowerCase() === productCode.toLowerCase()
    );

    if (!product) {
      nextUnmatched.push(lines[i]);
      continue;
    }

    // Søk antall i de neste 5 linjene
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

  // Allergier fra fritekst
const allergyNote =
  cleanText.match(/Tilpasse til allergier[^\n]*\n([^\n]+)/i)?.[1]?.trim() ||
  cleanText.match(/Allergi[^:]*:\s*(.+)/i)?.[1]?.trim() ||
  "";

const unmatchedNote = nextUnmatched.length
  ? `Ikke matchet tekst:\n${nextUnmatched.join("\n")}`
  : "";

const note = [
  driverNote,
  allergyNote ? `Allergier (fra bestilling): ${allergyNote}` : "",
  unmatchedNote,
].filter(Boolean).join("\n\n");

  const order: ParsedOrder = {
    id: `webshop-${orderNumber}-${Date.now()}`,
    orderNumber,
    type: "bakeri",
    customerType: companyName ? "bedrift" : "privat",
    customer: customer || "Webshopkunde",
    companyName,
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

  return { type: "order", order, unmatched: nextUnmatched };
}