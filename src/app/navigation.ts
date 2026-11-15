import AccountCircleOutlined from "@mui/icons-material/AccountCircleOutlined";
import CampaignOutlined from "@mui/icons-material/CampaignOutlined";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import DirectionsCarOutlined from "@mui/icons-material/DirectionsCarOutlined";
import DnsOutlined from "@mui/icons-material/DnsOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import LinkOutlined from "@mui/icons-material/LinkOutlined";
import LocalFireDepartmentOutlined from "@mui/icons-material/LocalFireDepartmentOutlined";
import LockResetOutlined from "@mui/icons-material/LockResetOutlined";
import ManageAccountsOutlined from "@mui/icons-material/ManageAccountsOutlined";
import MeetingRoomOutlined from "@mui/icons-material/MeetingRoomOutlined";
import NotificationsOutlined from "@mui/icons-material/NotificationsOutlined";
import PersonSearchOutlined from "@mui/icons-material/PersonSearchOutlined";
import SwapHorizOutlined from "@mui/icons-material/SwapHorizOutlined";
import WindPowerOutlined from "@mui/icons-material/WindPowerOutlined";
import { STAFF_ROLES, type StaffRole } from "@/core/session/roles";
import type { NavGroup, NavItem } from "@/core/ui/layout/navTypes";

export interface NavEntry extends NavItem {
  /** Quem vê o item. O servidor continua sendo a autoridade (403/404). */
  roles: readonly StaffRole[];
}

interface NavSection {
  label: string;
  items: NavEntry[];
}

const EQUIPE = STAFF_ROLES;
const GESTAO = ["sindico", "admin"] as const;

export const navigation: NavSection[] = [
  {
    label: "Operação",
    items: [
      { title: "Painel Operacional", path: "/", icon: DashboardOutlined, roles: EQUIPE },
      { title: "Portões e Portas", path: "/portoes-portas", icon: MeetingRoomOutlined, roles: EQUIPE },
      { title: "Acessos", path: "/acessos", icon: SwapHorizOutlined, roles: EQUIPE },
      { title: "Consultas", path: "/consultas", icon: PersonSearchOutlined, roles: EQUIPE },
      { title: "Veículos", path: "/veiculos", icon: DirectionsCarOutlined, roles: EQUIPE },
      { title: "Exaustores", path: "/exaustores", icon: WindPowerOutlined, roles: EQUIPE },
      { title: "Central de Incêndio", path: "/incendio", icon: LocalFireDepartmentOutlined, roles: EQUIPE },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { title: "Comunicados", path: "/comunicados", icon: CampaignOutlined, roles: EQUIPE },
      { title: "Notificações", path: "/notificacoes", icon: NotificationsOutlined, roles: GESTAO },
    ],
  },
  {
    label: "Administração",
    items: [
      { title: "Contas", path: "/contas", icon: ManageAccountsOutlined, roles: GESTAO },
      { title: "Vínculos", path: "/vinculos", icon: LinkOutlined, roles: GESTAO },
      { title: "Reset de senha", path: "/reset-senha", icon: LockResetOutlined, roles: EQUIPE },
      { title: "Histórico de comandos", path: "/comandos", icon: HistoryOutlined, roles: EQUIPE },
      { title: "Equipamentos", path: "/equipamentos", icon: DnsOutlined, roles: EQUIPE },
    ],
  },
  {
    label: "Conta",
    items: [{ title: "Minha conta", path: "/conta", icon: AccountCircleOutlined, roles: EQUIPE }],
  },
];

/** Menu visível para um papel; grupos que ficam vazios somem. */
export function navigationFor(role: StaffRole | null): NavGroup[] {
  if (!role) return [];
  return navigation
    .map((section) => ({
      label: section.label,
      items: section.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);
}
