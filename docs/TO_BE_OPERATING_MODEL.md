# Modelo operativo TO-BE — Credix Nexus

Síntesis de mejores prácticas (**ITIL 4**, **ITSM/ISO 20000**, **COBIT 2019**, **SAFe/squads**)
orientada a Credix. Propuesta de arquitectura lógica objetivo. Las ideas de squads/PO/UX/Dev que
compartió Credix son insumo NO formalizado; aquí se ordenan en un modelo coherente y versionado.

Principio rector: **una sola puerta de entrada (mesa de ayuda), tracking y comunicación
client-centric de extremo a extremo**, incluso cuando el trabajo pasa a Evolución.

---

## 1. Capas del modelo (value streams ITIL)

```
              ┌──────────────────────────────────────────────────────────┐
  DEMANDA →   │  INTAKE multicanal  (portal · WhatsApp · correo · llamada │
              │  · API · eventos de sistemas)  →  MESA DE AYUDA (1 puerta) │
              └───────────────┬──────────────────────────────────────────┘
                              │  Clasificar (categoría→gestión) · Priorizar
                              │  (impacto×urgencia→prioridad ITIL) · SLA
              ┌───────────────┴───────────────────────────────────────────┐
   RESOLVER → │  4 caminos (value streams):                                │
              │   A. Incidente   → restaurar servicio → KB                 │
              │   B. Problema    → causa raíz (recurrencia) → known error  │
              │   C. Cambio      → corrección controlada (CAB) → release   │
              │   D. EVOLUCIÓN   → mejora estructural (scoring → RC decide  │
              │                    → squad entrega) — diferenciador Credix  │
              └───────────────┬───────────────────────────────────────────┘
   GOBERNAR → │  Overlay COBIT: políticas · normas · procedimientos ·      │
              │  procesos · controles + LEDGER inmutable (toda decisión)   │
              └────────────────────────────────────────────────────────────┘
```

La mesa **nunca cierra** el caso al pasar a Evolución: cambia a `in_evolution` y mantiene el hilo
de comunicación con el cliente. El squad ejecuta; la mesa comunica.

**Separación de responsabilidades (confirmada por Credix):**
- **Incidencias → equipo de Soporte (Operaciones).** No Evolución, no Tecnología.
- **Proyectos y mejoras → squads (Evolución).**
La mesa (Operaciones) resuelve y comunica; los squads entregan la transformación. El puente entre
ambos es la recomendación aprobada por el RC, y el ancla de comunicación sigue siendo el incidente.

---

## 2. Modelo organizativo TO-BE

| Figura | Definición | Decide / posee | Entidad |
|---|---|---|---|
| **Unidad de Negocio** | Área de negocio (Seguros, Préstamos, Cobranza, Medios de pago, Pagos, Casa de cambio, CDC) | Demanda y prioridad del área | `business_unit` |
| **Responsable Comercial (RC)** | 1 por unidad de negocio | **Decide y prioriza** qué mejora va a Evolución (voto de negocio) | `business_unit.rc_user_id` |
| **Producto** | Catálogo financiero | — | `product` |
| **Product Owner (PO)** | 1 PO por producto; un PO puede tener varios productos | Backlog de producto; lidera squad | `product.owner_user_id` |
| **Aplicación / Canal / Sistema** | Activos de la CMDB | PO/UX/Dev responsables + **Peso** | `configuration_item` / `channel` + `asset_assignment` |
| **Squad** | Equipo **transversal** (cross-funcional: PO+UX+Dev+QA), capacidad ~7 pts | Ejecuta proyectos/mejoras | `squad` (+ `squad_member` TO-BE) |
| **Mesa de ayuda** | Dueña del ciclo del caso y la comunicación | Tracking end-to-end, SLA | `incident` + `incident_comment` |

**Asignaciones** (flexibles, versionadas): RC→unidad, PO→producto(s), PO→squad, y PO/UX/Dev→activo
(`asset_assignment` con `weight`). Los squads son transversales: atienden varias áreas/productos.

---

## 3. Flujo TO-BE con roles (RACI simplificado)

| Paso | Responsable (R) | Aprueba (A) | Consultado (C) | Informado (I) |
|---|---|---|---|---|
| Intake / registro | Mesa / Agente | — | — | Cliente |
| Clasificación + priorización | Agente soporte | Líder soporte | CMDB / PO | Cliente |
| Resolver incidente | Agente / Squad soporte | Líder soporte | — | Cliente |
| Detectar problema (recurrencia) | Líder soporte | — | PO | Negocio |
| **Scoring de transformación** | Motor (automático) | — | — | RC, PO |
| **Decidir/priorizar Evolución** | **RC (negocio)** | RC / Comité | PO, GRC | Squad, Cliente |
| Planificar capacidad | PO del squad | — | Squad | RC |
| Ejecutar mejora | Squad (PO/UX/Dev/QA) | Change Manager | GRC | Cliente (vía mesa) |
| Cambio/Release | Change Manager | CAB | Squad | Cliente |
| Cerrar loop + comunicar | **Mesa** | — | — | Cliente |

El motor **recomienda** (señal objetiva); el **RC decide** (juicio de negocio). Nunca al revés.

---

## 4. Modelo de priorización TO-BE (recomendado: WSJF + score)

Prioridad en **dos niveles**, para separar señal objetiva de decisión de negocio:

1. **Transformation Score** (motor, 0-100): impacto financiero, recurrencia, servicio crítico,
   impacto partner, calidad de datos, riesgo/seguridad, workaround manual, alineación estratégica.
   → Umbrales: 0-39 operativo · 40-69 problema · 70-84 recomendar proyecto · 85-100 auto-Evolución.
2. **Decisión y prioridad de negocio (RC)**: el RC fija `business_priority`. Recomendado formalizar
   con **WSJF (SAFe)** = (valor de negocio + criticidad temporal + reducción de riesgo) / **tamaño**,
   donde el **Peso** del activo/mejora aporta el "tamaño/esfuerzo".
3. **Capacidad del squad**: asignación por **puntos/pesos** (ej. máx ~7 pts por squad) → factibilidad.

Resultado: un backlog de Evolución **priorizado por negocio y factible por capacidad**, con la señal
del motor como insumo auditable.

---

## 5. Reconciliación con lo ya construido (y brechas para el TO-BE)

**Ya implementado (F0-F2):**
tenant(modo) · business_unit(+RC) · product(+PO) · configuration_item(apps/sistemas) · channel ·
process(jerarquía macro/proceso/micro) · squad(transversal, +PO) · team_member · asset_assignment
(PO/UX/Dev+peso) · incident(+SLA+categoría+dimensiones) · incident_category · sla_policy ·
knowledge_article · rule/rule_version/rule_evaluation · project_recommendation(decisión RC) ·
governance_item/link · immutable_audit_event(ledger).

**Brechas para completar el TO-BE:**
| Brecha | Módulo | Fase |
|---|---|---|
| `squad_member` (M:N con rol PO/UX/Dev/QA) + capacidad en puntos | Squads | F2.5 |
| `project` (Evolución) + `project ↔ squad` + backlog priorizado (WSJF) | Proyectos | F3 |
| `problem` (causa raíz, known error) | ITIL Problem | F3 |
| `change_request` + `release` + CAB | ITIL Change | F4 |
| Ficha de Proceso + matrices proceso↔sistema, producto↔canal (RACI) | Gobierno de datos | F4 |
| Portal partner (self-service, visibilidad restringida) | Experiencia | F5 |

---

## 6. Decisiones de diseño clave del TO-BE

1. **Mesa como dueña del caso** (no lo suelta) — el incidente es el ancla de comunicación; el
   proyecto de Evolución es el vehículo de ejecución; ambos enlazados.
2. **Motor recomienda, negocio decide** — separación explícita señal/decisión (control COBIT).
3. **Squads transversales con capacidad** — priorización factible (WSJF + puntos), no sólo deseada.
4. **Todo versionado y gobernado** — catálogos, reglas, fichas y matrices absorben cambios sin
   rediseño; toda decisión relevante deja evento en el ledger.
5. **Multicanal con una sola puerta** — cualquier canal entra a la misma mesa con trazabilidad.

> Este documento es la brújula del "to-be". Las estructuras de datos ya soportan lo esencial; las
> brechas de §5 se cierran en las fases indicadas cuando Credix formalice squads y matrices.
