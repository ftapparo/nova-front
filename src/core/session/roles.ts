// Papéis de equipe da nova-api v3. Conta de morador (role null ou "morador")
// não usa este painel.
export const STAFF_ROLES = ["porteiro", "sindico", "admin"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  porteiro: "Portaria",
  sindico: "Síndico",
  admin: "Administrador",
};

export const staffRoleOf = (user: { role: string | null }): StaffRole | null =>
  (STAFF_ROLES as readonly string[]).includes(user.role ?? "") ? (user.role as StaffRole) : null;
