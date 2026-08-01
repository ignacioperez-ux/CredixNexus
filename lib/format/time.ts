// Tiempos en lenguaje humano (R5). Nunca jerga de SLA ni numeros negativos: "-1025.1 h" es un bug
// de presentacion. Espanol neutro (sin voseo) / ingles segun locale. Presentacion pura (testeable).

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function timeOf(d: Date, locale: string): string {
  return d.toLocaleTimeString(locale === "en" ? "en-US" : "es-CR", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** Solo la hora legible: "3:22 p. m." (P5 paso "Lo recibimos"). */
export function humanTimeOnly(iso: string | null | undefined, locale = "es"): string | null {
  const d = parse(iso);
  return d ? timeOf(d, locale) : null;
}

/** "hace 2 horas" / "hace 5 minutos" / "ahora" / "hace 3 días". Solo pasado; futuro -> "ahora". */
export function humanAgo(iso: string | null | undefined, locale = "es", now: number = Date.now()): string {
  const d = parse(iso);
  if (!d) return "";
  const en = locale === "en";
  const mins = Math.floor((now - d.getTime()) / 60000);
  if (mins < 1) return en ? "just now" : "ahora";
  if (mins < 60) return en ? `${mins} min ago` : `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return en ? `${hours} h ago` : `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return en ? "yesterday" : "ayer";
  if (days < 30) return en ? `${days} days ago` : `hace ${days} días`;
  const months = Math.floor(days / 30);
  return en ? `${months} mo ago` : `hace ${months} meses`;
}

/** Compromiso horario legible para un vencimiento (R5). Vencido -> "Vencido · N días/horas" (sin
 *  negativos). A futuro -> "hoy/mañana antes de las 3:22 p. m." o "28 jul antes de las …". */
export function humanCommitment(iso: string | null | undefined, locale = "es", now: number = Date.now()): string | null {
  const d = parse(iso);
  if (!d) return null;
  const en = locale === "en";
  const diffMs = d.getTime() - now;

  if (diffMs < 0) {
    const overdueH = Math.floor(-diffMs / 3600000);
    if (overdueH < 24) {
      const h = Math.max(1, overdueH);
      return en ? `Overdue · ${h} h` : `Vencido · ${h} h`;
    }
    const days = Math.floor(overdueH / 24);
    return en ? `Overdue · ${days} ${days === 1 ? "day" : "days"}` : `Vencido · ${days} ${days === 1 ? "día" : "días"}`;
  }

  const time = timeOf(d, locale);
  const today = new Date(now);
  const sameDay = d.toDateString() === today.toDateString();
  const tomorrow = new Date(now + 86400000);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  if (sameDay) return en ? `today before ${time}` : `hoy antes de las ${time}`;
  if (isTomorrow) return en ? `tomorrow before ${time}` : `mañana antes de las ${time}`;
  const date = d.toLocaleDateString(en ? "en-US" : "es-CR", { day: "numeric", month: "short" });
  return en ? `${date} before ${time}` : `${date} antes de las ${time}`;
}
