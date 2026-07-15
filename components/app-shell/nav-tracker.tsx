"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordPath } from "@/lib/nav/nav-history";

// Registra cada navegacion in-app en la pila de historial (lib/nav/nav-history) para que el
// estandar "Volver" (components/common/back-button) sepa si puede regresar al invocador.
export function NavTracker() {
  const pathname = usePathname();
  useEffect(() => { recordPath(pathname); }, [pathname]);
  return null;
}
