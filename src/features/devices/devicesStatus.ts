import type { Exhaust } from "@/features/exhaust/exhaustApi";

// Módulos de exaustor: cada módulo da torre aciona os relés de quatro finais
// (1 a 4 ou 5 a 8). A API informa `moduleOnline` por exaustor; aqui se junta
// por módulo, que é o equipamento físico que fica fora do ar.

export interface ExhaustModule {
  id: string;
  label: string;
  online: boolean;
  exhaustIds: string[];
}

const moduleOf = (exhaust: Pick<Exhaust, "tower" | "final">) => {
  const group = exhaust.final <= 4 ? "14" : "58";
  return {
    id: `${exhaust.tower}_${group}`,
    label: `Torre ${exhaust.tower} · finais ${group === "14" ? "1 a 4" : "5 a 8"}`,
  };
};

export function groupExhaustModules(exhausts: Exhaust[]): ExhaustModule[] {
  const modules = new Map<string, ExhaustModule>();
  for (const exhaust of exhausts) {
    const { id, label } = moduleOf(exhaust);
    const current = modules.get(id) ?? { id, label, online: true, exhaustIds: [] };
    current.exhaustIds.push(exhaust.id);
    // Um exaustor sem comunicação basta para o módulo aparecer fora do ar.
    current.online = current.online && exhaust.moduleOnline;
    modules.set(id, current);
  }
  return [...modules.values()].sort((a, b) => a.id.localeCompare(b.id, "pt-BR"));
}
