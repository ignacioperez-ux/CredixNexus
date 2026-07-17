#!/usr/bin/env python3
"""Anonimiza el snapshot de datos (backup/pre_seed_*/*.csv) a un dump versionable.

- Enmascara PII SOLO por (tabla, columna) para no destruir etiquetas de catalogo
  (p.ej. service.name / product.name NO son PII; user_account.full_name SI).
- Determinista: cada valor original -> el mismo valor anonimo (hash sha1[:8]).
- EXCLUYE el ledger (immutable_audit_event): sus payloads before/after llevan filas
  enteras con PII embebida, no confiable de limpiar.
- Salida: sql/seed/snapshot_anon/*.csv (seguro para el repo).

Uso: python sql/seed/anonymize_snapshot.py  (desde la raiz del repo)
"""
import csv, glob, hashlib, os, sys

SRC_GLOB = "backup/pre_seed_*/"
DST = "sql/seed/snapshot_anon"
EXCLUDE = {"immutable_audit_event.csv", "README.txt"}

def h(v: str) -> str:
    return hashlib.sha1(v.encode("utf-8")).hexdigest()[:8]

def email(v):  return f"user_{h(v)}@example.com" if v else v
def uname(v):  return f"user_{h(v)}" if v else v
def pname(v):  return f"Persona {h(v)}" if v else v
def doc(v):    return "XXXXXXXX" if v else v
def phone(v):  return "+000 0000 0000" if v else v
def ref(v):    return f"TXN-{h(v)}" if v else v
def anon(v):   return f"anon_{h(v)}" if v else v
def blank(v):  return "{}" if v else v

# PII por tabla -> {columna: funcion de enmascarado}
PII = {
    "user_account.csv": {"email": email, "username": uname, "full_name": pname, "external_subject": anon},
    "party.csv": {"legal_name": pname, "display_name": pname, "tax_id": doc, "email": email, "phone": phone, "external_ref": anon},
    "team_member.csv": {"name": pname, "email": email},
    "incident.csv": {"customer_name": pname, "transaction_reference": ref, "metadata": blank},
    "digital_experience_event.csv": {"customer_id": anon, "session_id": anon},
}

def main():
    srcs = sorted(glob.glob(SRC_GLOB))
    if not srcs:
        print("No se encontro backup/pre_seed_*/ (dump crudo). Nada que anonimizar.")
        return 1
    src = srcs[-1]
    os.makedirs(DST, exist_ok=True)
    files = sorted(glob.glob(os.path.join(src, "*.csv")))
    report = []
    for path in files:
        fn = os.path.basename(path)
        if fn in EXCLUDE:
            continue
        maskmap = PII.get(fn, {})
        with open(path, newline="", encoding="utf-8") as f:
            rows = list(csv.reader(f))
        if not rows:
            continue
        header = rows[0]
        idx = {header.index(c): fnc for c, fnc in maskmap.items() if c in header}
        out = [header]
        for row in rows[1:]:
            row = list(row)
            for i, fnc in idx.items():
                if i < len(row):
                    row[i] = fnc(row[i])
            out.append(row)
        with open(os.path.join(DST, fn), "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerows(out)
        report.append((fn, len(out) - 1, [header[i] for i in idx]))
    masked = [r for r in report if r[2]]
    print(f"Fuente: {src}")
    print(f"Archivos escritos: {len(report)} (ledger excluido)")
    for fn, n, cols in masked:
        print(f"  ANONIMIZADO {fn}: {n} filas · columnas {cols}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
