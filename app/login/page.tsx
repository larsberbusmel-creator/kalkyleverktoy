"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
  margin: "0 auto"
}}
          />
        </div>
      

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
      </div>
    </main>
  );
}