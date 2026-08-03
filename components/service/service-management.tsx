"use client";

import type { ComponentProps } from "react";
import { ServiceCatalog } from "@/components/catalog/service-catalog";
import { Governance } from "@/components/sla/governance";
import { TabbedScreen } from "@/components/ui/tabbed-screen";
import { useI18n } from "@/lib/i18n/provider";

// Fusion "Catalogo y SLA" (Fase B): una sola pantalla con pestanas que reusa los componentes
// existentes de Catalogo de servicios y Gobierno SLA. La pestana SLA solo se ofrece si el server
// resolvio permiso (sla=null cuando el usuario no tiene sla.read) -> el solicitante ve solo el
// catalogo, sin cambio. Cero reescritura de logica.

export function ServiceManagement({ catalog, sla }: {
  catalog: ComponentProps<typeof ServiceCatalog>;
  sla: ComponentProps<typeof Governance> | null;
}) {
  const { t } = useI18n();
  if (!sla) return <ServiceCatalog {...catalog} />;
  return (
    <TabbedScreen tabs={[
      { key: "catalogo", label: t("nav.servicecatalog"), content: <ServiceCatalog {...catalog} /> },
      { key: "sla", label: t("nav.sla"), content: <Governance {...sla} /> },
    ]} />
  );
}
