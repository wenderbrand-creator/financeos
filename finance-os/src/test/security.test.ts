import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { passwordProblem, validEmail, validLogin, loginToEmail } from "../services/auth";

describe("política de senha", () => {
  it("recusa senhas curtas, só números, comuns ou com o e-mail", () => {
    expect(passwordProblem("abc12")).toBeTruthy();
    expect(passwordProblem("12345678")).toBeTruthy();
    expect(passwordProblem("abcdefgh")).toBeTruthy();
    expect(passwordProblem("senha123")).toBeTruthy();
    expect(passwordProblem("maria2026x", "maria@email.com")).toBeTruthy();
    expect(passwordProblem("x".repeat(73) + "1")).toBeTruthy();
  });
  it("aceita senha razoável", () => { expect(passwordProblem("Cafe com 2 pao")).toBeNull(); });
});

describe("validação de login", () => {
  it("cadastro exige e-mail real", () => {
    expect(validEmail("wender")).toBeTruthy();
    expect(validEmail("a@b")).toBeTruthy();
    expect(validEmail("voce@email.com")).toBeNull();
  });
  it("entrada aceita e-mail ou usuário antigo", () => {
    expect(validLogin("voce@email.com")).toBeNull();
    expect(validLogin("wender")).toBeNull();
    expect(validLogin("a b")).toBeTruthy();
    expect(loginToEmail(" Wender ")).toMatch(/^wender@/);
  });
});

describe("cabeçalhos de segurança (vercel.json)", () => {
  const cfg = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
  const h = Object.fromEntries(cfg.headers.find((x: any) => x.source === "/(.*)").headers.map((x: any) => [x.key.toLowerCase(), x.value]));
  it("tem CSP restritiva", () => {
    const csp = h["content-security-policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-(inline|eval)/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
  it("tem HSTS, nosniff, anti-clickjacking e COOP", () => {
    expect(h["strict-transport-security"]).toMatch(/max-age=\d{7,}/);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin");
  });
  it("não publica source maps", () => {
    expect(readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8")).toMatch(/sourcemap:\s*false/);
  });
});
