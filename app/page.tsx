import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LandingLogin } from "@/components/landing/landing-login";

// Pantalla de entrada / landing de marca (negro Credix, fija, no afectada por el tema).
// El login vive aqui mismo: al autenticar cae directo en la app (sin pantalla intermedia).
// Si ya hay sesion, el panel ofrece entrar directo al dashboard.

const CSS = `
.lp { position:relative; min-height:100vh; background:#0A0A0B; color:#FFFFFF; overflow:hidden;
  font-family:var(--font-ui, Inter, system-ui, sans-serif); }
.lp-bg { position:fixed; inset:0; pointer-events:none;
  background:
    radial-gradient(1100px 720px at 10% -8%, rgba(228,0,43,.24), transparent 58%),
    radial-gradient(900px 640px at 112% 118%, rgba(228,0,43,.12), transparent 55%); }
.lp-grid { position:fixed; inset:0; pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
  background-size:48px 48px;
  -webkit-mask-image:radial-gradient(1000px 700px at 30% 10%, #000 30%, transparent 80%);
  mask-image:radial-gradient(1000px 700px at 30% 10%, #000 30%, transparent 80%); }
.lp-wrap { position:relative; z-index:2; max-width:1240px; margin:0 auto; padding:26px 44px 52px; }
.lp-mono { font-family:var(--font-mono, "JetBrains Mono", monospace); }
.lp-display { font-family:var(--font-display, "Plus Jakarta Sans", sans-serif); }

.lp-top { display:flex; align-items:center; justify-content:space-between; padding-bottom:56px; }
.lp-brand { display:flex; align-items:center; gap:12px; }
.lp-iso { width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,#FF2247,#B00021);
  box-shadow:0 4px 18px rgba(228,0,43,.5); display:grid; place-items:center; flex-shrink:0; }
.lp-word { font-family:var(--font-display); font-weight:800; font-size:20px; letter-spacing:-.5px; color:#fff; }
.lp-word b { color:#E4002B; font-weight:800; }
.lp-topright { display:flex; align-items:center; gap:16px; }
.lp-tag { font-family:var(--font-mono); font-size:11px; letter-spacing:1.5px; color:#8A8F97; text-transform:uppercase; }
.lp-pill { font-family:var(--font-mono); font-size:11px; color:#FF5A70; border:1px solid rgba(228,0,43,.4); border-radius:20px; padding:4px 12px; }
.lp-enter { color:#E7E7E9; font-size:13px; font-weight:600; text-decoration:none; }
.lp-enter:hover { color:#FF1F45; }

.lp-hero { display:grid; grid-template-columns:1.12fr .88fr; gap:56px; align-items:center; }
.lp-kicker { display:flex; align-items:center; gap:10px; margin-bottom:22px; }
.lp-dot { width:7px; height:7px; border-radius:50%; background:#E4002B; box-shadow:0 0 12px 2px rgba(228,0,43,.7); flex-shrink:0; }
.lp-kicker span { font-family:var(--font-mono); font-size:11.5px; letter-spacing:2px; color:#B9BEC4; text-transform:uppercase; }
.lp-h1 { font-family:var(--font-display); font-weight:800; font-size:54px; line-height:1.04; letter-spacing:-1.8px; margin:0 0 22px; }
.lp-h1 em { color:#E4002B; font-style:normal; }
.lp-p { font-size:16.5px; line-height:1.65; color:#9AA0A6; max-width:520px; margin:0 0 30px; }
.lp-p b { color:#E7E7E9; font-weight:600; }
.lp-cta { display:flex; gap:14px; flex-wrap:wrap; margin-bottom:26px; }
.lp-btn1 { background:#E4002B; color:#fff; font-size:14.5px; font-weight:700; padding:14px 26px; border-radius:12px; text-decoration:none;
  box-shadow:0 12px 34px -8px rgba(228,0,43,.65); display:inline-flex; align-items:center; gap:9px; }
.lp-btn1:hover { background:#FF1F45; }
.lp-btn2 { background:transparent; color:#E7E7E9; font-size:14.5px; font-weight:600; padding:14px 24px; border-radius:12px; text-decoration:none;
  border:1px solid rgba(255,255,255,.22); display:inline-flex; align-items:center; }
.lp-btn2:hover { border-color:#fff; background:rgba(255,255,255,.05); }
.lp-trust { font-family:var(--font-mono); font-size:11.5px; color:#6E7378; }

.lp-panelwrap { position:relative; }
.lp-panelglow { position:absolute; inset:-30px; background:radial-gradient(closest-side, rgba(228,0,43,.28), transparent 72%); filter:blur(8px); }
.lp-login { position:relative; background:linear-gradient(160deg,#151517,#0C0C0D); border:1px solid rgba(255,255,255,.09); border-radius:20px; padding:26px;
  box-shadow:0 34px 90px -24px rgba(228,0,43,.42), inset 0 1px 0 rgba(255,255,255,.05); }
.lp-login h2 { font-family:var(--font-display); font-weight:800; font-size:21px; color:#fff; margin:0 0 4px; letter-spacing:-.4px; }
.lp-login .sub { font-size:12.5px; color:#8A8F97; margin:0 0 22px; }
.lp-login input::placeholder { color:#5E636A; }
.lp-login input:focus { border-color:rgba(228,0,43,.55) !important; background:rgba(255,255,255,.06) !important; }
.lp-login-foot { margin-top:18px; padding-top:16px; border-top:1px solid rgba(255,255,255,.08); display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:10.5px; color:#6E7378; }
.lp-authed { text-align:center; }
.lp-authed p { font-size:13px; color:#9AA0A6; margin:0 0 18px; }
.lp-panel { position:relative; background:linear-gradient(160deg,#151517,#0C0C0D); border:1px solid rgba(255,255,255,.09); border-radius:20px; padding:24px;
  box-shadow:0 34px 90px -24px rgba(228,0,43,.42), inset 0 1px 0 rgba(255,255,255,.05); }
.lp-phead { display:flex; align-items:center; gap:10px; margin-bottom:18px; }
.lp-phead .id { font-family:var(--font-mono); font-size:12px; color:#FF5A70; }
.lp-phead .svc { font-size:12.5px; color:#8A8F97; }
.lp-crit { margin-left:auto; display:flex; align-items:center; gap:7px; font-size:12px; font-weight:700; color:#FF5A70; }
.lp-decision { display:flex; align-items:center; gap:18px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:14px; padding:16px; margin-bottom:16px; }
.lp-ring { width:82px; height:82px; border-radius:50%; background:conic-gradient(#E4002B 0 82%, rgba(255,255,255,.09) 82% 100%);
  box-shadow:0 0 26px -4px rgba(228,0,43,.6); display:grid; place-items:center; flex-shrink:0; }
.lp-ring > div { width:58px; height:58px; border-radius:50%; background:#0E0E10; display:grid; place-items:center; }
.lp-ring .n { font-family:var(--font-mono); font-size:24px; color:#fff; line-height:1; }
.lp-ring .d { font-family:var(--font-mono); font-size:8.5px; color:#8A8F97; }
.lp-decision .lbl { font-size:10.5px; text-transform:uppercase; letter-spacing:.5px; color:#8A8F97; margin-bottom:4px; }
.lp-decision .val { font-family:var(--font-display); font-weight:700; font-size:17px; color:#fff; }
.lp-decision .val em { color:#E4002B; font-style:normal; }
.lp-decision .th { font-family:var(--font-mono); font-size:11px; color:#6E7378; margin-top:4px; }
.lp-pipe { display:flex; justify-content:space-between; margin-bottom:16px; padding:0 4px; }
.lp-node { display:flex; flex-direction:column; align-items:center; gap:8px; }
.lp-node .p { width:9px; height:9px; border-radius:50%; background:#E4002B; box-shadow:0 0 10px 1px rgba(228,0,43,.7); }
.lp-node.last .p { background:#0E0E10; box-shadow:inset 0 0 0 2px #E4002B; }
.lp-node span { font-size:9.5px; color:#9AA0A6; }
.lp-seal { display:flex; align-items:center; gap:12px; background:rgba(228,0,43,.08); border:1px solid rgba(228,0,43,.22); border-radius:12px; padding:12px 14px; }
.lp-seal .tile { width:34px; height:34px; border-radius:9px; background:rgba(228,0,43,.15); display:grid; place-items:center; flex-shrink:0; }
.lp-seal .m { font-family:var(--font-mono); font-size:10.5px; color:#6E7378; line-height:1.5; }
.lp-seal .m b { color:#E7E7E9; }
.lp-seal .ok { margin-left:auto; display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; color:#fff; }

.lp-pillars { display:grid; grid-template-columns:repeat(6,1fr); gap:1px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.08); border-radius:16px; overflow:hidden; margin-top:64px; }
.lp-pillar { background:#0C0C0D; padding:20px 18px; }
.lp-pillar:hover { background:#121214; }
.lp-pillar .tile { width:36px; height:36px; border-radius:9px; background:rgba(228,0,43,.12); display:grid; place-items:center; margin-bottom:12px; }
.lp-pillar h3 { font-family:var(--font-display); font-weight:700; font-size:14px; color:#fff; margin:0 0 4px; }
.lp-pillar p { font-size:11.5px; color:#8A8F97; margin:0; line-height:1.5; }

.lp-stats { display:grid; grid-template-columns:repeat(4,1fr); border:1px solid rgba(255,255,255,.08); border-radius:16px; overflow:hidden; margin-top:32px; }
.lp-stat { padding:22px 24px; border-left:1px solid rgba(255,255,255,.08); }
.lp-stat:first-child { border-left:none; }
.lp-stat .v { font-family:var(--font-mono); font-size:28px; letter-spacing:-1px; color:#fff; }
.lp-stat .l { font-size:11.5px; color:#8A8F97; margin-top:4px; }

.lp-foot { display:flex; align-items:center; justify-content:space-between; margin-top:40px; padding-top:20px; border-top:1px solid rgba(255,255,255,.08); }
.lp-foot .c { font-size:12px; color:#6E7378; }
.lp-foot .m { font-family:var(--font-mono); font-size:11px; color:#6E7378; }

.lp a:focus-visible, .lp .lp-pillar:focus-visible { outline:none; box-shadow:0 0 0 3px rgba(228,0,43,.35); }

@media (max-width:1024px){
  .lp-hero{ grid-template-columns:1fr; gap:36px; }
  .lp-pillars{ grid-template-columns:repeat(3,1fr); }
  .lp-stats{ grid-template-columns:repeat(2,1fr); }
  .lp-h1{ font-size:44px; }
}
@media (max-width:640px){
  .lp-wrap{ padding:20px 20px 40px; }
  .lp-h1{ font-size:37px; }
  .lp-topright .lp-tag, .lp-topright .lp-pill { display:none; }
  .lp-stat:nth-child(3){ border-left:none; }
}
@media (prefers-reduced-motion: reduce){ .lp-dot, .lp-node .p { box-shadow:none; } }
`;

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Cube({ c, s = 22 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" style={{ color: c }} aria-hidden {...stroke}>
      <path d="M12 2 21 7v10l-9 5-9-5V7z" /><path d="M12 7v10M7.5 9.5l9 5M16.5 9.5l-9 5" opacity={0.55} />
    </svg>
  );
}
const PILLARS = [
  { t: "ITSM", d: "Incidentes, catálogo y CMDB", i: <path d="M12 3 2 20h20L12 3zM12 10v4M12 17v.5" /> },
  { t: "Rule Engine", d: "Scoring ponderado y decisión", i: <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M18 18h2M14 4v4M8 10v4M16 16v4" /> },
  { t: "Project Engine", d: "Incidente → proyecto con business case", i: <path d="M12 3 3 8l9 5 9-5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5" /> },
  { t: "GRC", d: "Riesgo, cumplimiento y control", i: <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3zM12 8v4l2 2" /> },
  { t: "Ledger inmutable", d: "Hash chaining y verificación", i: <path d="M12 2 21 7v10l-9 5-9-5V7z M9 12l2 2 4-4" /> },
  { t: "IA / Agentic", d: "RCA y recomendación automática", i: <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15z" /> },
];
const STATS = [
  { v: "148", l: "incidentes gestionados / mes" },
  { v: "18%", l: "conversión a proyectos" },
  { v: "100%", l: "integridad del ledger" },
  { v: "₡340M", l: "valor en riesgo mitigado" },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const authed = !!user;

  return (
    <main className="lp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lp-bg" /><div className="lp-grid" />
      <div className="lp-wrap">
        {/* Topbar */}
        <header className="lp-top">
          <div className="lp-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/credix-logo.png" alt="Credix" style={{ height: 38, width: "auto", display: "block", objectFit: "contain" }} />
            <span className="lp-word">Credix<b>Nexus</b></span>
          </div>
          <div className="lp-topright">
            <span className="lp-tag">ITSM · AUDIT-GRADE</span>
            <span className="lp-pill lp-mono">MVP v1.0</span>
            {authed
              ? <Link href="/dashboard" className="lp-enter">Ir a la plataforma →</Link>
              : <a href="#login" className="lp-enter">Iniciar sesión →</a>}
          </div>
        </header>

        {/* Hero */}
        <section className="lp-hero">
          <div>
            <div className="lp-kicker"><span className="lp-dot" /><span>PLATAFORMA ITSM + TRANSFORMACIÓN</span></div>
            <h1 className="lp-h1">De un ticket operativo a un proyecto transformacional <em>auditado</em>.</h1>
            <p className="lp-p">CredixNexus unifica mesa de ayuda, motor de reglas, gestión de proyectos, GRC y un <b>ledger inmutable</b> para que cada incidente de Credix genere aprendizaje, trazabilidad y transformación — no solo una solución puntual.</p>
            <div className="lp-cta">
              {authed
                ? <Link href="/dashboard" className="lp-btn1">Entrar a la plataforma <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
                : <a href="#login" className="lp-btn1">Iniciar sesión <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M5 12h14M13 6l6 6-6 6" /></svg></a>}
            </div>
            <div className="lp-trust lp-mono">13+ años · Credix World S.A. · Costa Rica</div>
          </div>

          {/* Panel de acceso: login directo o entrada a la plataforma */}
          <div className="lp-panelwrap">
            <div className="lp-panelglow" />
            {authed ? (
              <div className="lp-login lp-authed">
                <h2>Sesión activa</h2>
                <p>Ya iniciaste sesión. Entra directo a la plataforma.</p>
                <Link href="/dashboard" className="lp-btn1" style={{ width: "100%", justifyContent: "center" }}>Ir a la plataforma <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden {...stroke}><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
              </div>
            ) : (
              <div className="lp-login">
                <h2>Iniciar sesión</h2>
                <p className="sub">Accedé con tu correo corporativo.</p>
                <LandingLogin />
                <div className="lp-login-foot">
                  <Cube c="#FF5A70" s={14} /> acceso auditado · ledger inmutable · multi-tenant
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Pilares */}
        <section className="lp-pillars">
          {PILLARS.map((p) => (
            <div key={p.t} className="lp-pillar">
              <div className="tile"><svg width="18" height="18" viewBox="0 0 24 24" style={{ color: "#FF3B57" }} aria-hidden {...stroke}>{p.i}</svg></div>
              <h3>{p.t}</h3><p>{p.d}</p>
            </div>
          ))}
        </section>

        {/* Métricas */}
        <section className="lp-stats">
          {STATS.map((s) => (<div key={s.l} className="lp-stat"><div className="v lp-mono">{s.v}</div><div className="l">{s.l}</div></div>))}
        </section>

        {/* Footer */}
        <footer className="lp-foot">
          <span className="c">© Credix · CredixNexus</span>
          <span className="m lp-mono">de la operación diaria → inteligencia de transformación</span>
        </footer>
      </div>
    </main>
  );
}
