export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

// Escaper spesialtegn i iCal-feltverdier – IKKE newlines (de håndteres separat)
function escapeIcal(str: string) {
  return (str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

// iCal-standarden krever linjebryting ved 75 tegn (oktet-grense)
// Fortsettelseslinjer starter med ett mellomrom
function foldLine(line: string): string {
  const encoded = line; // UTF-8, behandles som tegn her
  if (encoded.length <= 75) return encoded;
  const chunks: string[] = [];
  chunks.push(encoded.slice(0, 75));
  let i = 75;
  while (i < encoded.length) {
    chunks.push(" " + encoded.slice(i, i + 74));
    i += 74;
  }
  return chunks.join("\r\n");
}

function toIcalDate(date: string, time: string) {
  const [year, month, day] = date.split("-");
  if (!time) return `${year}${month}${day}`;
  const [hour, min] = time.replace(/Kl\s*/i, "").split(":");
  return `${year}${month}${day}T${(hour || "00").padStart(2, "0")}${(min || "00").padStart(2, "0")}00`;
}

function addMinutes(date: string, time: string, minutes: number) {
  const [year, month, day] = date.split("-");
  const [hour, min] = (time || "00:00").replace(/Kl\s*/i, "").split(":");
  const d = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour || 0),
    Number(min || 0) + minutes
  );
  return (
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, "0")}` +
    `${String(d.getDate()).padStart(2, "0")}` +
    `T${String(d.getHours()).padStart(2, "0")}` +
    `${String(d.getMinutes()).padStart(2, "0")}00`
  );
}

// Bygger DESCRIPTION-verdien med riktig iCal-escaped newlines
// iCal bruker literal \n (backslash + n) for linjeskift i feltverdier.
// Tar imot en liste av seksjoner (hver seksjon er en liste av linjer):
// linjer INNENFOR en seksjon separeres med enkelt \n, seksjonene seg
// imellom separeres med dobbelt \n (tom linje) for tydeligere inndeling.
function buildDescription(groups: string[][]): string {
  return groups
    .map((g) => g.filter(Boolean).map((p) => escapeIcal(p)).join("\\n"))   // escape hver linje, enkelt \n innad i seksjon
    .filter(Boolean)
    .join("\\n\\n");                  // dobbelt iCal-newline mellom seksjoner
}

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: row } = await supabase
    .from("app_data")
    .select("data")
    .eq("id", "main")
    .single();

  const orders = (row?.data?.orders || []).filter((o: any) => !o.deletedAt);
  const products = row?.data?.products || [];
  const rentalOffers = row?.data?.rentalOffers || [];

  const now =
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const orderEvents = orders.map((o: any) => {
    const customerName =
      o.customerType === "bedrift"
        ? o.companyName || o.customer
        : o.customer;

    const productLines = (o.orderLines || []).map((l: any) => {
      const p = products.find((x: any) => x.id === l.productId);
      return `${l.quantity}× ${p?.name || "Ukjent"}`;
    });

    const hasTime = !!o.time;
    const dtstart = hasTime
      ? `DTSTART:${toIcalDate(o.date, o.time)}`
      : `DTSTART;VALUE=DATE:${toIcalDate(o.date, "")}`;
    const dtend = hasTime
      ? `DTEND:${addMinutes(o.date, o.time, 60)}`
      : `DTEND;VALUE=DATE:${toIcalDate(o.date, "")}`;

    // SUMMARY: type-prefiks + kundenavn + evt. bedrift i parentes
    const typePrefix = String(o.id).startsWith("rental-order-") ? "Leie av lokale // " : "Bakeriet // ";
    const companyPart =
      o.companyName && o.companyName !== customerName
        ? ` (${o.companyName})`
        : "";
    const summary = escapeIcal(`${typePrefix}${customerName}${companyPart}`);

    // DESCRIPTION: gruppert i seksjoner – buildDescription setter enkelt \n
    // innad i en seksjon og dobbelt \n (tom linje) mellom seksjoner
    const descriptionParts = [
      [o.orderNumber ? `Ordrenr: ${o.orderNumber}` : ""],
      productLines,
      [
        o.phone ? `Tlf: ${o.phone}` : "",
        o.deliveryAddress ? `Levering: ${o.deliveryAddress}` : "",
      ],
      [
        o.paymentInfo ? `Betaling: ${o.paymentInfo}` : "",
        // Notat: bytt eventuelle ekte newlines til iCal-newline
        o.note ? `Notat: ${o.note.replace(/\r?\n/g, "\\n")}` : "",
      ],
    ];
    const description = buildDescription(descriptionParts);

    const lines = [
      "BEGIN:VEVENT",
      `UID:misemetrics-${o.id}@berbusmel.no`,
      `DTSTAMP:${now}`,
      dtstart,
      dtend,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      o.deliveryAddress ? `LOCATION:${escapeIcal(o.deliveryAddress)}` : "",
      hasTime ? "BEGIN:VALARM" : "",
      hasTime ? "ACTION:DISPLAY" : "",
      hasTime ? "DESCRIPTION:Påminnelse" : "",
      hasTime ? "TRIGGER:-PT60M" : "",
      hasTime ? "END:VALARM" : "",
      "END:VEVENT",
    ]
      .filter(Boolean)
      .map(foldLine)          // bryt lange linjer iht. RFC 5545
      .join("\r\n");

    return lines;
  }).join("\r\n");

  // Nedrigg-hendelser: egne VEVENT-blokker bygget fra rentalOffers med et
  // satt teardownAt (datetime-local-verdi, format "YYYY-MM-DDTHH:MM")
  const teardownEvents = rentalOffers
    .filter((offer: any) => !!offer.teardownAt)
    .map((offer: any) => {
      const [teardownDate, teardownTime] = String(offer.teardownAt).split("T");
      const dtstart = `DTSTART:${toIcalDate(teardownDate, teardownTime)}`;
      const dtend = `DTEND:${addMinutes(teardownDate, teardownTime, 60)}`;

      const venueName = offer.venueExternal
        ? (offer.venueExternalName || "Eksternt lokale")
        : offer.venue;
      const summary = escapeIcal(`Nedrigg, ${offer.customer}, ${venueName}`);

      const lines = [
        "BEGIN:VEVENT",
        `UID:misemetrics-teardown-${offer.id}@berbusmel.no`,
        `DTSTAMP:${now}`,
        dtstart,
        dtend,
        `SUMMARY:${summary}`,
        `LOCATION:${escapeIcal(venueName)}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:Påminnelse",
        "TRIGGER:-PT60M",
        "END:VALARM",
        "END:VEVENT",
      ]
        .filter(Boolean)
        .map(foldLine)
        .join("\r\n");

      return lines;
    })
    .join("\r\n");

  const events = [orderEvents, teardownEvents].filter(Boolean).join("\r\n");

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Misemetrics//Berbusmel//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Berbusmel Ordre",
    "X-WR-TIMEZONE:Europe/Oslo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
    },
  });
}