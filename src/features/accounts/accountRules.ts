import { STAFF_ROLE_LABEL, staffRoleOf, type StaffRole } from "@/core/session/roles";

// Espelho das regras da API, só para não oferecer ação que ela vai recusar.
// Quem decide de verdade é o servidor (403).

interface AccountLike {
  id: string;
  role: string | null;
}

const RANK: Record<StaffRole, number> = { porteiro: 1, sindico: 2, admin: 3 };
const rankOf = (role: string | null) => {
  const staff = staffRoleOf({ role });
  return staff ? RANK[staff] : 0;
};

/**
 * Ninguém gerencia a própria conta por aqui (sempre sobra um admin, ninguém
 * se promove) nem conta de nível igual ou maior; admin gerencia qualquer outra.
 */
export const canManageAccount = (actor: AccountLike, target: AccountLike): boolean =>
  actor.id !== target.id && (actor.role === "admin" || rankOf(actor.role) > rankOf(target.role));

/** Papéis que o ator pode conceder: só admin concede admin. */
export const grantableRoles = (actorRole: string | null): StaffRole[] =>
  actorRole === "admin" ? ["porteiro", "sindico", "admin"] : ["porteiro", "sindico"];

export const roleLabel = (role: string | null): string => {
  const staff = staffRoleOf({ role });
  if (staff) return STAFF_ROLE_LABEL[staff];
  return role === "morador" ? "Morador" : "Sem papel";
};
