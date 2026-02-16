import axios, { AxiosError, type AxiosInstance } from "axios";

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://192.168.0.250:3030/v2/api").replace(/\/+$/, "");
interface ApiResponse<T> {
  data: T;
  message: string | null;
  errors: string | null;
}

type ApiError = Error & { status?: number; payload?: unknown };

const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

http.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const user = window.sessionStorage.getItem("nr_user");
    if (user && user.trim()) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)["x-user"] = user.trim();
    }
  }
  return config;
});

const parseApiMessage = (payload: unknown, fallback: string): string => {
  if (payload && typeof payload === "object" && "message" in payload && typeof (payload as { message?: unknown }).message === "string") {
    return (payload as { message: string }).message;
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return fallback;
};

const mapAxiosToApiError = (error: unknown): ApiError => {
  if (!axios.isAxiosError(error)) {
    const unexpected = new Error(error instanceof Error ? error.message : "Erro desconhecido") as ApiError;
    unexpected.payload = error;
    return unexpected;
  }

  const axiosError = error as AxiosError<unknown>;
  const status = axiosError.response?.status;
  const payload = axiosError.response?.data;
  const fallback = status ? `Erro ${status}` : axiosError.message || "Erro de comunicação";
  const mapped = new Error(parseApiMessage(payload, fallback)) as ApiError;
  mapped.status = status;
  mapped.payload = payload;

  return mapped;
};

const request = async <T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> => {
  try {
    const response = await http.request<ApiResponse<T>>({
      method,
      url: path,
      data: body,
    });

    return response.data.data;
  } catch (error: unknown) {
    throw mapAxiosToApiError(error);
  }
};

export interface DoorItem {
  id: number;
  nome: string;
  ip: string;
  porta: number;
  url: string | null;
  online: boolean;
  statusCode: number | null;
  error: string | null;
}

export interface GateItem {
  id: number;
  nome: string;
  numeroDispositivo: number;
  sentido: string;
  ip: string;
  porta: number;
  healthcheckUrl: string;
  online: boolean;
  statusCode: number | null;
  error: string | null;
}

export interface ControlStatusResponse {
  updatedAt: string | null;
  gates: GateItem[];
  doors: DoorItem[];
  error: string | null;
}

export interface ExhaustProcessMemoryItem {
  id: string;
  tower: string;
  final: number;
  group: string;
  relay: number;
  moduleId: string;
  expiresAt: number | null;
  remainingMinutes: number | null;
}

export interface ExhaustProcessStatus {
  total: number;
  memory: ExhaustProcessMemoryItem[];
  generatedAt: string;
}

export interface CommandLogItem {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  command: string;
  status: number;
  actor: string;
  ip: string | null;
}

export interface CommandLogsResponse {
  total: number;
  limit: number;
  logs: CommandLogItem[];
}

export interface ExhaustModuleStatusDetail {
  Status?: {
    Module?: number;
    DeviceName?: string;
    FriendlyName?: string[];
    Topic?: string;
    ButtonTopic?: string;
    Power?: string;
    PowerLock?: string;
    PowerOnState?: number;
    LedState?: number;
    LedMask?: string;
    SaveData?: number;
    SaveState?: number;
    SwitchTopic?: string;
    SwitchMode?: number[];
    ButtonRetain?: number;
    SwitchRetain?: number;
    SensorRetain?: number;
    PowerRetain?: number;
    InfoRetain?: number;
    StateRetain?: number;
    StatusRetain?: number;
  };
}

export interface ExhaustModulePulseTime {
  PulseTime?: {
    Set?: number[];
    Remaining?: number[];
  };
}

export interface ExhaustModuleStatus {
  status?: ExhaustModuleStatusDetail;
  pulseTime?: ExhaustModulePulseTime;
  updatedAt?: number;
  host?: string | null;
  port?: number | null;
  statusCode?: number | null;
  errorCode?: string | null;
  error?: string | null;
}

export interface ExhaustStatusResponse {
  modules: Record<string, ExhaustModuleStatus>;
  memory: ExhaustProcessMemoryItem[];
}

export interface AccessListItem {
  NOME: string;
  TORRE: string;
  APARTAMENTO: string;
  DATAHORA: string;
  DISPOSITIVO: number;
  SENTIDO: string;
  DESCRICAO: string;
  IDACESSO: string;
  VEICULO: number | null;
}

export interface AccessVerifyItem {
  IDENT: string;
  NUMDISPOSITIVO: number;
  SEQPESSOA?: number | null;
  SEQCLASSIFICACAO?: number | null;
  CLASSIFAUTORIZADA?: string | null;
  AUTORIZACAOLANC?: string | null;
  TIPO?: string | null;
  SEQIDACESSO?: number | null;
  PANICO?: string | null;
  MIDIA?: string | null;
  DESCMIDIA?: string | null;
  SEQVEICULO?: number | null;
  NOME: string;
  PERMITIDO: string;
  PROP: string;
  LOC: string;
  MOR: string;
  QUADRA: string;
  LOTE: string;
  DESCRICAO: string;
}

export interface AccessRegisterPayload {
  dispositivo: number;
  pessoa: number;
  classificacao: number;
  classAutorizado: string;
  autorizacaoLanc: string;
  origem: string;
  seqIdAcesso: number;
  sentido: string;
  quadra: string;
  lote: string;
  panico: string;
  formaAcesso: string;
  idAcesso: string;
  seqVeiculo: number;
}

export interface CpfQueryLink {
  pessoaVinculo: {
    seqUnidade: number | null;
  };
  unidade: {
    sequencia: number;
    quadra: string | null;
    lote: string | null;
  };
}

export interface CpfQueryPerson {
  sequencia: number;
  nome: string | null;
  cpf: string | null;
}

export interface CpfQueryResponse {
  cpf: string;
  isValid: boolean;
  exists: boolean;
  person: CpfQueryPerson | null;
  links: CpfQueryLink[];
}

export interface VehicleSummary {
  SEQUENCIA: number;
  PLACA: string;
  MARCA: string | null;
  MODELO: string | null;
  COR: string | null;
  SEQUNIDADE: number | null;
  PROPRIETARIO: number | null;
  TAGVEICULO: string | null;
  OWNERNOME?: string | null;
  OWNERCPF?: string | null;
  UNIDADEQUADRA?: string | null;
  UNIDADELOTE?: string | null;
}

export interface VehicleDetailsResponse {
  exists: boolean;
  vehicle: VehicleSummary | null;
  accessTag: {
    SEQUENCIA: number;
    ID: string | null;
    ID2: string | null;
    VEICULO: number | null;
    SEQPESSOA: number | null;
  } | null;
}

export interface VehicleUpsertPayload {
  plate: string;
  brand: string;
  model: string;
  color: string;
  ownerSeq: number;
  unitSeq: number | null;
}

export interface VehicleTagLinkPayload {
  cpf: string;
  tag: string;
  dispositivo: number;
  forceSwap?: boolean;
  user?: string;
}

export interface VehicleUpsertResponse {
  created: boolean;
  vehicle: VehicleSummary;
}

export interface VehicleLookupSourceResult {
  name: string;
  success: boolean;
  durationMs: number;
  message: string;
  data: {
    brand: string | null;
    model: string | null;
    color: string | null;
  } | null;
}

export interface VehicleLookupResponse {
  plate: string;
  sources: VehicleLookupSourceResult[];
  consolidated: {
    brand: string | null;
    model: string | null;
    color: string | null;
    sourceUsedByField: {
      brand: string | null;
      model: string | null;
      color: string | null;
    };
  };
  overallSuccess: boolean;
}

export type VehicleLookupProvider = "API1" | "API2" | "API3";

export interface UserSettingsResponse {
  user: string;
  exists: boolean;
  updatedAt: number;
  items: Record<string, string>;
}

export interface UserSettingsUpsertPayload {
  updatedAt: number;
  items: Record<string, string>;
}

export const api = {
  controlStatus: () => request<ControlStatusResponse>("GET", "/control/status"),
  openDoor: (id: string) => request<unknown>("POST", "/control/door/open", { id }),
  openGate: (id: string, autoClose: number) =>
    request<unknown>("POST", "/control/gate/open", { id, autoCloseTime: autoClose }),
  exhaustOn: (block: string, apartment: string, duration: number) =>
    request<unknown>("POST", "/exhausts/on", { bloco: block, apartamento: apartment, tempo: duration }),
  exhaustOff: (block: string, apartment: string) =>
    request<unknown>("POST", "/exhausts/off", { bloco: block, apartamento: apartment }),
  exhaustStatus: (id: string) => request<unknown>("GET", `/exhausts/status/${id}`),
  accessList: (device: number, limit = 10) =>
    request<AccessListItem[]>("GET", `/access/list?device=${device}&limit=${limit}`),
  accessVerify: (id: string, dispositivo: number, sentido: "E" | "S" = "E") =>
    request<AccessVerifyItem[]>("GET", `/access/verify?id=${id}&dispositivo=${dispositivo}&sentido=${sentido}`),
  accessRegister: (payload: AccessRegisterPayload) =>
    request<unknown>("POST", "/access/register", payload),
  queryCpf: (cpf: string) => request<CpfQueryResponse>("GET", `/queries/cpf/${cpf}`),
  vehicleListByOwner: (personSeq: number) =>
    request<VehicleSummary[]>("GET", `/vehicles/owner/${personSeq}`),
  vehicleByPlate: (plate: string) =>
    request<VehicleDetailsResponse>("GET", `/vehicles/plate/${plate}/details`),
  vehicleLookupPlate: (plate: string, provider?: VehicleLookupProvider) =>
    request<VehicleLookupResponse>("POST", "/vehicles/plate/lookup", { plate, provider }),
  vehicleUpsertByPlate: (payload: VehicleUpsertPayload) =>
    request<VehicleUpsertResponse>("POST", "/vehicles/upsert-by-plate", payload),
  vehicleLinkTag: (vehicleSeq: number, payload: VehicleTagLinkPayload) =>
    request<{ status: "linked" | "swapped"; vehicleSeq: number; tag: string }>("POST", `/vehicles/${vehicleSeq}/tag`, payload),
  vehicleRemoveTag: (vehicleSeq: number) =>
    request<{ vehicleSeq: number; tagRemoved: boolean }>("DELETE", `/vehicles/${vehicleSeq}/tag`),
  vehicleUnlinkOwner: (vehicleSeq: number) =>
    request<{ vehicleSeq: number; ownerUnlinked: boolean; tagRemoved: boolean }>("PATCH", `/vehicles/${vehicleSeq}/unlink-owner`),
  exhaustProcessStatus: () => request<ExhaustProcessStatus>("GET", "/exhausts/process/status"),
  exhaustStatusAll: () => request<ExhaustStatusResponse>("GET", "/exhausts/status"),
  userSettingsGet: (user: string) =>
    request<UserSettingsResponse>("GET", `/user-settings/${encodeURIComponent(user)}`),
  userSettingsUpsert: (user: string, payload: UserSettingsUpsertPayload) =>
    request<UserSettingsResponse>("PUT", `/user-settings/${encodeURIComponent(user)}`, payload),
  commandLogs: (limit = 20) =>
    request<CommandLogsResponse>("GET", `/commands/logs?limit=${Math.min(Math.max(1, Math.trunc(limit)), 200)}`),
};
