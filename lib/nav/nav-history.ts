"use client";

// Pila de navegacion in-app (en memoria de la pestana). Estandariza el "Volver": permite saber
// si existe una pantalla anterior DENTRO del app (la que invoco la actual). Se vacia tras una
// recarga dura o un deep-link directo -> en ese caso "Volver" cae al padre canonico en vez de
// salir del app o de la pestana. Crece al navegar dentro del SPA -> "Volver" regresa al invocador.

const stack: string[] = [];

/** Registra la ruta actual. Idempotente para la misma ruta; hace pop si es un retroceso. */
export function recordPath(path: string): void {
  const top = stack[stack.length - 1];
  if (top === path) return;
  // Retroceso: si la ruta previa reaparece, hacemos pop en lugar de crecer indefinidamente.
  if (stack[stack.length - 2] === path) stack.pop();
  else stack.push(path);
}

/** Hay una pantalla in-app anterior distinta de la actual (por tanto router.back es seguro). */
export function hasInAppBack(current: string): boolean {
  for (let i = stack.length - 2; i >= 0; i--) {
    if (stack[i] !== current) return true;
  }
  return false;
}
