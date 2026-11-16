import { api } from "@/core/api/api";
import type { components } from "@/core/api/schema.gen";

// Vínculo entre a conta do aplicativo e o cadastro da pessoa no ERP
// (PESSOAS.SEQUENCIA). É o vínculo que dá à conta o acesso de morador.
// Uma pessoa só pode estar ligada a uma conta.

export type AccountLink = components["schemas"]["AccountLink"];

export const fetchLinks = (signal?: AbortSignal) => api.get<AccountLink[]>("/residence/links", { signal });

/** 404 = pessoa não existe no ERP; 409 = pessoa já ligada a outra conta. */
export const linkAccount = (accountId: string, personSequencia: number) =>
  api.put<AccountLink>(`/residence/links/${accountId}`, { personSequencia });

export const unlinkAccount = (accountId: string) => api.delete<null>(`/residence/links/${accountId}`);

/** Autovínculo: o próprio morador conferiu CPF e celular no aplicativo. */
export const isSelfLink = (link: Pick<AccountLink, "accountId" | "linkedBy">) => link.accountId === link.linkedBy;
