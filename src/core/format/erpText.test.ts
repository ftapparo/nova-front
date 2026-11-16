import { describe, expect, it } from "vitest";
import { erpText, joinErpText } from "./erpText";

// Como o JSON da API entrega um Buffer do Node.
const asBuffer = (bytes: number[]) => ({ type: "Buffer", data: bytes });

describe("erpText", () => {
  it("aceita texto e número", () => {
    expect(erpText("  FULANO  ")).toBe("FULANO");
    expect(erpText(11999990000)).toBe("11999990000");
  });

  it("lê bytes em Windows-1252, a codificação do ERP", () => {
    // "Atenção" em Windows-1252: ç = 0xE7, ã = 0xE3.
    expect(erpText(asBuffer([0x41, 0x74, 0x65, 0x6e, 0xe7, 0xe3, 0x6f]))).toBe("Atenção");
  });

  it("lê bytes em UTF-8 quando forem UTF-8 válido", () => {
    expect(erpText(asBuffer([...new TextEncoder().encode("Atenção")]))).toBe("Atenção");
  });

  it("trata vazio e formato desconhecido como ausente", () => {
    expect(erpText(asBuffer([0x20, 0x20]))).toBeNull();
    expect(erpText(null)).toBeNull();
    expect(erpText({ outro: "formato" })).toBeNull();
  });

  it("junta só os campos preenchidos", () => {
    expect(joinErpText(["FIAT", null, asBuffer([0x55, 0x4e, 0x4f])], " · ")).toBe("FIAT · UNO");
  });
});
