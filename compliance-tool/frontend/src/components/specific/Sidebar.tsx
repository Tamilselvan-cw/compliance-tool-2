import * as React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../pages/auth/useAuth";
import { hasAll, hasAny } from "../../guards/rbac";
import { NAV_ITEMS } from "./navConfig";

export default function Sidebar() {
  const { perms } = useAuth();
  const items = React.useMemo(() => {
    return NAV_ITEMS.filter(it => {
      const okAny = it.requireAny ? hasAny(perms, it.requireAny) : true;
      const okAll = it.requireAll ? hasAll(perms, it.requireAll) : true;
      return okAny && okAll;
    });
  }, [perms]);

  return (
    <nav className="w-64 border-r bg-white">
      <ul className="p-3 space-y-1">
        {items.map((it) => {
          const Icon = it.icon!;
          return (
            <li key={it.to}>
              <NavLink
                to={it.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-100 ${isActive ? "bg-gray-100" : ""}`
                }
              >
                {!!Icon && <Icon className="shrink-0" />}
                <span className="truncate">{it.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
