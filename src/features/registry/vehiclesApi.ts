import { api } from "@/core/api/api";

// Cadastro de veículos e TAG veicular no ERP. Campos em MAIÚSCULAS são
// colunas do ERP, como a API entrega; ficam aqui, nunca na tela.

export interface Vehicle {
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

export interface VehicleDetails {
  exists: boolean;
  vehicle: Vehicle | null;
}

export interface PlateLookup {
  plate: string;
  consolidated: { brand: string | null; model: string | null; color: string | null };
  overallSuccess: boolean;
}

export interface VehicleFields {
  brand: string;
  model: string;
  color: string;
}

export const listVehicles = (ownerSeq: number, signal?: AbortSignal) =>
  api.get<Vehicle[]>("/vehicles", { query: { ownerSeq }, signal });

export const fetchVehicleByPlate = (plate: string) => api.get<VehicleDetails>(`/vehicles/plate/${plate}`);

/** Marca, modelo e cor em fontes externas. Lento (segundos) e limitado a 5 por minuto. */
export const lookupPlate = (plate: string) => api.post<PlateLookup>("/vehicles/plate/lookup", { plate });

export const saveVehicle = (plate: string, input: VehicleFields & { ownerSeq: number; unitSeq: number | null }) =>
  api.put<{ created: boolean; vehicle: Vehicle }>(`/vehicles/plate/${plate}`, input);

/** `cpf` é de quem autoriza (o proprietário); 409 "Confirmação necessária" pede `forceSwap`. */
export const linkTag = (
  vehicleSeq: number,
  input: { cpf: string; tag: string; numeroDispositivo: number; forceSwap: boolean },
) => api.put<{ status: "linked" | "swapped"; vehicleSeq: number; tag: string }>(`/vehicles/${vehicleSeq}/tag`, input);

export const removeTag = (vehicleSeq: number) =>
  api.delete<{ vehicleSeq: number; tagRemoved: boolean }>(`/vehicles/${vehicleSeq}/tag`);

/** Tira o veículo do proprietário (a TAG sai junto). */
export const unlinkOwner = (vehicleSeq: number) =>
  api.delete<{ vehicleSeq: number; ownerUnlinked: boolean; tagRemoved: boolean }>(`/vehicles/${vehicleSeq}/owner`);

/** Título estável da API quando a TAG troca a de outro veículo do mesmo dono. */
export const SWAP_CONFIRMATION_TITLE = "Confirmação necessária";

/**
 * Placa já ligada a outro proprietário ou unidade: não pode ser cadastrada
 * aqui (regra do painel anterior — primeiro remove-se do cadastro atual).
 */
export function plateOwnedByOther(vehicle: Vehicle, ownerSeq: number, unitSeq: number | null): boolean {
  const owner = Number(vehicle.PROPRIETARIO ?? 0);
  const unit = Number(vehicle.SEQUNIDADE ?? 0);
  const linked = owner > 0 || unit > 0;
  return linked && (owner !== ownerSeq || unit !== Number(unitSeq ?? 0));
}

export const vehicleDescription = (vehicle: Pick<Vehicle, "MARCA" | "MODELO" | "COR">) =>
  [vehicle.MARCA, vehicle.MODELO, vehicle.COR].filter(Boolean).join(" · ") || "Sem marca, modelo e cor";
