#!/usr/bin/env node
/* ============================================================================
 * generate-credix-tokens.mjs
 * ----------------------------------------------------------------------------
 * Generador reproducible de tokens del Design System oficial de Credix.
 *
 * Entrada (Design Tokens / formato Figma, ya con $value RESUELTO):
 *   design-system/source/primitives/Mode 1.tokens.json   (1. Primitives)
 *   design-system/source/semantic/Baseline.tokens.json   (2. Semantic  <- fuente de verdad)
 *   design-system/source/components/Mode 1.tokens.json    (3. Component)
 *
 * Salida:
 *   design-system/generated/primitives.ts   tokens primitivos tipados
 *   design-system/generated/semantic.ts     tokens semanticos tipados (scheme/typescale)
 *   design-system/generated/components.ts    tokens de componentes tipados
 *   design-system/generated/credix-tokens.css  custom properties CSS curadas
 *   design-system/generated/tokens.json      volcado normalizado (debug/trazabilidad)
 *
 * Uso:  node scripts/generate-credix-tokens.mjs
 *
 * Reglas (ver prompt Fase 2):
 *  - recorre recursivamente, reconoce nodos con $value, conserva $type/$description
 *  - excluye tokens de PRUEBA (grupo prueba, "Color prueba", "surface prueba", etc.)
 *  - maneja color con alpha, no agrega px indiscriminadamente
 *  - nombres estables/legibles, sin colisiones
 *  - valida los valores de identidad Credix y aborta si faltan
 * ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'design-system/source');
const OUT = resolve(ROOT, 'design-system/generated');

const FILES = {
  primitives: resolve(SRC, 'primitives/Mode 1.tokens.json'),
  semantic: resolve(SRC, 'semantic/Baseline.tokens.json'),
  components: resolve(SRC, 'components/Mode 1.tokens.json'),
};

/* ---- Exclusion de tokens de prueba (case-insensitive, por segmento de path) ---- */
const TEST_PATTERNS = [/(^|\/)prueba(\/|$)/i, /prueba/i, /\bwarning\b.*prueba/i];
const isTest = (path) => TEST_PATTERNS.some((re) => re.test(path));

/* ---- Utilidades de nombre ---- */
const slug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // acentos
    .replace(/[⚠️()]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const cssVar = (segments) => '--credix-' + segments.map(slug).filter(Boolean).join('-');

/* ---- Resolucion de $value segun $type ---- */
function resolveValue(node) {
  const t = node.$type;
  const v = node.$value;
  if (t === 'color') {
    // color figma resuelto: { colorSpace, components:[r,g,b], alpha, hex }
    if (v && typeof v === 'object') {
      const hex = (v.hex || '#000000').toUpperCase();
      const alpha = typeof v.alpha === 'number' ? v.alpha : 1;
      if (alpha < 0.999 && Array.isArray(v.components)) {
        const [r, g, b] = v.components.map((c) => Math.round(c * 255));
        return { css: `rgba(${r}, ${g}, ${b}, ${+alpha.toFixed(4)})`, raw: { hex, alpha } };
      }
      return { css: hex, raw: { hex, alpha } };
    }
    return { css: String(v), raw: v };
  }
  if (t === 'number') {
    return { css: v, raw: v }; // sin px: el consumidor decide (radio/px, weight, opacidad)
  }
  // string, dimension, etc.
  return { css: v, raw: v };
}

/* ---- Recorrido recursivo: devuelve lista de leaves {path[], type, value, description} ---- */
function collect(obj, trail, acc) {
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$')) continue;
    const node = obj[key];
    if (node == null || typeof node !== 'object') continue;
    const path = [...trail, key];
    if (Object.prototype.hasOwnProperty.call(node, '$value')) {
      const pathStr = path.join('/');
      if (isTest(pathStr)) continue; // <- excluir prueba
      const { css, raw } = resolveValue(node);
      acc.push({
        path,
        name: cssVar(path),
        type: node.$type,
        value: css,
        raw,
        description: node.$description || null,
        figmaId: node.$extensions?.['com.figma.variableId'] || null,
      });
    } else {
      collect(node, path, acc);
    }
  }
}

function load(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/* ============================================================================
 * 1) Cargar y recolectar
 * ========================================================================== */
const raw = {
  primitives: load(FILES.primitives),
  semantic: load(FILES.semantic),
  components: load(FILES.components),
};

const leaves = { primitives: [], semantic: [], components: [] };
collect(raw.primitives, [], leaves.primitives);
collect(raw.semantic, [], leaves.semantic);
collect(raw.components, [], leaves.components);

// Dedupe por nombre (last-wins con aviso)
function dedupe(list, label) {
  const seen = new Map();
  const collisions = [];
  for (const it of list) {
    if (seen.has(it.name)) collisions.push(it.name);
    seen.set(it.name, it);
  }
  if (collisions.length) {
    console.warn(`  ! ${label}: ${collisions.length} colisiones de nombre resueltas (last-wins)`);
  }
  return [...seen.values()];
}
leaves.primitives = dedupe(leaves.primitives, 'primitives');
leaves.semantic = dedupe(leaves.semantic, 'semantic');
leaves.components = dedupe(leaves.components, 'components');

/* ============================================================================
 * 2) Validacion de identidad (aborta si falta algo)
 * ========================================================================== */
// match por ruta EXACTA (fin de path) para evitar que "surface" capture "surface dim"
const pathMatches = (l, needle) => {
  const p = l.path.join('/').toLowerCase();
  const n = needle.toLowerCase();
  return p === n || p.endsWith('/' + n);
};
const findVal = (needle) => {
  for (const l of leaves.semantic) if (pathMatches(l, needle)) return l.value;
  return undefined;
};

const IDENTITY = [
  ['scheme/primary/primary', '#E42313'],
  ['scheme/primary/on primary', '#FFFFFF'],
  ['scheme/secondary/secondary', '#5B5F61'],
  ['scheme/surface/surface', '#F7FAFC'],
  ['scheme/surface/surface container lowest', '#FFFFFF'],
  ['scheme/surface/surface container low', '#F1F4F6'],
  ['scheme/surface/surface container', '#EBEEF0'],
  ['scheme/surface/surface container high', '#E5E9EB'],
  ['scheme/surface/surface container highest', '#E0E3E5'],
  ['scheme/surface/on surface', '#181C1E'],
  ['scheme/surface/on surface variant', '#434749'],
  ['scheme/surface/outline', '#74787A'],
  ['scheme/surface/outline variant', '#C3C7C9'],
  ['scheme/error/error', '#FF4965'],
  ['scheme/error/on error container', '#920029'],
  ['scheme/warning/warning container', '#FFDC49'],
  ['scheme/success/success container', '#19D27E'],
  ['scheme/information/information container', '#5BC0DE'],
  ['scheme/link/link', '#239DF7'],
];

const problems = [];
for (const [needle, expected] of IDENTITY) {
  const got = findVal(needle.toLowerCase());
  if (!got) problems.push(`FALTA token de identidad: ${needle}`);
  else if (String(got).toUpperCase() !== expected.toUpperCase())
    problems.push(`VALOR distinto en ${needle}: esperado ${expected}, encontrado ${got}`);
}

// Tipografia Heebo + pesos
const fontOk = leaves.primitives.some((l) => l.path.join('/').includes('font/type') && l.value === 'Heebo');
if (!fontOk) problems.push('FALTA fuente oficial Heebo en primitives.font.type');
for (const w of [400, 500, 700]) {
  const ok = leaves.primitives.some((l) => l.path.join('/').includes('font/weight') && l.raw === w);
  if (!ok) problems.push(`FALTA peso ${w} en primitives.font.weight`);
}
// Radios
for (const r of [0, 4, 8, 12, 16, 20, 28, 32, 48, 1000]) {
  const ok = leaves.primitives.some((l) => l.path[0] === 'shape' && l.raw === r);
  if (!ok) problems.push(`FALTA radio ${r} en primitives.shape`);
}
// Elevacion
for (const e of [0, 1, 3, 6, 8, 12]) {
  const ok = leaves.primitives.some((l) => l.path[0] === 'elevation' && l.raw === e);
  if (!ok) problems.push(`FALTA elevacion ${e} en primitives.elevation`);
}

if (problems.length) {
  console.error('\n=== VALIDACION DE IDENTIDAD FALLIDA ===');
  for (const p of problems) console.error('  - ' + p);
  console.error('\nMigracion visual detenida (prompt: "si estos valores no estan presentes, deten la migracion").');
  process.exit(1);
}

/* ============================================================================
 * 3) Emision de archivos
 * ========================================================================== */
mkdirSync(OUT, { recursive: true });
const banner = `/* AUTOGENERADO por scripts/generate-credix-tokens.mjs — NO EDITAR A MANO.
 * Fuente: Design System oficial de Credix (export Figma / Design Tokens).
 * Regenerar:  node scripts/generate-credix-tokens.mjs
 */\n`;

function toTs(list, exportName) {
  const entries = list
    .map((l) => {
      const val = typeof l.value === 'number' ? l.value : JSON.stringify(l.value);
      const doc = l.description ? ` // ${l.description.replace(/\s+/g, ' ').slice(0, 90)}` : '';
      return `  ${JSON.stringify(l.name)}: ${val},${doc}`;
    })
    .join('\n');
  return `${banner}\nexport const ${exportName} = {\n${entries}\n} as const;\n\nexport type ${exportName[0].toUpperCase() + exportName.slice(1)}Token = keyof typeof ${exportName};\n`;
}

writeFileSync(resolve(OUT, 'primitives.ts'), toTs(leaves.primitives, 'primitives'));
writeFileSync(resolve(OUT, 'semantic.ts'), toTs(leaves.semantic, 'semantic'));
writeFileSync(resolve(OUT, 'components.ts'), toTs(leaves.components, 'components'));

/* ---- CSS: todas las custom properties (crudas) + capa CURADA semantica estable ---- */
function toCssBlock(list) {
  return list
    .map((l) => {
      const val = typeof l.value === 'number' ? l.value : l.value;
      return `  ${l.name}: ${val};`;
    })
    .join('\n');
}

// Capa curada: nombres cortos estables que consumen los componentes (independiente de rutas Figma)
const g = (needle) => {
  for (const l of leaves.semantic) if (pathMatches(l, needle)) return `var(${l.name})`;
  return undefined;
};
const curated = {
  '--credix-color-primary': g('scheme/primary/primary'),
  '--credix-color-on-primary': g('scheme/primary/on primary'),
  '--credix-color-primary-container': g('scheme/primary/primary container'),
  '--credix-color-secondary': g('scheme/secondary/secondary'),
  '--credix-color-secondary-container': g('scheme/secondary/secondary container'),
  '--credix-color-surface': g('scheme/surface/surface'),
  '--credix-color-surface-lowest': g('scheme/surface/surface container lowest'),
  '--credix-color-surface-low': g('scheme/surface/surface container low'),
  '--credix-color-surface-container': g('scheme/surface/surface container'),
  '--credix-color-surface-high': g('scheme/surface/surface container high'),
  '--credix-color-surface-highest': g('scheme/surface/surface container highest'),
  '--credix-color-on-surface': g('scheme/surface/on surface'),
  '--credix-color-on-surface-variant': g('scheme/surface/on surface variant'),
  '--credix-color-outline': g('scheme/surface/outline'),
  '--credix-color-outline-variant': g('scheme/surface/outline variant'),
  '--credix-color-error': g('scheme/error/error'),
  '--credix-color-on-error-container': g('scheme/error/on error container'),
  '--credix-color-warning-container': g('scheme/warning/warning container'),
  '--credix-color-success-container': g('scheme/success/success container'),
  '--credix-color-information-container': g('scheme/information/information container'),
  '--credix-color-link': g('scheme/link/link'),
};

// Los NO-color (font family/pesos/radios/elevacion) no estan en el bloque crudo (solo color).
// -> se resuelven a LITERAL en la capa curada. rawOf busca el $value crudo de un primitivo.
function rawOf(needle, list) {
  for (const l of list) if (pathMatches(l, needle)) return l.raw;
  return undefined;
}
const px = (n) => (n === undefined ? undefined : `${n}px`);
const fontFamily = rawOf('font/type/plain', leaves.primitives) || 'Heebo';
Object.assign(curated, {
  '--credix-font-family': `'${fontFamily}', Arial, Helvetica, sans-serif`,
  '--credix-font-weight-regular': rawOf('font/weight/regular', leaves.primitives),
  '--credix-font-weight-medium': rawOf('font/weight/medium', leaves.primitives),
  '--credix-font-weight-bold': rawOf('font/weight/bold', leaves.primitives),
  '--credix-radius-none': px(rawOf('shape/none', leaves.primitives)),
  '--credix-radius-xs': px(rawOf('shape/extra-small', leaves.primitives)),
  '--credix-radius-sm': px(rawOf('shape/small', leaves.primitives)),
  '--credix-radius-md': px(rawOf('shape/medium', leaves.primitives)),
  '--credix-radius-lg': px(rawOf('shape/large', leaves.primitives)),
  '--credix-radius-xl': px(rawOf('shape/extra-large', leaves.primitives)),
  '--credix-radius-2xl': px(rawOf('shape/extra-extra-large', leaves.primitives)),
  '--credix-radius-full': px(rawOf('shape/full', leaves.primitives)),
});

const curatedCss = Object.entries(curated)
  .filter(([, v]) => v !== undefined)
  .map(([k, v]) => `  ${k}: ${v};`)
  .join('\n');

const css = `${banner}
/* ----------------------------------------------------------------------------
 * CAPA CRUDA: todas las variables del export (primitivos + semanticos + componentes).
 * Nombres derivados de la ruta Figma. No consumir directamente en componentes;
 * usar la CAPA CURADA de abajo (--credix-color-*, --credix-radius-*, etc.).
 * -------------------------------------------------------------------------- */
:root {
  /* --- primitivos --- */
${toCssBlock(leaves.primitives.filter((l) => l.type === 'color'))}

  /* --- semanticos (scheme Baseline / claro) --- */
${toCssBlock(leaves.semantic.filter((l) => l.type === 'color'))}
}

/* ----------------------------------------------------------------------------
 * CAPA CURADA — estable y semantica. Es la API publica de tokens Credix.
 * -------------------------------------------------------------------------- */
:root {
${curatedCss}
}
`;

writeFileSync(resolve(OUT, 'credix-tokens.css'), css);

// Volcado normalizado para trazabilidad
writeFileSync(
  resolve(OUT, 'tokens.json'),
  JSON.stringify(
    {
      generatedFrom: Object.keys(FILES),
      counts: {
        primitives: leaves.primitives.length,
        semantic: leaves.semantic.length,
        components: leaves.components.length,
      },
      primitives: leaves.primitives,
      semantic: leaves.semantic,
      components: leaves.components,
    },
    null,
    2,
  ),
);

/* ============================================================================
 * 4) Reporte
 * ========================================================================== */
console.log('=== Credix tokens generados OK ===');
console.log(`  primitives : ${leaves.primitives.length} tokens`);
console.log(`  semantic   : ${leaves.semantic.length} tokens`);
console.log(`  components : ${leaves.components.length} tokens`);
console.log('  identidad  : validada (primary #E42313, Heebo, surfaces, radios, elevacion)');
console.log('  salida     : design-system/generated/{primitives,semantic,components}.ts, credix-tokens.css, tokens.json');
