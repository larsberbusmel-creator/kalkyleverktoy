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

// Gjenskaper packingChecklistRows()/packingListRows() fra RentalTab (app/page.tsx)
// i ren JS/TS uten React-avhengigheter, siden denne ruta kun har tilgang til
// rådataene fra Supabase-raden, ikke klientkodens funksjoner. Se page.tsx for
// den kanoniske versjonen - hold disse i sync ved endring der.
function tableTypeById(tableTypes: any[], id: string) {
  return (tableTypes || []).find((t: any) => t.id === id);
}

function packingListRowsForOffer(offer: any, coverItems: any[], rentalAddons: any[], tableTypes: any[]) {
  const guests = offer.guestCount || 0;
  const courses = offer.courseCount || 1;
  const tablesAll = offer.floorPlanTables || [];
  function tableCountForShape(shape: any) {
    return tablesAll.filter((t: any) => {
      const tt = tableTypeById(tableTypes, t.tableTypeId);
      return tt && (!shape || tt.shape === shape);
    }).length;
  }
  const coverRows = (coverItems || [])
    .filter((item: any) => !item.mealType || item.mealType === offer.mealType)
    .map((item: any) => {
      let qty = 0;
      if (item.rule === "per_person") qty = guests * item.qtyPerUnit;
      if (item.rule === "per_person_per_course") qty = guests * courses * item.qtyPerUnit;
      if (item.rule === "per_table") qty = tableCountForShape(item.tableShape) * item.qtyPerUnit;
      return { id: `cover:${item.id}`, name: item.name, unit: item.unit, qty: Math.ceil(qty) };
    });
  const addonLines = offer.extraLines || [];
  const addonRows: { id: string; name: string; unit: string; qty: number }[] = [];
  (rentalAddons || []).forEach((addon: any) => {
    const line = addonLines.find((l: any) => l.text === addon.name);
    if (!line) return;
    const multiplier = line.quantity && line.quantity > 0 ? line.quantity : 1;
    (addon.packingItems || []).forEach((pi: any) => {
      addonRows.push({ id: `addon:${pi.id}`, name: pi.name, unit: pi.unit, qty: pi.qty * multiplier });
    });
  });
  const customRows = (offer.customPackingItems || []).map((c: any) => ({ id: `custom:${c.id}`, name: c.name, unit: c.unit, qty: c.qty }));
  return [...customRows, ...coverRows, ...addonRows];
}

function packingChecklistRowsForOffer(offer: any, packingListTemplates: any[], coverItems: any[], rentalAddons: any[], tableTypes: any[]) {
  const rows = packingListRowsForOffer(offer, coverItems, rentalAddons, tableTypes)
    .map((r: any) => ({ id: r.id, label: `${r.name} · ${r.qty} ${r.unit}` }));
  (packingListTemplates || [])
    .filter((t: any) => (offer.selectedPackingListTemplateIds || []).includes(t.id))
    .forEach((t: any) => t.items.forEach((item: any) => rows.push({ id: `template:${item.id}`, label: item.label })));
  (offer.extraPackingListItems || []).forEach((label: string) => rows.push({ id: `extra:${label}`, label }));
  return rows;
}

// Portalen er i dag knyttet til ÉTT bestemt sted (Berbusmel) via denne faste
// rad-ID-en. Får dere et andre, reelt sted med egen kalender senere, holder
// ikke denne løsningen - da trengs en mer fleksibel mekanisme (f.eks. egen
// kalender-URL per sted). Bevisst utenfor omfanget av denne hastefiksen.
const SITE_ROW_ID = process.env.PORTAL_SITE_ROW_ID || "main";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: row } = await supabase
    .from("app_data")
    .select("data")
    .eq("id", SITE_ROW_ID)
    .single();

  const orders = (row?.data?.orders || []).filter((o: any) => !o.deletedAt);
  const products = row?.data?.products || [];
  const rentalOffers = row?.data?.rentalOffers || [];
  const eventCalculations = row?.data?.eventCalculations || [];
  const packingListTemplates = row?.data?.packingListTemplates || [];
  const coverItems = row?.data?.coverItems || [];
  const rentalAddons = row?.data?.rentalAddons || [];
  const tableTypes = row?.data?.tableTypes || [];

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
    const isMultiDay = !!o.endDate && o.endDate !== o.date;

    let dtstart: string;
    let dtend: string;
    if (isMultiDay) {
      // Flerdagers arrangement: heldagshendelse fra o.date t.o.m. o.endDate.
      // iCal krever eksklusiv sluttdato, altså dagen ETTER o.endDate.
      // Gjenbruker addMinutes (24t frem fra midnatt) for å finne den datoen
      // uten å skrive ny dato-parsing-logikk.
      const dayAfterEndDate = addMinutes(o.endDate, "00:00", 24 * 60).slice(0, 8);
      dtstart = `DTSTART;VALUE=DATE:${toIcalDate(o.date, "")}`;
      dtend = `DTEND;VALUE=DATE:${dayAfterEndDate}`;
    } else if (hasTime) {
      dtstart = `DTSTART:${toIcalDate(o.date, o.time)}`;
      dtend = `DTEND:${addMinutes(o.date, o.time, 60)}`;
    } else {
      dtstart = `DTSTART;VALUE=DATE:${toIcalDate(o.date, "")}`;
      dtend = `DTEND;VALUE=DATE:${toIcalDate(o.date, "")}`;
    }

    // SUMMARY: type-prefiks + kundenavn + evt. bedrift i parentes
    const typePrefix = String(o.id).startsWith("rental-order-")
      ? "Leie av lokale // "
      : String(o.id).startsWith("event-order-")
      ? "Eventkalkyle // "
      : "Bakeriet // ";
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

  // Pakking-hendelser: egne VEVENT-blokker for hvert rentalOffer som har minst
  // ett punkt i den sammenslåtte pakkelisten (samme fire-kilder-logikk som
  // packingChecklistRows() i RentalTab). Heldagshendelse på offer.date (første
  // dag ved flerdagers-arrangement) - en påminnelse for pakkedagen, ikke et
  // tidsbestemt tidspunkt, så ingen VALARM her (i motsetning til nedrigg).
  const packingEvents = rentalOffers
    .map((offer: any) => {
      if (!offer.date) return "";
      const checklistRows = packingChecklistRowsForOffer(offer, packingListTemplates, coverItems, rentalAddons, tableTypes);
      if (!checklistRows.length) return "";

      const dtstart = `DTSTART;VALUE=DATE:${toIcalDate(offer.date, "")}`;
      const dtend = `DTEND;VALUE=DATE:${toIcalDate(offer.date, "")}`;

      const venueName = offer.venueExternal
        ? (offer.venueExternalName || "Eksternt lokale")
        : offer.venue;
      const summary = escapeIcal(`📦 Pakking, ${offer.customer}, ${venueName}`);

      const checklistLines = checklistRows.map((r: any) => (offer.packingListChecked?.[r.id] ? "☑ " : "☐ ") + r.label);
      const description = buildDescription([checklistLines]);

      const lines = [
        "BEGIN:VEVENT",
        `UID:misemetrics-packing-${offer.id}@berbusmel.no`,
        `DTSTAMP:${now}`,
        dtstart,
        dtend,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        "END:VEVENT",
      ]
        .filter(Boolean)
        .map(foldLine)
        .join("\r\n");

      return lines;
    })
    .filter(Boolean)
    .join("\r\n");

  // Pakking-hendelser for VANLIGE ORDRE (o.packingListEnabled) - samme prinsipp som packingEvents
  // over (for rentalOffers), men enklere: en ordre har ingen avkrysningsstatus lagret
  // (packingListChecked finnes ikke på Order), kun valgte maler + frie tekstpunkter (rene
  // strenger) - se packingListTemplatesHtml() i page.tsx, den kanoniske print-versjonen.
  const orderPackingEvents = orders
    .map((o: any) => {
      if (!o.packingListEnabled || !o.date) return "";
      const selectedTemplates = packingListTemplates.filter((t: any) => (o.selectedPackingListTemplateIds || []).includes(t.id));
      const templateLines = selectedTemplates.flatMap((t: any) => (t.items || []).map((item: any) => item.label));
      const extraItems = (o.extraPackingListItems || []).filter(Boolean);
      const allLines = [...templateLines, ...extraItems];
      if (!allLines.length) return "";

      const dtstart = `DTSTART;VALUE=DATE:${toIcalDate(o.date, "")}`;
      const dtend = `DTEND;VALUE=DATE:${toIcalDate(o.date, "")}`;
      const customerName = o.customerType === "bedrift" ? o.companyName || o.customer : o.customer;
      const summary = escapeIcal(`📦 Pakking, ${customerName}`);
      const description = buildDescription([allLines]);

      const lines = [
        "BEGIN:VEVENT",
        `UID:misemetrics-packing-order-${o.id}@berbusmel.no`,
        `DTSTAMP:${now}`,
        dtstart,
        dtend,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        "END:VEVENT",
      ]
        .filter(Boolean)
        .map(foldLine)
        .join("\r\n");

      return lines;
    })
    .filter(Boolean)
    .join("\r\n");

  // Pakking-hendelser for SELSKAPSMENY/EVENTKALKYLE (EventCalculation) - egen bygger siden
  // strukturen skiller seg fra begge de andre: EventCalculation har KUN mal-systemet + frie
  // punkter som ekte PackingListItem-objekter (id+label, IKKE rene strenger som på Order/
  // RentalOffer), men HAR avkrysningsstatus (packingListChecked, som Rental - i motsetning til
  // Order) - se eventPackingChecklistRows() i page.tsx, den kanoniske versjonen denne speiler.
  const eventPackingEvents = eventCalculations
    .map((ev: any) => {
      if (!ev.date) return "";
      const rows: { id: string; label: string }[] = [];
      packingListTemplates
        .filter((t: any) => (ev.selectedPackingListTemplateIds || []).includes(t.id))
        .forEach((t: any) => (t.items || []).forEach((item: any) => rows.push({ id: `template:${item.id}`, label: item.label })));
      (ev.extraPackingListItems || []).forEach((item: any) => rows.push({ id: `extra:${item.id}`, label: item.label }));
      if (!rows.length) return "";

      const dtstart = `DTSTART;VALUE=DATE:${toIcalDate(ev.date, "")}`;
      const dtend = `DTEND;VALUE=DATE:${toIcalDate(ev.date, "")}`;
      const summary = escapeIcal(`📦 Pakking, ${ev.eventName}`);
      const checkedMap = ev.packingListChecked || {};
      const checklistLines = rows.map((r) => (checkedMap[r.id] ? "☑ " : "☐ ") + r.label);
      const description = buildDescription([checklistLines]);

      const lines = [
        "BEGIN:VEVENT",
        `UID:misemetrics-packing-event-${ev.id}@berbusmel.no`,
        `DTSTAMP:${now}`,
        dtstart,
        dtend,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        "END:VEVENT",
      ]
        .filter(Boolean)
        .map(foldLine)
        .join("\r\n");

      return lines;
    })
    .filter(Boolean)
    .join("\r\n");

  const events = [orderEvents, teardownEvents, packingEvents, orderPackingEvents, eventPackingEvents].filter(Boolean).join("\r\n");

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