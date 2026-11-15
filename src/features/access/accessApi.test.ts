import { describe, expect, it } from "vitest";
import { isAccessAllowed, toRegisterBody } from "./accessApi";

describe("isAccessAllowed", () => {
  it("exige cadastro liberado e vínculo com a unidade", () => {
    expect(isAccessAllowed({ PERMITIDO: "S", MOR: "S" })).toBe(true);
    expect(isAccessAllowed({ PERMITIDO: " s ", LOC: "S" })).toBe(true);
    expect(isAccessAllowed({ PERMITIDO: "N", PROP: "S" })).toBe(false);
    expect(isAccessAllowed({ PERMITIDO: "S", PROP: "N", LOC: "N", MOR: "N" })).toBe(false);
    expect(isAccessAllowed({})).toBe(false);
  });
});

describe("toRegisterBody", () => {
  it("preenche campos ausentes do ERP com valores que a API aceita", () => {
    expect(toRegisterBody({ row: {}, numeroDispositivo: 10, sentido: "S", formaAcesso: "TAG" })).toEqual({
      dispositivo: 10,
      pessoa: 0,
      classificacao: 0,
      classAutorizado: "N",
      autorizacaoLanc: "0",
      origem: "0",
      seqIdAcesso: 0,
      sentido: "S",
      quadra: "0",
      lote: "0",
      panico: "N",
      formaAcesso: "TAG",
      idAcesso: "0",
      seqVeiculo: 0,
    });
  });
});
