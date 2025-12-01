import type { Perm } from "../../guards/rbac";
import { FiHome, FiUsers, FiCreditCard, FiSettings } from "react-icons/fi";

export type NavItem = {
  label: string;
  to: string;
  icon?: React.ComponentType<any>;
  requireAny?: Perm[];    // visible if ANY present
  requireAll?: Perm[];    // visible if ALL present
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Home",      to: "/organizations", icon: FiHome, requireAny: ["org:read"] },
  { label: "Members",   to: "/members",       icon: FiUsers, requireAny: ["member:invite","org:update"] },
  { label: "Billing",   to: "/billing",       icon: FiCreditCard, requireAny: ["billing:view"] },
  { label: "Settings",  to: "/settings",      icon: FiSettings, requireAny: ["settings:write","org:update"] },
];
