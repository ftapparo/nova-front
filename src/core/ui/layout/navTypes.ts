import type { SvgIconComponent } from "@mui/icons-material";

export interface NavItem {
  title: string;
  path: string;
  icon: SvgIconComponent;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}
