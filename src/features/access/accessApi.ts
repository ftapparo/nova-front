import { queryOptions } from "@tanstack/react-query";
import { api } from "@/core/api/api";

export { erpDateTimeKey, formatErpDateTime, sentidoLabel, unitLabel } from "./accessFormat";

// Conferência e registro de passagem no sistema do condomínio. Usados pela
// abertura de portão (Portões e Portas) e pela tela Acessos.
//
// Os campos vêm em MAIÚSCULAS, como as colunas do ERP: ficam aqui, nunca na tela.
// Contêm dado pessoal: só em memória, nunca em storage ou log.

export type Sentido = "E" | "S";

/** Linha da conferência de acesso (`GET /access/verify`). */
export interface AccessVerifyRow {
  NOME?: string;
  DESCRICAO?: string;
  QUADRA?: string;
  LOTE?: string;
  PERMITIDO?: string;
  PROP?: string;
  LOC?: string;
  MOR?: string;
  SEQPESSOA?: string | number;
  SEQCLASSIFICACAO?: string | number;
  CLASSIFAUTORIZADA?: string;
  AUTORIZACAOLANC?: string;
  TIPO?: string;
  SEQIDACESSO?: string | number;
  PANICO?: string;
  IDENT?: string;
  SEQVEICULO?: string | number | null;
  /** Meio de identificação (ex.: "TAG VEICULAR"). */
  DESCMIDIA?: string | null;
}

/** Passagem gravada no ERP (`GET /access/recent`). */
export interface AccessRecentRow {
  NOME?: string | null;
  TORRE?: string | null;
  APARTAMENTO?: string | null;
  /** Data e hora do ERP, sem fuso: já está no horário local do condomínio. */
  DATAHORA?: string | null;
  DISPOSITIVO?: number | null;
  SENTIDO?: string | null;
  DESCRICAO?: string | null;
  IDACESSO?: string | null;
  VEICULO?: number | null;
}

/** `limit` vai até 50 por portão. */
export const fetchRecentAccess = (numeroDispositivo: number, limit: number, signal?: AbortSignal) =>
  api.get<AccessRecentRow[]>("/access/recent", { query: { numeroDispositivo, limit }, signal });

const RECENT_PER_GATE = 20;

/** Últimas passagens de um portão; compartilhada com o Painel Operacional. */
export const recentAccessQuery = (numeroDispositivo: number) =>
  queryOptions({
    queryKey: ["access", "recent", numeroDispositivo],
    queryFn: ({ signal }) => fetchRecentAccess(numeroDispositivo, RECENT_PER_GATE, signal),
  });

/** `id` aceita CPF, placa, TAG de 10 dígitos ou ID numérico. */
export const verifyAccess = (input: { id: string; numeroDispositivo: number; sentido: Sentido }) =>
  api.get<AccessVerifyRow[]>("/access/verify", { query: input });

const isYes = (value: unknown) => String(value ?? "").trim().toUpperCase() === "S";

/**
 * Mesma regra do painel anterior: cadastro liberado e a pessoa é
 * proprietária, locatária ou moradora de uma unidade.
 */
export const isAccessAllowed = (row: AccessVerifyRow): boolean =>
  isYes(row.PERMITIDO) && (isYes(row.PROP) || isYes(row.LOC) || isYes(row.MOR));

const toInt = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
};

// A API exige texto não vazio nesses campos; "0" é o que o painel anterior
// mandava quando o ERP não devolvia valor.
const toText = (value: unknown): string => String(value ?? "").trim() || "0";

const toYesNo = (value: unknown): "S" | "N" => (isYes(value) ? "S" : "N");

export interface RegisterAccessInput {
  row: AccessVerifyRow;
  numeroDispositivo: number;
  sentido: Sentido;
  /** Forma da passagem gravada no ERP. */
  formaAcesso: string;
}

/** Corpo de `POST /access/register` a partir da linha da conferência. */
export const toRegisterBody = ({ row, numeroDispositivo, sentido, formaAcesso }: RegisterAccessInput) => ({
  dispositivo: numeroDispositivo,
  pessoa: toInt(row.SEQPESSOA),
  classificacao: toInt(row.SEQCLASSIFICACAO),
  classAutorizado: toYesNo(row.CLASSIFAUTORIZADA),
  autorizacaoLanc: toText(row.AUTORIZACAOLANC).charAt(0),
  origem: toText(row.TIPO).charAt(0),
  seqIdAcesso: toInt(row.SEQIDACESSO),
  sentido,
  quadra: toText(row.QUADRA),
  lote: toText(row.LOTE),
  panico: toYesNo(row.PANICO),
  formaAcesso,
  idAcesso: toText(row.IDENT),
  seqVeiculo: toInt(row.SEQVEICULO),
});

export const registerAccess = (input: RegisterAccessInput) =>
  api.post<Record<string, unknown>>("/access/register", toRegisterBody(input));
