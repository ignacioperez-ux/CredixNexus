# Fase 2 · Ajustes de UI (feedback del usuario)

## 1. Botón "Crear ticket" del header no hacía nada
**Causa:** la CTA primaria del `partner_user` (`reportCase`) hacía `router.push("/portal")` — no-op
cuando ya estás en el portal — y usaba jerga "ticket".
**Fix:**
- Etiqueta `pa.report`: "Crear ticket" → **"Reportar caso"** ("Report a case"), sin jerga.
- Ruta → `"/portal?report=1"`; el portal detecta el parámetro y **enfoca + desplaza al intake**
  (`useSearchParams` + effect). Ahora el botón lleva a registrar un caso desde cualquier pantalla.

## 2. Link de Conocimiento "Describe tu caso y te ayudamos →"
Es intencional (deflection → intake). Ahora apunta a `"/portal?report=1"` para **enfocar el intake**
al llegar, consistente con la CTA del header.

## 3. Brand Claro: líneas de las cajas casi negras
`--line` de Claro: `#ECECEC` → **`#3A3A3A`** (borde de cajas claramente visible, casi negro, a
pedido). `--line-soft`: `#F3F3F3` → `#C4C4C4` (separadores internos visibles pero suaves).
*(Afecta todo el tema claro; si resulta muy fuerte, se ajusta el valor.)*

## 4. Evaluación (CSAT): faltaba leyenda de la escala 1-5
Se agregó una **leyenda** en `CaseCsat`: **1 = Menor nivel de satisfacción · 5 = Mayor nivel de
satisfacción** (i18n ES/EN `case.csat.scale.low/high`). Antes no había indicación del significado.

**Verificación:** `lint` 0/0 ✅ · `build` ✅ · `vitest` **250/250** ✅ (test de ruta de `reportCase`
actualizado).
