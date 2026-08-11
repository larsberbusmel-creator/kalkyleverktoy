"use client";

import { useState, useMemo } from "react";

type Product = { id: string; name: string; category: string; priceExVat: number };
type HistoryItem = { date: string; productName: string; quantity: number };
type PendingItem = { id: string; date: string; submittedAt: string; lines: { productName: string; quantity: number }[] };

function tomorrowDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isPastCutoff(date: string) {
  const now = new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setDate(cutoffDate.getDate() + 1);
  const cutoffDateStr = cutoffDate.toISOString().slice(0, 10);
  return date <= cutoffDateStr && now.getHours() >= 12;
}

export default function KundePortal() {
  const [pin, setPin] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [tab, setTab] = useState<"bestill" | "historikk">("bestill");

  const [orderDate, setOrderDate] = useState(tomorrowDate());
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");

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

  const late = isPastCutoff(orderDate);

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
        // refresh pending list
        const refreshed = await fetch("/api/kunde/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        }).then((r) => r.json());
        setPending(refreshed.pending || []);
      }
    } catch {
      setSubmitMsg("Noe gikk galt. Prøv igjen.");
    }
    setSubmitting(false);
  }

  if (!customer) {
    return (
      <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "Arial, Helvetica, sans-serif", padding: 16 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Brødrene Berbusmel</h1>
        <p style={{ color: "#64748b", marginBottom: 20 }}>Storkjøkken-portal</p>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 700 }}>PIN-kode</label>
        <input
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && login()}
          placeholder="f.eks. 48213"
          style={{ width: "100%", padding: 10, fontSize: 16, borderRadius: 8, border: "1px solid #cbd5e1", boxSizing: "border-box" }}
        />
        {error && <p style={{ color: "#dc2626", marginTop: 8 }}>{error}</p>}
        <button
          onClick={login}
          disabled={loading}
          style={{ width: "100%", marginTop: 16, padding: 12, fontSize: 16, fontWeight: 700, background: "#111827", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          {loading ? "Logger inn..." : "Logg inn"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", fontFamily: "Arial, Helvetica, sans-serif", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>{customer.name}</h1>
          <p style={{ color: "#64748b", margin: 0, fontSize: 13 }}>Storkjøkken-portal</p>
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
          {late && (
            <p style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: 10, color: "#92400e", fontWeight: 700, fontSize: 14 }}>
              ⚠ Fristen kl. 12:00 for denne leveringsdatoen er passert. Du kan fortsatt sende bestillingen, men det kan bli for sent til å rekke den.
            </p>
          )}

          {pending.length > 0 && (
            <div style={{ background: "#eef2ff", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 14 }}>
              <b>Du har {pending.length} bestilling(er) som venter på godkjenning</b>
              {pending.map((p) => (
                <div key={p.id} style={{ marginTop: 6 }}>
                  {p.date}: {p.lines.map((l) => `${l.quantity}× ${l.productName}`).join(", ")}
                </div>
              ))}
            </div>
          )}

          {categories.map((cat) => (
            <div key={cat} style={{ marginBottom: 20 }}>
              <h3 style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 6 }}>{cat}</h3>
              {products.filter((p) => p.category === cat).map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <div>
                    <div>{p.name}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>{p.priceExVat.toFixed(2)} kr eks. mva</div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={quantities[p.id] || ""}
                    onChange={(e) => setQuantities({ ...quantities, [p.id]: e.target.value })}
                    placeholder="0"
                    style={{ width: 70, padding: 8, borderRadius: 8, border: "1px solid #cbd5e1", textAlign: "right" }}
                  />
                </div>
              ))}
            </div>
          ))}

          {products.length === 0 && <p style={{ color: "#64748b" }}>Ingen produkter tilgjengelig ennå. Ta kontakt med Brødrene Berbusmel.</p>}

          {submitMsg && <p style={{ marginBottom: 8, fontWeight: 700 }}>{submitMsg}</p>}
          <button
            onClick={submitOrder}
            disabled={submitting || products.length === 0}
            style={{ width: "100%", padding: 14, fontSize: 16, fontWeight: 700, background: "#111827", color: "white", border: "none", borderRadius: 8, cursor: "pointer", marginTop: 8 }}
          >
            {submitting ? "Sender..." : "Send bestilling"}
          </button>
        </>
      )}

      {tab === "historikk" && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: 8 }}>Dato</th>
              <th style={{ padding: 8 }}>Produkt</th>
              <th style={{ padding: 8, textAlign: "right" }}>Antall</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: 8 }}>{h.date}</td>
                <td style={{ padding: 8 }}>{h.productName}</td>
                <td style={{ padding: 8, textAlign: "right" }}>{h.quantity}</td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 16, textAlign: "center", color: "#64748b" }}>Ingen tidligere bestillinger ennå.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}