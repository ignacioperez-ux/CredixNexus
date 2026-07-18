// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mocks de dependencias del Header (navegacion, i18n, tema, hijos y server actions).
// isPortalNav / resolvePrimaryAction quedan REALES (puros) para ejercitar el modo portal de verdad.
vi.mock("next/navigation", () => ({
  usePathname: () => "/portal",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/i18n/provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "es", setLocale: vi.fn() }),
}));
vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ theme: "claro", setTheme: vi.fn() }),
}));
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }));
vi.mock("@/components/app-shell/notification-bell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/help/concept-tip", () => ({ ConceptTip: () => null }));
vi.mock("@/lib/help/concepts", () => ({ conceptForPath: () => null }));
vi.mock("@/lib/auth/actions", () => ({ signOutAction: vi.fn() }));

import { Header } from "./header";
import { isPortalNav } from "@/lib/nav/navigation";

afterEach(cleanup);

describe("Header · toggle de tema en Mi Portal", () => {
  it("en modo portal (partner_user) aparece la opcion oscuro (Nexus) y Claro", () => {
    // Precondicion: partner_user ES portal (isPortalNav true) -> antes el toggle se ocultaba aca.
    expect(isPortalNav(["partner_user"], false)).toBe(true);

    render(<Header roles={["partner_user"]} perms={[]} isAdmin={false} />);

    // El toggle de tema esta presente en el portal con AMBAS opciones.
    expect(screen.getByRole("button", { name: "theme.nexus" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "theme.claro" })).toBeTruthy();
  });

  it("tambien aparece fuera del portal (admin)", () => {
    expect(isPortalNav([], true)).toBe(false);
    render(<Header roles={[]} perms={["incident.read"]} isAdmin />);
    expect(screen.getByRole("button", { name: "theme.nexus" })).toBeTruthy();
  });
});
