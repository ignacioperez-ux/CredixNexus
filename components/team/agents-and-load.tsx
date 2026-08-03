"use client";

import type { ComponentProps } from "react";
import { TalentList } from "@/components/talent/talent-list";
import { WorkloadView } from "@/components/workload/workload-view";
import { Simulation } from "@/components/workload/simulation";
import { TabbedScreen } from "@/components/ui/tabbed-screen";
import { useI18n } from "@/lib/i18n/provider";

// Fusion "Agentes y carga" (Fase B): una pantalla con pestanas que reusa Talento (Agentes) y
// Workload (Carga = distribucion + simulacion). La pestana Carga solo se ofrece si el server
// resolvio permiso (load=null cuando el usuario no tiene squad.read). Cero reescritura de logica.

export function AgentsAndLoad({ agents, load }: {
  agents: ComponentProps<typeof TalentList>;
  load: { data: ComponentProps<typeof WorkloadView>["data"]; squads: ComponentProps<typeof WorkloadView>["squads"]; simInputs: ComponentProps<typeof Simulation>["inputs"] } | null;
}) {
  const { t } = useI18n();
  if (!load) return <TalentList {...agents} />;
  return (
    <TabbedScreen tabs={[
      { key: "agentes", label: t("op.tab.agentes"), content: <TalentList {...agents} /> },
      { key: "carga", label: t("op.tw.tab.carga"), content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <WorkloadView data={load.data} squads={load.squads} />
          <Simulation inputs={load.simInputs} />
        </div>
      ) },
    ]} />
  );
}
