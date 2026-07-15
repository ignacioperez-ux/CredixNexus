"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Fuente unica del historial de navegacion in-app (vive en el layout -> sobrevive los cambios de
// ruta). Estandariza TODO el "Volver"/"Cancelar" del app:
//  - `canGoBack`: hay una pantalla anterior in-app (llegaste navegando, no por deep-link/recarga).
//  - `back(fallback)`: si hay historial regresa a la pantalla que invoco la actual (router.back);
//    si no, navega al padre canonico. Asi la salida es siempre ordenada y nunca abandona el app.
type NavHistoryValue = { canGoBack: boolean; back: (fallback: string) => void };
const NavHistoryCtx = createContext<NavHistoryValue>({ canGoBack: false, back: () => {} });

export function NavHistoryProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [stack, setStack] = useState<string[]>([]);

  useEffect(() => {
    setStack((prev) => {
      if (prev[prev.length - 1] === pathname) return prev;             // misma ruta
      if (prev[prev.length - 2] === pathname) return prev.slice(0, -1); // retroceso: pop
      return [...prev, pathname];                                       // avance: push
    });
  }, [pathname]);

  const canGoBack = stack.length > 1;
  const back = useCallback((fallback: string) => {
    if (canGoBack) router.back();
    else router.push(fallback);
  }, [canGoBack, router]);

  return <NavHistoryCtx.Provider value={{ canGoBack, back }}>{children}</NavHistoryCtx.Provider>;
}

export function useNavHistory(): NavHistoryValue {
  return useContext(NavHistoryCtx);
}
