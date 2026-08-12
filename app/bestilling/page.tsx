"use client";

import { useState, useMemo } from "react";

type Product = { id: string; name: string; category: string; priceExVat: number };
type HistoryGroup = { date: string; lines: { id: string; productId: string; productName: string; quantity: number; priceExVat: number }[] };
type PendingItem = { id: string; date: string; submittedAt: string; lines: { productId: string; productName: string; quantity: number }[] };
type DeadlineDay = { closed?: boolean; cutoffTime?: string };
type Deadlines = { weekday: Record<number, DeadlineDay>; exceptions: Record<string, DeadlineDay> };

function tomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function getDeadlineForDate(deadlines: Deadlines, date: string): { closed: boolean; cutoffTime: string } {
  const exception = deadlines?.exceptions?.[date];
  if (exception) return { closed: !!exception.closed, cutoffTime: exception.cutoffTime || "12:00" };
  const dow = new Date(date + "T00:00:00").getDay();
  const weekdayNum = dow === 0 ? 7 : dow;
  const wd = deadlines?.weekday?.[weekdayNum];
  return { closed: !!wd?.closed, cutoffTime: wd?.cutoffTime || "12:00" };
}

function isPastDeadline(deadlines: Deadlines, date: string) {
  const d = getDeadlineForDate(deadlines, date);
  if (d.closed) return true;
  const cutoff = new Date(date + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - 1);
  const [h, m] = d.cutoffTime.split(":").map(Number);
  cutoff.setHours(h, m, 0, 0);
  return new Date() > cutoff;
}

export default function BestillingPortal() {
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<HistoryGroup[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [deadlines, setDeadlines] = useState<Deadlines>({ weekday: {}, exceptions: {} });
  const [vatRate, setVatRate] = useState(15);
  const [tab, setTab] = useState<"bestill" | "historikk" | "fastordre">("bestill");
  const [categoryFilter, setCategoryFilter] = useState("Alle");

  const [orderDate, setOrderDate] = useState(tomorrowDate());
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeRecurring, setActiveRecurring] = useState<any[]>([]);
  const [pendingRecurring, setPendingRecurring] = useState<any[]>([]);
  const [recWeekdays, setRecWeekdays] = useState<number[]>([]);
  const [recQuantities, setRecQuantities] = useState<Record<string, string>>({});
  const [recNote, setRecNote] = useState("");
  const [recMsg, setRecMsg] = useState("");

  async function refresh() {
    const json = await fetch("/api/kunde/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    }).then((r) => r.json());
    setHistory(json.history || []);
    setPending(json.pending || []);
    setPendingRecurring(json.pendingRecurring || []);
  }

  async function login() {
    if (!pinInput.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/kunde/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Kunne ikke logge inn");
        setLoading(false);
        return;
      }
      setPin(pinInput.trim());
      setCustomer(json.customer);
      setProducts(json.products);
      setHistory(json.history);
      setPending(json.pending);
      setDeadlines(json.deadlines);
      setVatRate(json.vatRate || 15);
      setFavorites(json.favoriteProductIds || []);
      setActiveRecurring(json.activeRecurring || []);
      setPendingRecurring(json.pendingRecurring || []);
    } catch {
      setError("Noe gikk galt. Prøv igjen.");
    }
    setLoading(false);
  }

  function logout() {
    setPin("");
    setPinInput("");
    setCustomer(null);
    setProducts([]);
    setHistory([]);
    setPending([]);
    setQuantities({});
  }

  const categories = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    products.forEach((p) => {
      if (!seen.has(p.category)) {
        seen.add(p.category);
        list.push(p.category);
      }
    });
    return list;
  }, [products]);

  const dayInfo = getDeadlineForDate(deadlines, orderDate);
  const late = !dayInfo.closed && isPastDeadline(deadlines, orderDate);

  async function submitOrder() {
    const lines = Object.entries(quantities)
      .map(([productId, qty]) => ({ productId, quantity: Number(qty) || 0 }))
      .filter((l) => l.quantity > 0);
    if (!lines.length) {
      setSubmitMsg("Velg minst én vare med antall før du sender.");
      return;
    }
    setSubmitting(true);
    setSubmitMsg("");
    try {
      const res = await fetch("/api/kunde/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, date: orderDate, lines }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitMsg(json.error || "Kunne ikke sende bestillingen.");
      } else {
        setSubmitMsg("Bestillingen er sendt inn og venter på godkjenning.");
        setQuantities({});
        await refresh();
      }
    } catch {
      setSubmitMsg("Noe gikk galt. Prøv igjen.");
    }
    setSubmitting(false);
  }

  async function performCancel(orderId: string, kind: "pending" | "pickup" | "recurring", reason: "cancel" | "edit" = "cancel") {
    setCancellingId(orderId);
    let ok = false;
    try {
      const res = await fetch("/api/kunde/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, orderId, kind, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Kunne ikke avbestille.");
      } else {
        ok = true;
      }
    } catch {
      alert("Noe gikk galt.");
    }
    setCancellingId(null);
    return ok;
  }

  async function cancelOrder(orderId: string, kind: "pending" | "pickup" | "recurring") {
    if (!confirm("Avbestille denne bestillingen?")) return;
    if (await performCancel(orderId, kind)) await refresh();
  }

 async function editPendingOrder(p: PendingItem) {
    const q: Record<string, string> = {};
    p.lines.forEach((l) => { q[l.productId] = String(l.quantity); });
    if (!(await performCancel(p.id, "pending", "edit"))) return;
    setQuantities(q);
    setOrderDate(p.date);
    setTab("bestill");
    await refresh();
  }

  async function editHistoryGroup(group: HistoryGroup) {
    if (isPastDeadline(deadlines, group.date)) {
      alert("Fristen for denne datoen er passert, kan ikke lenger endres.");
      return;
    }
    const q: Record<string, string> = {};
    group.lines.forEach((l) => { q[l.productId] = String(l.quantity); });
    for (const l of group.lines) {
      await performCancel(l.id, "pickup", "edit");
    }
    setQuantities(q);
    setOrderDate(group.date);
    setTab("bestill");
    await refresh();
  }

  function printPakkseddel(group: HistoryGroup) {
    let sumExVat = 0;
    const rows = group.lines
      .map((l) => {
        const lineSum = l.priceExVat * l.quantity;
        sumExVat += lineSum;
        return `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb">${l.productName}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${l.quantity}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${l.priceExVat.toFixed(2)} kr</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${lineSum.toFixed(2)} kr</td></tr>`;
      })
      .join("");
    const vat = sumExVat * (vatRate / 100);
    const sumIncVat = sumExVat + vat;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Pakkseddel – ${group.date}</title><style>
body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111827}
table{width:100%;border-collapse:collapse;margin-top:12px}
th{text-align:left;padding:6px 8px;border-bottom:2px solid #111827}
tfoot td{padding:6px 8px;font-weight:700}
</style></head><body>
<img src="/logo.png" style="height:48px;margin-bottom:12px" />
<h1 style="margin:0">Pakkseddel</h1>
<p>${customer?.name || ""} · ${group.date}</p>
<table>
<thead><tr><th>Produkt</th><th style="text-align:right">Antall</th><th style="text-align:right">Pris/stk</th><th style="text-align:right">Sum</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot>
<tr><td colspan="3" style="text-align:right">Sum eks. mva</td><td style="text-align:right">${sumExVat.toFixed(2)} kr</td></tr>
<tr><td colspan="3" style="text-align:right">Mva (${vatRate}%)</td><td style="text-align:right">${vat.toFixed(2)} kr</td></tr>
<tr><td colspan="3" style="text-align:right">Sum inkl. mva</td><td style="text-align:right">${sumIncVat.toFixed(2)} kr</td></tr>
</tfoot>
</table>
<script>window.print()</script>
</body></html>`);
    w.document.close();
  }

async function toggleFavorite(productId: string) {
    const next = favorites.includes(productId) ? favorites.filter((id) => id !== productId) : [...favorites, productId];
    setFavorites(next);
    await fetch("/api/kunde/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, productIds: next }),
    });
  }

  async function submitRecurringRequest() {
    const lines = Object.entries(recQuantities)
      .map(([productId, qty]) => ({ productId, quantity: Number(qty) || 0 }))
      .filter((l) => l.quantity > 0);
    if (!recWeekdays.length || !lines.length) {
      setRecMsg("Velg minst én ukedag og én vare med antall.");
      return;
    }
    const res = await fetch("/api/kunde/fastordre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, weekdays: recWeekdays, lines, note: recNote }),
    });
    const json = await res.json();
    if (!res.ok) {
      setRecMsg(json.error || "Kunne ikke sende forespørselen.");
    } else {
      setRecMsg("Forespørsel om fastordre er sendt inn og venter på godkjenning.");
      setRecQuantities({});
      setRecWeekdays([]);
      setRecNote("");
      await refresh();
    }
  }
  
  if (!customer) {
    return (
      <div style={{ minHeight: "100vh", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Arial, Helvetica, sans-serif", padding: 16 }}>
        <div style={{ maxWidth: 380, width: "100%", background: "white", borderRadius: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.08)", padding: "40px 32px", textAlign: "center", boxSizing: "border-box" }}>
          <div style={{ display: "inline-block", padding: 20, border: "1px solid #e2e8f0", borderRadius: 12, marginBottom: 20 }}>
            <img src="/logo.png" style={{ height: 90 }} alt="Logo" />
          </div>
          <p style={{ color: "#64748b", marginBottom: 24, fontSize: 15 }}>Storkjøkken-portal</p>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 700, textAlign: "left" }}>Kundenr</label>
          <input
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && login()}
            style={{ width: "100%", padding: 12, fontSize: 16, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
          />
          {error && <p style={{ color: "#dc2626", marginTop: 8 }}>{error}</p>}
          <button
            onClick={login}
            disabled={loading}
            style={{ width: "100%", marginTop: 20, padding: 12, fontSize: 16, fontWeight: 700, background: "#111827", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            {loading ? "Logger inn..." : "Logg inn"}
          </button>
        </div>
      </div>
    );
  }

  const visibleCategories = categoryFilter === "Alle" ? categories : [categoryFilter];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", fontFamily: "Arial, Helvetica, sans-serif", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" style={{ height: 40 }} alt="Logo" />
          <div>
            <h1 style={{ fontSize: 20, margin: 0 }}>{customer.name}</h1>
            <p style={{ color: "#64748b", margin: 0, fontSize: 13 }}>Storkjøkken-portal</p>
          </div>
        </div>
        <button onClick={logout} style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>Logg ut</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setTab("bestill")}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === "bestill" ? "#111827" : "#e2e8f0", color: tab === "bestill" ? "white" : "#111827", fontWeight: 700 }}
        >
          Bestill
        </button>
        <button
          onClick={() => setTab("historikk")}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === "historikk" ? "#111827" : "#e2e8f0", color: tab === "historikk" ? "white" : "#111827", fontWeight: 700 }}
        >
          Tidligere bestillinger
        </button>
        <button
          onClick={() => setTab("fastordre")}
          style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === "fastordre" ? "#111827" : "#e2e8f0", color: tab === "fastordre" ? "white" : "#111827", fontWeight: 700 }}
        >
          Fast bestilling
        </button>
      </div>

      {tab === "bestill" && (
        <>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 700 }}>Ønsket leveringsdato</label>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            style={{ padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", marginBottom: 8 }}
          />

          {dayInfo.closed ? (
            <p style={{ background: "#fee2e2", border: "1px solid #dc2626", borderRadius: 8, padding: 10, color: "#991b1b", fontWeight: 700, fontSize: 14 }}>
              Stengt denne dagen — det er ikke mulig å bestille for {orderDate}.
            </p>
          ) : late ? (
            <p style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: 10, color: "#92400e", fontWeight: 700, fontSize: 14 }}>
              ⚠ Fristen kl. {dayInfo.cutoffTime} for denne leveringsdatoen er passert. Du kan fortsatt sende bestillingen, men det kan bli for sent til å rekke den.
            </p>
          ) : (
            <p style={{ color: "#64748b", fontSize: 13 }}>Frist for denne dagen: kl. {dayInfo.cutoffTime} dagen før.</p>
          )}

          {pending.length > 0 && (
            <div style={{ background: "#eef2ff", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 14 }}>
              <b>Venter på godkjenning</b>
              {pending.map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                  <span>{p.date}: {p.lines.map((l) => `${l.quantity}× ${l.productName}`).join(", ")}</span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => editPendingOrder(p)}
                      disabled={isPastDeadline(deadlines, p.date)}
                      style={{ background: "none", border: "1px solid #2563eb", color: "#2563eb", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}
                    >
                      Rediger
                    </button>
                    <button
                      onClick={() => cancelOrder(p.id, "pending")}
                      disabled={cancellingId === p.id || isPastDeadline(deadlines, p.date)}
                      style={{ background: "none", border: "1px solid #dc2626", color: "#dc2626", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}
                    >
                      Avbestill
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {!dayInfo.closed && (
            <>
              {favorites.length > 0 && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                  <b style={{ fontSize: 13 }}>⭐ Dine favoritter</b>
                  {products.filter((p) => favorites.includes(p.id)).map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
                      <span>{p.name}</span>
                      <input
                        type="number" min={0} value={quantities[p.id] || ""}
                        onChange={(e) => setQuantities({ ...quantities, [p.id]: e.target.value })}
                        placeholder="0" style={{ width: 60, padding: 6, borderRadius: 6, border: "1px solid #cbd5e1", textAlign: "right" }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {categories.length > 1 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {["Alle", ...categories].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid #cbd5e1", cursor: "pointer", background: categoryFilter === cat ? "#111827" : "white", color: categoryFilter === cat ? "white" : "#111827", fontSize: 13 }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(visibleCategories.length, 3)}, 1fr)`, gap: 20 }}>
                {visibleCategories.map((cat) => (
                  <div key={cat}>
                    <h3 style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>{cat}</h3>
                    {products.filter((p) => p.category === cat).map((p) => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                        <div>
                          <div>{p.name}</div>
                          <div style={{ color: "#94a3b8", fontSize: 12 }}>{p.priceExVat.toFixed(2)} kr eks. mva</div>
                        </div>
                        <button onClick={() => toggleFavorite(p.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: favorites.includes(p.id) ? "#f59e0b" : "#cbd5e1" }}>★</button>
                        <input
                          type="number"
                          min={0}
                          value={quantities[p.id] || ""}
                          onChange={(e) => setQuantities({ ...quantities, [p.id]: e.target.value })}
                          placeholder="0"
                          style={{ width: 60, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", textAlign: "right" }}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {products.length === 0 && <p style={{ color: "#64748b" }}>Ingen produkter tilgjengelig ennå. Ta kontakt med Brødrene Berbusmel.</p>}

              {submitMsg && <p style={{ marginTop: 12, marginBottom: 8, fontWeight: 700 }}>{submitMsg}</p>}
              <button
                onClick={submitOrder}
                disabled={submitting || products.length === 0}
                style={{ width: "100%", padding: 14, fontSize: 16, fontWeight: 700, background: "#111827", color: "white", border: "none", borderRadius: 8, cursor: "pointer", marginTop: 8 }}
              >
                {submitting ? "Sender..." : "Send bestilling"}
              </button>
            </>
          )}
        </>
      )}

      {tab === "historikk" && (
        <>
          {history.length === 0 && <p style={{ color: "#64748b" }}>Ingen tidligere bestillinger ennå.</p>}
          {history.map((group) => {
            const canCancel = !isPastDeadline(deadlines, group.date);
            return (
              <div key={group.date} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>{group.date}</b>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => printPakkseddel(group)} style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}>
                      Last ned pakkseddel
                    </button>
                    {canCancel && (
                      <button onClick={() => editHistoryGroup(group)} style={{ background: "none", border: "1px solid #2563eb", color: "#2563eb", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 13 }}>
                        Rediger
                      </button>
                    )}
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                  <tbody>
                    {group.lines.map((l) => (
                      <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "4px 0" }}>{l.productName}</td>
                        <td style={{ padding: "4px 0", textAlign: "right" }}>{l.quantity}</td>
                        <td style={{ padding: "4px 0", textAlign: "right", width: 90 }}>
                          <button
                            onClick={() => cancelOrder(l.id, "pickup")}
                            disabled={!canCancel || cancellingId === l.id}
                            style={{ background: "none", border: "1px solid #dc2626", color: canCancel ? "#dc2626" : "#cbd5e1", borderRadius: 6, padding: "2px 8px", cursor: canCancel ? "pointer" : "not-allowed", fontSize: 12 }}
                          >
                            Avbestill
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!canCancel && <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Fristen for denne datoen er passert, kan ikke lenger avbestilles.</p>}
              </div>
            );
          })}
        </>
      )}
      {tab === "fastordre" && (
        <>
          {activeRecurring.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3>Dine aktive fastordre</h3>
              {activeRecurring.map((r) => (
                <div key={r.id} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <b>{r.weekdays.map((d: number) => ["", "Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"][d]).join(", ")}</b>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {r.lines.map((l: any, i: number) => (
                      <li key={i}>{l.productName}: {Object.values(l.quantityByDay)[0] as number} stk</li>
                    ))}
                  </ul>
                  {r.note && <p style={{ fontStyle: "italic", fontSize: 13 }}>{r.note}</p>}
                  <p style={{ fontSize: 12, color: "#94a3b8" }}>Ta kontakt med oss for å endre eller si opp en aktiv fastordre.</p>
                </div>
              ))}
            </div>
          )}

          {pendingRecurring.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3>Venter på godkjenning</h3>
              {pendingRecurring.map((r: any) => (
                <div key={r.id} style={{ background: "#eef2ff", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{r.weekdays.map((d: number) => ["", "Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"][d]).join(", ")}: {r.lines.map((l: any) => `${l.quantity}× ${l.productName}`).join(", ")}</span>
                    <button onClick={() => cancelOrder(r.id, "recurring")} style={{ background: "none", border: "1px solid #dc2626", color: "#dc2626", borderRadius: 6, padding: "2px 8px", cursor: "pointer", fontSize: 12 }}>Trekk tilbake</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3>Send ny forespørsel om fastordre</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"].map((label, i) => {
              const dayNum = i + 1;
              const active = recWeekdays.includes(dayNum);
              return (
                <button
                  key={dayNum}
                  onClick={() => setRecWeekdays(active ? recWeekdays.filter((d) => d !== dayNum) : [...recWeekdays, dayNum])}
                  style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid #cbd5e1", cursor: "pointer", background: active ? "#111827" : "white", color: active ? "white" : "#111827" }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {products.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span>{p.name}</span>
              <input
                type="number" min={0} value={recQuantities[p.id] || ""}
                onChange={(e) => setRecQuantities({ ...recQuantities, [p.id]: e.target.value })}
                placeholder="0" style={{ width: 60, padding: 6, borderRadius: 6, border: "1px solid #cbd5e1", textAlign: "right" }}
              />
            </div>
          ))}

          <textarea
            value={recNote}
            onChange={(e) => setRecNote(e.target.value)}
            placeholder="Eventuell merknad (valgfritt)"
            style={{ width: "100%", marginTop: 12, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box", minHeight: 60 }}
          />
          {recMsg && <p style={{ fontWeight: 700, marginTop: 8 }}>{recMsg}</p>}
          <button
            onClick={submitRecurringRequest}
            style={{ width: "100%", padding: 14, fontSize: 16, fontWeight: 700, background: "#111827", color: "white", border: "none", borderRadius: 8, cursor: "pointer", marginTop: 8 }}
          >
            Send forespørsel om fastordre
          </button>
        </>
      )}
    </div>
  );
}