import { describe, it, expect } from "vitest";
import { required, email, minLength, firstError, ErrorCode } from "./validation";

describe("required", () => {
  it("marca vacío / espacios / null como requerido", () => {
    expect(required("")).toBe(ErrorCode.REQUIRED);
    expect(required("   ")).toBe(ErrorCode.REQUIRED);
    expect(required(null)).toBe(ErrorCode.REQUIRED);
    expect(required(undefined)).toBe(ErrorCode.REQUIRED);
  });
  it("acepta valor no vacío", () => {
    expect(required("x")).toBeNull();
  });
});

describe("email", () => {
  it("requerido primero", () => expect(email("")).toBe(ErrorCode.REQUIRED));
  it("formato inválido", () => {
    expect(email("bad")).toBe(ErrorCode.FORMAT);
    expect(email("a@b")).toBe(ErrorCode.FORMAT);
    expect(email("a b@c.co")).toBe(ErrorCode.FORMAT);
  });
  it("email válido", () => {
    expect(email("a@b.co")).toBeNull();
    expect(email(" user@credix.cr ")).toBeNull();
  });
});

describe("minLength", () => {
  it("respeta el mínimo", () => {
    expect(minLength("ab", 3)).toBe(ErrorCode.MIN_LENGTH);
    expect(minLength("abc", 3)).toBeNull();
  });
  it("vacío es requerido, no min-length", () => {
    expect(minLength("", 3)).toBe(ErrorCode.REQUIRED);
  });
});

describe("firstError", () => {
  it("devuelve el primer error o null", () => {
    expect(firstError(null, ErrorCode.FORMAT, null)).toBe(ErrorCode.FORMAT);
    expect(firstError(null, null)).toBeNull();
    expect(firstError(ErrorCode.REQUIRED, ErrorCode.FORMAT)).toBe(ErrorCode.REQUIRED);
  });
});
