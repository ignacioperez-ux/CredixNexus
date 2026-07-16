// Color deterministico por squad (clave para identificar tareas de gente compartida entre squads).
// Paleta de hex con fondo/borde translucidos (8 digitos alpha): funciona igual en Nexus y Claro,
// sin depender de tokens que solo existen en un tema.
const PALETTE = ["#2D7FF9", "#7A3FE0", "#0E8F82", "#C77700", "#C63066", "#0E8C55", "#0E7FA8", "#5B6BE0"];

export function squadColor(code: string | null | undefined): { fg: string; bg: string; border: string } {
  const key = code ?? "—";
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const fg = PALETTE[h % PALETTE.length];
  return { fg, bg: fg + "22", border: fg + "55" };
}
