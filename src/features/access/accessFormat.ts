// O ERP grava DATAHORA sem fuso, já no horário do condomínio. Converter com
// `new Date()` aplicaria o fuso do navegador por cima; por isso o texto é
// remontado sem interpretação.
const ERP_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

export function formatErpDateTime(value: string | null | undefined): string {
  const match = value ? ERP_DATE_TIME.exec(value) : null;
  if (!match) return value || "—";
  const [, year, month, day, hour, minute, second = "00"] = match;
  return `${day}/${month}/${year} ${hour}:${minute}:${second}`;
}

/** Chave de ordenação: o texto ISO do ERP ordena como data. */
export const erpDateTimeKey = (value: string | null | undefined): string =>
  ERP_DATE_TIME.test(value ?? "") ? (value as string).replace(" ", "T") : "";

export const sentidoLabel = (sentido: string | null | undefined): string =>
  String(sentido ?? "").trim().toUpperCase() === "S" ? "Saída" : "Entrada";

export const unitLabel = (tower: string | null | undefined, apartment: string | null | undefined): string =>
  [tower, apartment].map((part) => String(part ?? "").trim()).filter((part) => part && part !== "0").join("-") || "—";
