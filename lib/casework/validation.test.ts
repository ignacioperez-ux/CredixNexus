import { describe, it, expect } from "vitest";
import { validateAttachment, validateTaskTitle, safeFileName, formatBytes, checklistProgress, MAX_ATTACHMENT_BYTES } from "./validation";
import { ErrorCode } from "@/lib/validation";

describe("validateAttachment", () => {
  it("acepta un PDF valido", () => {
    expect(validateAttachment("evidencia.pdf", "application/pdf", 1024)).toBeNull();
  });
  it("rechaza tipo no permitido", () => {
    expect(validateAttachment("run.exe", "application/x-msdownload", 1024)).toBe(ErrorCode.INVALID_REFERENCE);
  });
  it("rechaza tamano invalido o excedido", () => {
    expect(validateAttachment("x.png", "image/png", 0)).toBe(ErrorCode.FORMAT);
    expect(validateAttachment("x.png", "image/png", MAX_ATTACHMENT_BYTES + 1)).toBe(ErrorCode.FORMAT);
  });
  it("exige nombre", () => {
    expect(validateAttachment("", "application/pdf", 10)).toBe(ErrorCode.REQUIRED);
  });
});

describe("validateTaskTitle", () => {
  it("exige minimo 3 caracteres", () => {
    expect(validateTaskTitle("Revisar transaccion")).toBeNull();
    expect(validateTaskTitle("ab")).toBe(ErrorCode.MIN_LENGTH);
  });
});

describe("safeFileName", () => {
  it("preserva extension y sanea separadores/espacios", () => {
    expect(safeFileName("mi archivo (1).pdf")).toBe("mi_archivo__1_.pdf");
    expect(safeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
  });
});

describe("formatBytes", () => {
  it("formatea a B/KB/MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3 MB");
  });
});

describe("checklistProgress", () => {
  it("porcentaje de hechas o null", () => {
    expect(checklistProgress(1, 3)).toBe(75);
    expect(checklistProgress(0, 0)).toBeNull();
  });
});
