import { MODULES, type ModuleKey } from "./constants";

export type NavItem = { key: ModuleKey | "dashboard" | "settings"; label: string; href: string; group: "main" | "comms" | "admin" };

/** Sidebar items for this shop's enabled modules and the user's role. */
export function buildNav(enabled: ModuleKey[], role: string): NavItem[] {
  const items: NavItem[] = [{ key: "dashboard", label: "Dashboard", href: "/dashboard", group: "main" }];
  for (const m of MODULES) {
    if (!enabled.includes(m.key)) continue;
    if (m.roles && !m.roles.includes(role as never)) continue;
    items.push({ key: m.key, label: m.label, href: m.href, group: m.group });
  }
  if (role === "OWNER" || role === "ADMIN") items.push({ key: "settings", label: "Settings", href: "/settings", group: "admin" });
  return items;
}
