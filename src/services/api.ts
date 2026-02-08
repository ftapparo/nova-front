const BASE_URL = "https://api.condominionovaresidence.com/v2/api";

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
  return res.json();
}

export interface DoorItem { id: string; name: string }
export interface GateItem { id: string; name: string }

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
