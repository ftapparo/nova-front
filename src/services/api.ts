const BASE_URL = "https://api.condominionovaresidence.com/v2/api";

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
  sequencia: number;
  ip: string;
  nome: string;
  deviceId: number;
  ativo: string;
}

export interface GateItem { 
  sequencia: number;
  nome: string;
  numeroDispositivo: number;
  ativo: string;
}

export const api = {
  listDoors: () => request<DoorItem[]>("GET", "/control/door/list"),
  openDoor: (id: string) => request<unknown>("POST", "/control/door/open", { id }),
  listGates: () => request<GateItem[]>("GET", "/control/gate/list"),
  openGate: (id: string, autoClose: number) => request<unknown>("POST", "/control/gate/open", { id, autoClose }),
  exhaustorOn: (block: string, apartment: string, duration: number) =>
    request<unknown>("POST", "/exaustors/on", { block, apartment, duration }),
  exhaustorOff: (block: string, apartment: string) =>
    request<unknown>("POST", "/exaustors/off", { block, apartment }),
  exhaustorStatus: (id: string) => request<unknown>("GET", `/exaustors/status/${id}`),
};
