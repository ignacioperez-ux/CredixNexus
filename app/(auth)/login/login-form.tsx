"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n, useErrorMessage } from "@/lib/i18n/provider";
import { email as vEmail, required as vRequired, minLength } from "@/lib/validation";

export function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const errMsg = useErrorMessage();
  const supabase = createClient();

  const [emailValue, setEmailValue] = useState("");
  const [password, setPassword] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [passErr, setPassErr] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Capa frontend: valida antes de enviar (§10.7)
    const eErr = vEmail(emailValue);
    const pErr = vRequired(password) ?? minLength(password, 6);
    setEmailErr(eErr);
    setPassErr(pErr);
    setFormErr(null);
    if (eErr || pErr) return;

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailValue.trim(),
      password,
    });
    setSubmitting(false);

    if (error) {
      setFormErr(t("login.badcreds"));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 44,
    padding: "10px 12px",
    borderRadius: "var(--r-md)",
    border: "1px solid var(--line)",
    background: "var(--card)",
    color: "var(--text)",
    fontSize: 13,
    fontFamily: "var(--font-ui)",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 6,
    color: "var(--text)",
  };
  const fieldErrStyle: React.CSSProperties = {
    color: "var(--st-critical-fg)",
    fontSize: 11,
    marginTop: 6,
  };

  return (
    <form onSubmit={onSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label htmlFor="email" style={labelStyle}>
          {t("login.email")}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={emailValue}
          onChange={(e) => setEmailValue(e.target.value)}
          onBlur={() => setEmailErr(vEmail(emailValue))}
          style={{ ...inputStyle, borderColor: emailErr ? "var(--st-critical)" : "var(--line)" }}
          aria-invalid={!!emailErr}
        />
        {emailErr && <p style={fieldErrStyle}>{errMsg(emailErr)}</p>}
      </div>

      <div>
        <label htmlFor="password" style={labelStyle}>
          {t("login.password")}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setPassErr(vRequired(password) ?? minLength(password, 6))}
          style={{ ...inputStyle, borderColor: passErr ? "var(--st-critical)" : "var(--line)" }}
          aria-invalid={!!passErr}
        />
        {passErr && <p style={fieldErrStyle}>{errMsg(passErr)}</p>}
      </div>

      {formErr && (
        <div
          role="alert"
          style={{
            background: "var(--st-critical-bg)",
            border: "1px solid var(--st-critical)",
            color: "var(--st-critical-fg)",
            borderRadius: "var(--r-lg)",
            padding: "10px 12px",
            fontSize: 12.5,
          }}
        >
          {formErr}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          minHeight: 44,
          borderRadius: "var(--r-md)",
          background: "var(--cta-bg)",
          color: "var(--cta-fg)",
          border: "none",
          fontWeight: 700,
          fontSize: 13,
          cursor: submitting ? "default" : "pointer",
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? t("login.submitting") : t("login.submit")}
      </button>
    </form>
  );
}
