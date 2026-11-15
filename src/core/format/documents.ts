// CPF, placa e TAG: formatos digitados pela portaria em várias telas.

export const onlyDigits = (value: string | null | undefined): string => String(value ?? "").replace(/\D/g, "");

/** "12345678900" → "123.456.789-00"; aceita o texto incompleto enquanto é digitado. */
export const formatCpf = (value: string | null | undefined): string =>
  onlyDigits(value)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");

/** Placa sem hífen e em maiúsculas: "abc-1d23" → "ABC1D23" (padrão antigo e Mercosul). */
export const normalizePlate = (value: string | null | undefined): string =>
  String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);

/** TAG de acesso tem 10 dígitos. */
export const TAG_LENGTH = 10;
