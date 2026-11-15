import { createContext, useContext } from "react";

export type NoticeSeverity = "success" | "error" | "warning" | "info";

export type Notify = Record<NoticeSeverity, (message: string) => void>;

export const NotifyContext = createContext<Notify | null>(null);

/** Avisos rápidos no canto da tela. Exige o NotifyProvider acima na árvore. */
export function useNotify(): Notify {
  const notify = useContext(NotifyContext);
  if (!notify) throw new Error("useNotify precisa estar dentro de NotifyProvider");
  return notify;
}
