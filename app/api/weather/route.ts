import { NextResponse } from "next/server";

// Enkel in-memory cache (per server-instans) - MET Locationforecast oppdateres
// uansett sjelden nok til at 30 minutter er mer enn ferskt nok, og MET sine
// egne bruksvilkår ber om at man ikke kaller API-et oftere enn nødvendig.
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { fetchedAt: number; payload: any }>();

// MET krever en identifiserende User-Agent og avviser kall uten en gyldig en.
const USER_AGENT = "Misemetrics/1.0 kontakt@misemetrics.app";

function symbolToEmoji(code: string): string {
  if (!code) return "🌡️";
  if (code.includes("thunder")) return "⛈️";
  if (code.includes("sleet")) return "🌨️";
  if (code.includes("snow")) return "❄️";
  if (code.includes("lightrain") || code.includes("rainshowers")) return "🌦️";
  if (code.includes("rain")) return "🌧️";
  if (code.includes("fog")) return "🌫️";
  if (code.includes("clearsky")) return code.includes("night") ? "🌙" : "☀️";
  if (code.includes("fair")) return "🌤️";
  if (code.includes("partlycloudy")) return "⛅";
  if (code.includes("cloudy")) return "☁️";
  return "🌡️";
}

function mapEntry(entry: any) {
  const symbolCode = entry?.data?.next_1_hours?.summary?.symbol_code || entry?.data?.next_6_hours?.summary?.symbol_code || "";
  return {
    time: entry.time,
    temperature: entry?.data?.instant?.details?.air_temperature ?? null,
    symbolCode,
    emoji: symbolToEmoji(symbolCode),
    precipitationMm: entry?.data?.next_1_hours?.details?.precipitation_amount ?? entry?.data?.next_6_hours?.details?.precipitation_amount ?? null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  // Valgfri - MET returnerer uansett HELE tidsserien i ett kall (ikke ett
  // kall per dag); date brukes kun til å FILTRERE denne ene tidsserien og
  // til cache-nøkkelen. Uten date: samme "nå + neste 8 timer"-oppførsel
  // som før (bakoverkompatibelt for evt. andre fremtidige kallere).
  const date = searchParams.get("date");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Mangler eller ugyldig lat/lon" }, { status: 400 });
  }

  // Avrundet nøkkel - unngår cache-miss på ubetydelige float-forskjeller,
  // samtidig som presisjonen (~100m) er mer enn god nok for et værvarsel.
  // date er med i nøkkelen slik at ulike dager caches uavhengig av hverandre.
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${date || "now"}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  try {
    const res = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (!res.ok) {
      return NextResponse.json({ error: `MET svarte med status ${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    const timeseries: any[] = json?.properties?.timeseries || [];
    if (!timeseries.length) {
      return NextResponse.json({ error: "Ingen værdata i svaret fra MET" }, { status: 502 });
    }

    let payload: any;

    if (date) {
      // Filtrer den ENE tidsserien til kun oppføringer for den forespurte
      // datoen (tidsstemplets dato-del før "T") - MET dekker kun ca. 9-10
      // dager fremover, så en for fjern (eller fortid-)dato gir ingen treff.
      const dayEntries = timeseries.filter((entry: any) => String(entry.time).slice(0, 10) === date);
      if (!dayEntries.length) {
        payload = { unavailable: true, date };
      } else {
        // Representativ temperatur/symbol for dagen: oppføringen nærmest kl. 12:00.
        let closest = dayEntries[0];
        let closestDiff = Infinity;
        for (const entry of dayEntries) {
          const hour = Number(String(entry.time).slice(11, 13));
          const diff = Math.abs(hour - 12);
          if (diff < closestDiff) { closestDiff = diff; closest = entry; }
        }
        const current = mapEntry(closest);
        // Time-for-time-oversikt BEGRENSET TIL DEN DAGEN (ikke resten av "nå"-dagen).
        const hourly = dayEntries.map(mapEntry);
        payload = { current, hourly, date, fetchedAt: new Date().toISOString() };
      }
    } else {
      const current = mapEntry(timeseries[0]);
      // MET leverer timesoppløsning for de nærmeste ~48 timene i compact-
      // produktet - de neste 8 oppføringene dekker dermed resten av dagen.
      const hourly = timeseries.slice(0, 8).map(mapEntry);
      payload = { current, hourly, fetchedAt: new Date().toISOString() };
    }

    cache.set(key, { fetchedAt: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: "Kunne ikke hente værdata" }, { status: 500 });
  }
}
