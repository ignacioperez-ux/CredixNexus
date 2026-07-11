import { describe, it, expect } from "vitest";
import { validateVendor } from "./validation";
import { ErrorCode } from "@/lib/validation";

describe("validateVendor", () => {
  const base = { code: "VND-X", name: "Proveedor X", category: "saas", criticality: "high" };
  it("acepta un proveedor valido", () => {
    expect(validateVendor(base)).toBeNull();
  });
  it("rechaza codigo o nombre corto", () => {
    expect(validateVendor({ ...base, code: "V" })).toBe(ErrorCode.MIN_LENGTH);
    expect(validateVendor({ ...base, name: "X" })).toBe(ErrorCode.MIN_LENGTH);
  });
  it("rechaza categoria o criticidad invalidas", () => {
    expect(validateVendor({ ...base, category: "foo" })).toBe(ErrorCode.FORMAT);
    expect(validateVendor({ ...base, criticality: "extreme" })).toBe(ErrorCode.FORMAT);
  });
  it("valida el email de contacto si viene", () => {
    expect(validateVendor({ ...base, contactEmail: "no-es-email" })).toBe(ErrorCode.FORMAT);
    expect(validateVendor({ ...base, contactEmail: "ok@vendor.com" })).toBeNull();
  });
  it("vigencia de contrato: fin no anterior al inicio", () => {
    expect(validateVendor({ ...base, contractStart: "2026-01-01", contractEnd: "2025-01-01" })).toBe(ErrorCode.FORMAT);
    expect(validateVendor({ ...base, contractStart: "2025-01-01", contractEnd: "2026-01-01" })).toBeNull();
  });
});
