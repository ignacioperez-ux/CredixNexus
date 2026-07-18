// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";

// vi.mock se hoistea por encima de los consts, asi que todo lo que las factories referencian va en
// vi.hoisted. currentTab es mutable (objeto) para simular navegacion sin remontar el componente:
// cambiar ?tab= NO desmonta Portal -> reproduce el caso real del bug.
const h = vi.hoisted(() => ({
  currentTab: { value: "registrar" },
  router: { push: vi.fn(), refresh: vi.fn(), replace: vi.fn() },
  createIncident: vi.fn(async () => ({ ok: true, id: "inc-1", number: "INC-2026-000999" })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => h.router,
  useSearchParams: () => ({
    get: (k: string) => (k === "tab" ? h.currentTab.value : null),
    toString: () => `tab=${h.currentTab.value}`,
  }),
}));

// i18n: t devuelve la clave (basta para localizar textos por su key estable).
vi.mock("@/lib/i18n/provider", () => ({
  useI18n: () => ({ t: (k: string) => k, locale: "es" }),
  useErrorMessage: () => (c: string | null) => c,
}));

// Server actions / modulos server-only: mockeados (no importables en jsdom).
vi.mock("@/lib/incidents/actions", () => ({
  createIncident: h.createIncident,
  checkMySimilarCases: vi.fn(async () => ({ ok: true, items: [] })),
}));
vi.mock("@/lib/portal/assist", () => ({
  portalAssist: vi.fn(async () => ({ ok: true, aiConfigured: false, articles: [], cases: [] })),
  searchKb: vi.fn(async () => ({ articles: [], cases: [] })),
}));
vi.mock("@/lib/portal/case-actions", () => ({ uploadMyCaseEvidence: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/knowledge/actions", () => ({ recordKbEvent: vi.fn(async () => ({ ok: true })) }));

// Hijos pesados / de presentacion: stubs.
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }));
vi.mock("@/components/portal/hub-viz", () => ({ SlaRing: () => null }));
vi.mock("@/components/ai/ai-report", () => ({ AiReport: () => null }));
vi.mock("@/components/knowledge/feedback-widget", () => ({ FeedbackWidget: () => null }));
vi.mock("next/link", () => ({ default: ({ children }: { children: React.ReactNode }) => children }));

import { Portal } from "./portal";

const categories = [{ id: "c1", code: "ACCESS", name: "Acceso", name_en: "Access" }];
const renderPortal = () => render(<Portal categories={categories} canFeedback={false} />);
const findCatSelect = () =>
  screen
    .getAllByRole("combobox")
    .find((s) => Array.from((s as HTMLSelectElement).options).some((o) => o.value === "c1")) as HTMLSelectElement;

afterEach(() => {
  cleanup();
  h.currentTab.value = "registrar";
  vi.clearAllMocks();
});

describe("Portal · registro y limpieza del intake", () => {
  it("tras registrar, al salir y volver a Registrar el intake queda limpio", async () => {
    h.currentTab.value = "registrar";
    const view = renderPortal();

    // 1) Asunto (>= MIN_CHARS) + categoria.
    const textarea = screen.getByPlaceholderText("portal.search.placeholder") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Necesito acceso al sistema core" } });
    expect(textarea.value).toContain("acceso");
    const catSelect = findCatSelect();
    fireEvent.change(catSelect, { target: { value: "c1" } });
    expect(catSelect.value).toBe("c1");

    // 2) Registrar -> mensaje de exito con el numero del caso.
    fireEvent.click(screen.getByRole("button", { name: "portal.register" }));
    await waitFor(() => expect(h.createIncident).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText("INC-2026-000999")).not.toBeNull());

    // 3) SALIR de Registrar (Inicio): el mensaje desaparece (reset del estado transitorio).
    h.currentTab.value = "inicio";
    view.rerender(<Portal categories={categories} canFeedback={false} />);
    await waitFor(() => expect(screen.queryByText("INC-2026-000999")).toBeNull());

    // 4) VOLVER a Registrar: formulario limpio (sin texto ni categoria) y sin mensaje.
    h.currentTab.value = "registrar";
    view.rerender(<Portal categories={categories} canFeedback={false} />);
    expect((screen.getByPlaceholderText("portal.search.placeholder") as HTMLTextAreaElement).value).toBe("");
    expect(findCatSelect().value).toBe("");
    expect(screen.queryByText("INC-2026-000999")).toBeNull();
  });

  it("estando en Registrar, el texto tipeado NO se borra solo (el reset es solo al salir)", async () => {
    h.currentTab.value = "registrar";
    const view = renderPortal();
    const textarea = screen.getByPlaceholderText("portal.search.placeholder") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "texto en progreso" } });
    view.rerender(<Portal categories={categories} canFeedback={false} />);
    expect((screen.getByPlaceholderText("portal.search.placeholder") as HTMLTextAreaElement).value).toBe("texto en progreso");
  });
});
