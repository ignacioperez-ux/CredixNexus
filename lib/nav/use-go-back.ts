"use client";

import { useRouter, usePathname } from "next/navigation";
import { hasInAppBack } from "./nav-history";

/** Estandar de retorno ordenado. Devuelve una funcion que regresa a la pantalla in-app que
 *  invoco la actual (router.back sobre el historial real); si se abrio directo (deep-link o
 *  recarga, sin historial in-app) navega al padre canonico `fallback`. Compartido por el boton
 *  "Volver" (BackButton) y el "Cancelar" de los formularios, para una salida uniforme en el app. */
export function useGoBack(fallback: string): () => void {
  const router = useRouter();
  const pathname = usePathname();
  return () => {
    if (hasInAppBack(pathname)) router.back();
    else router.push(fallback);
  };
}
