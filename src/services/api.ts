const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://192.168.0.250:3030/v2/api").replace(/\/+$/, "");
interface ApiResponse<T> {
  data: T;
  message: string | null;
  errors: string | null;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Erro ${res.status}`);
  }
  const json: ApiResponse<T> = await res.json();
  return json.data;
}

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
  exhaustProcessStatus: () => request<ExhaustProcessStatus>("GET", "/exhausts/process/status"),
  exhaustStatusAll: () => request<ExhaustStatusResponse>("GET", "/exhausts/status"),
};
