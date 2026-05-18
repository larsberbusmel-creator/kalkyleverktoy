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

// Minimalt produktobjekt – kun det vi trenger for matching
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

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

/**
 * Hovedfunksjonen. Tar inn e-posttekst og produktliste, returnerer en ParsedOrder.
 * Returnerer null hvis ingen produktlinjer ble funnet.
 */
export function parseWebshopEmail(
  text: string,
  products: MatchableProduct[]
): { order: ParsedOrder; unmatched: string[] } | null {
  const lines = text
    .split(/\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  // Ordrenummer
  const orderNumberMatch =
    text.match(/(?:Bestilling|Ordre|Order)\s*#?\s*(\d{4,})/i) ||
    text.match(/\b(\d{5,})\b/);
  const orderNumber = orderNumberMatch?.[1] || String(Date.now());

  // E-post og telefon
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

  let phoneMatch = "";
  if (emailMatch?.index !== undefined) {
    const afterEmail = text.slice(emailMatch.index + emailMatch[0].length);
    phoneMatch =
      afterEmail.match(/(?:\+47\s*)?\b\d{2}\s*\d{2}\s*\d{2}\s*\d{2}\b/)?.[0] || "";
  }
  if (!phoneMatch) {
    phoneMatch =
      text.match(/Mottakers telefon:\s*((?:\+47\s*)?\d{2}\s*\d{2}\s*\d{2}\s*\d{2})/i)?.[1] || "";
  }

  // Leveringstidspunkt
  const deliveryMatch = text.match(/Tidspunkt:\s*(.+)/i);
  const dateInfo = parseNorwegianDate(deliveryMatch?.[1] || text);

  // Kundenavn
  let customer = "";
  const customerInfoIndex = lines.findIndex((l) => /kundeinformasjon/i.test(l));
  if (customerInfoIndex >= 0 && lines[customerInfoIndex + 1]) {
    customer = lines[customerInfoIndex + 1];
  }
  if (!customer) {
    const orderHeader = lines.find((l) => /\d+\s*\/\s*/.test(l));
    customer = orderHeader?.split("/")[1]?.trim() || "";
  }

  // Produktlinjer – matcher på produktnummer (f.eks. BA000001)
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

    const nextLines = [
      lines[i + 1] || "",
      lines[i + 2] || "",
      lines[i + 3] || "",
    ];
    const combined = nextLines.join(" ");
    const quantityMatch = combined.match(/\b(\d+)\s+\d+[,.]?\d*\s*kr/i);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;

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

  // Betalingsinformasjon og leveringsadresse
  const paymentInfo =
    text.match(
      /Betalingsinformasjon\s*([\s\S]*?)(?:Leveringinformasjon|Leveringsinformasjon|Tidspunkt:|Produkt|$)/i
    )?.[1]?.trim() || "";

  const deliveryAddress =
    text.match(/Adresse:\s*(.+)/i)?.[1]?.trim() ||
    (text.match(/Butikk:\s*Brødrene Berbusmel/i) ? "Hentes i butikk" : "");

  const note = [
    text.match(/Melding til sjåfør:\s*([\s\S]*)/i)?.[1]?.trim() || "",
    nextUnmatched.length
      ? `Ikke matchet tekst:\n${nextUnmatched.join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const order: ParsedOrder = {
    id: `webshop-${orderNumber}-${Date.now()}`,
    orderNumber,
    type: "bakeri",
    customerType: "privat",
    customer: customer || "Webshopkunde",
    companyName: "",
    orgNumber: "",
    companyAddress: "",
    phone: phoneMatch ? normalizePhone(phoneMatch) : "",
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