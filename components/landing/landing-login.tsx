"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { email as vEmail, required as vRequired, minLength } from "@/lib/validation";

// Login embebido en la landing (estilo oscuro de marca, autocontenido).
// Al autenticar cae directo en la app: sin pantalla intermedia de /login.

export function LandingLogin() {
  const router = useRouter();
  const supabase = createClient();
  const [emailValue, setEmailValue] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const eErr = vEmail(emailValue);
    const pErr = vRequired(password) ?? minLength(password, 6);
    if (eErr) { setErr("Ingresa un correo valido."); return; }
    if (pErr) { setErr("La contrasena debe tener al menos 6 caracteres."); return; }
    setErr(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailValue.trim(), password });
    if (error) {
      setSubmitting(false);
      setErr("Credenciales incorrectas.");
      return;
    }
    router.push("/start");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }} id="login">
      <label style={lbl}>
        Correo
        <input type="email" autoComplete="email" value={emailValue} onChange={(e) => setEmailValue(e.target.value)}
          placeholder="tu@credix.com" style={inp} />
      </label>
      <label style={lbl}>
        Contrasena
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••" style={inp} />
      </label>
      {err && (
        <div role="alert" style={{ background: "rgba(228,0,43,.12)", border: "1px solid rgba(228,0,43,.4)", color: "#FF8A9C", borderRadius: 10, padding: "9px 12px", fontSize: 12.5 }}>
          {err}
        </div>
      )}
      <button type="submit" disabled={submitting}
        style={{ minHeight: 46, borderRadius: 12, background: "#E4002B", color: "#fff", border: "none", fontWeight: 700, fontSize: 14, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1, boxShadow: "0 12px 34px -8px rgba(228,0,43,.65)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {submitting ? "Ingresando…" : "Entrar a la plataforma"}
        {!submitting && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>}
      </button>
    </form>
  );
}

const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 7, fontSize: 12, fontWeight: 600, color: "#B9BEC4" };
const inp: React.CSSProperties = {
  width: "100%", minHeight: 46, padding: "11px 14px", borderRadius: 11,
  border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.04)",
  color: "#fff", fontSize: 13.5, fontFamily: "var(--font-ui, Inter, sans-serif)", outline: "none",
};
