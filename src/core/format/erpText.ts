// Campos de texto longo do ERP (observações, aviso para a portaria) chegam
// da API como bytes: o Buffer do Node vira `{ type: "Buffer", data: [...] }`
// no JSON. Campos curtos chegam como texto. Esta leitura aceita os dois.

interface SerializedBuffer {
  type: "Buffer";
  data: number[];
}

const isSerializedBuffer = (value: unknown): value is SerializedBuffer =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: unknown }).type === "Buffer" &&
  Array.isArray((value as { data?: unknown }).data);

// O ERP grava em Windows-1252; se um dia passar a UTF-8, a leitura estrita
// abaixo já pega. Bytes que não são UTF-8 válido caem no Windows-1252.
const decodeBytes = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
};

/** Texto de um campo do ERP, sem espaços nas pontas; null quando vazio ou em formato desconhecido. */
export function erpText(value: unknown): string | null {
  let text: string | null = null;
  if (typeof value === "string") text = value;
  else if (typeof value === "number") text = String(value);
  else if (isSerializedBuffer(value)) text = decodeBytes(Uint8Array.from(value.data));
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
}

/** Junta os campos preenchidos: `joinErpText([marca, modelo, cor], " · ")`. */
export const joinErpText = (values: unknown[], separator: string): string =>
  values
    .map(erpText)
    .filter((part): part is string => part !== null)
    .join(separator);
