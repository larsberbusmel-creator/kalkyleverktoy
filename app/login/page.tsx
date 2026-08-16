"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mode, setMode] = useState<"login" | "setPassword">("login");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Supabase sender invitasjons- og passord-reset-lenker med et token i
  // URL-fragmentet, f.eks. #access_token=...&type=recovery (eller type=invite).
  // Fanger vi opp det her, viser vi et "sett nytt passord"-skjema i stedet
  // for vanlig innlogging.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("type=invite")) {
      setMode("setPassword");
    }
  }, []);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      window.location.href = "/";
    }
  };

  const handleSetNewPassword = async () => {
    setStatusMsg(null);
    if (!newPassword || newPassword.length < 6) {
      setStatusMsg({ type: "error", text: "Passordet må være minst 6 tegn." });
      return;
    }
    if (newPassword !== newPassword2) {
      setStatusMsg({ type: "error", text: "Passordene er ikke like." });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSubmitting(false);
    if (error) {
      setStatusMsg({ type: "error", text: error.message });
      return;
    }
    setStatusMsg({ type: "success", text: "Passord satt! Du blir videresendt til appen..." });
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f7f9",
        fontFamily: "system-ui",
      }}
    >
      <div
        style={{
          width: 420,
          background: "white",
          padding: 32,
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        {/* LOGO */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img
            src="/mise-logo.png"
            alt="Misemetrics"
            style={{
              height: 90,
              objectFit: "contain",
              display: "block",
              margin: "0 auto",
            }}
          />
        </div>

        {mode === "setPassword" ? (
          <>
            <h1 style={{ textAlign: "center", marginBottom: 8 }}>Velg passord</h1>
            <p style={{ textAlign: "center", color: "#666", marginBottom: 24 }}>
              Sett et passord for kontoen din for å fullføre innloggingen.
            </p>

            {statusMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginBottom: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  background: statusMsg.type === "success" ? "#f0fdf4" : "#fef2f2",
                  color: statusMsg.type === "success" ? "#166534" : "#b91c1c",
                  border: `1px solid ${statusMsg.type === "success" ? "#bbf7d0" : "#fecaca"}`,
                }}
              >
                {statusMsg.text}
              </div>
            )}

            <input
              type="password"
              placeholder="Nytt passord"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                borderRadius: 8,
                border: "1px solid #ddd",
                boxSizing: "border-box",
              }}
            />
            <input
              type="password"
              placeholder="Gjenta nytt passord"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                borderRadius: 8,
                border: "1px solid #ddd",
                boxSizing: "border-box",
              }}
            />

            <button
              onClick={handleSetNewPassword}
              disabled={submitting}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 8,
                border: "none",
                background: submitting ? "#94a3b8" : "#0f172a",
                color: "white",
                fontWeight: 600,
                cursor: submitting ? "default" : "pointer",
              }}
            >
              {submitting ? "Lagrer..." : "Sett passord"}
            </button>
          </>
        ) : (
          <>
            <h1 style={{ textAlign: "center", marginBottom: 8 }}>
              Velkommen tilbake
            </h1>
            <p style={{ textAlign: "center", color: "#666", marginBottom: 24 }}>
              Logg inn for å fortsette
            </p>

            {/* EMAIL */}
            <input
              placeholder="E-post"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                borderRadius: 8,
                border: "1px solid #ddd",
                boxSizing: "border-box",
              }}
            />

            {/* PASSWORD */}
            <input
              type="password"
              placeholder="Passord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 12,
                borderRadius: 8,
                border: "1px solid #ddd",
                boxSizing: "border-box",
              }}
            />

            <button
              onClick={handleLogin}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 8,
                border: "none",
                background: "#0f172a",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Logg inn
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              <span style={{ color: "#94a3b8", fontSize: 13 }}>eller</span>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            </div>
            <a
              href="/bestilling"
              style={{
                display: "block",
                width: "100%",
                padding: 14,
                borderRadius: 8,
                border: "1px solid #0f172a",
                background: "white",
                color: "#0f172a",
                fontWeight: 600,
                textAlign: "center",
                textDecoration: "none",
                boxSizing: "border-box",
              }}
            >
              Logg inn for bestilling
            </a>
          </>
        )}
      </div>
    </main>
  );
}