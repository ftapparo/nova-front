import { api } from "@/core/api/api";

// Consultas de portaria no cadastro do condomínio (ERP). Devolvem dado
// pessoal (CPF, telefone, foto): só em memória, nunca em storage ou log.

/** "S"/"N" do ERP. */
type Flag = string | null;

export interface Person {
  sequencia: number;
  nome: string | null;
  cpf: string | null;
  rg?: string | null;
  email?: string | null;
  telCelular?: string | null;
  tipo?: string | null;
  categoria?: string | null;
  classificacao?: string | null;
  empresa?: string | null;
  funcao?: string | null;
  /** Texto longo do ERP: pode chegar como bytes. Ler com `erpText`. */
  observacoes?: unknown;
  /** Aviso cadastrado para a portaria ver ao atender esta pessoa. */
  alertaPortaria?: unknown;
  prop?: Flag;
  loc?: Flag;
  mor?: Flag;
  /** Foto em base64, quando houver. */
  foto?: string | null;
}

export interface Unit {
  sequencia: number;
  quadra: string | null;
  lote: string | null;
  status?: string | null;
  bloquear?: Flag;
}

export interface PersonLink {
  pessoaVinculo: { sequencia: number; seqUnidade: number | null; prop?: Flag; loc?: Flag; mor?: Flag };
  unidade: Unit;
}

export interface CpfQuery {
  cpf: string;
  isValid: boolean;
  exists: boolean;
  person: Person | null;
  links: PersonLink[];
}

export interface VehicleQuery {
  exists: boolean;
  vehicle: {
    sequencia: number;
    placa: string | null;
    marca: string | null;
    modelo: string | null;
    cor: string | null;
    tagVeiculo: string | null;
  } | null;
  unit: Unit | null;
  owner: Person | null;
  accesses: { sequencia: number; tipo: string | null; id: string | null; id2: string | null; acessoLiberado?: Flag }[];
}

export const queryCpf = (cpf: string) => api.get<CpfQuery>(`/queries/cpf/${cpf}`);
export const queryPlate = (plate: string) => api.get<VehicleQuery>(`/queries/plate/${encodeURIComponent(plate)}`);
export const queryTag = (tag: string) => api.get<VehicleQuery>(`/queries/tag/${tag}`);

export const isFlagSet = (value: Flag | undefined) => String(value ?? "").trim().toUpperCase() === "S";

/** "Proprietário · Morador" a partir das marcas do vínculo. */
export const relationLabel = (flags: { prop?: Flag; loc?: Flag; mor?: Flag }): string =>
  [isFlagSet(flags.prop) && "Proprietário", isFlagSet(flags.loc) && "Locatário", isFlagSet(flags.mor) && "Morador"]
    .filter(Boolean)
    .join(" · ") || "Sem vínculo de moradia";

/** O ERP não guarda o tipo da imagem: PNG começa com "iVBOR" em base64; o resto é tratado como JPEG. */
export const photoSrc = (base64: string) => `data:image/${base64.startsWith("iVBOR") ? "png" : "jpeg"};base64,${base64}`;
