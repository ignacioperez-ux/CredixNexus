// Formato de moneda compartido (evita el Intl.NumberFormat duplicado por componente).
// `money` = monto completo (para tooltip / tarjetas con espacio). `moneyShort` = compacto
// (₡1,2 M / $1,2 M) para celdas de tabla estrechas, con el completo en el title.
import type { Locale } from "@/lib/i18n/dictionaries";

function nf(locale: Locale, currency: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  return new Intl.NumberFormat(locale === "es" ? "es-CR" : "en-US", { style: "currency", currency: currency || "CRC", ...opts });
}

export function money(n: number, currency = "CRC", locale: Locale = "es"): string {
  return nf(locale, currency, { maximumFractionDigits: 0 }).format(n);
}

export function moneyShort(n: number, currency = "CRC", locale: Locale = "es"): string {
  // Compacto solo para montos grandes; los pequenos se muestran completos.
  return Math.abs(n) >= 10_000
    ? nf(locale, currency, { notation: "compact", maximumFractionDigits: 1 }).format(n)
    : money(n, currency, locale);
}
