import * as React from "react";
import { useNavigate } from "react-router-dom";
import type { Role, Perm } from "../../guards/rbac";
import { ROLE_PERMS } from "../../guards/rbac";

type User = {
  id: string;
  email: string;
  role: Role;
  perms?: Perm[];
  orgId?: string | null;   // derived from email (mock) for non-superadmin
} | null;

type AuthCtx = {
  user: User;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  perms: Perm[];
};

const Ctx = React.createContext<AuthCtx | null>(null);

// --- mock allow-list ---
const ALLOWED = new Set([
  "admin@tool.com",
  "user@tool.com",
  "hr@tool.com",
  "superadmin@tool.com",
]);

function emailToRole(email: string): Role {
  const e = email.toLowerCase();
  if (e === "superadmin@tool.com") return "superadmin" as Role;
  if (e === "admin@tool.com")      return "orgadmin"   as Role;
  if (e === "hr@tool.com")         return "hr"         as Role;
  return "employee" as Role; // user@tool.com
}

// --- mock org-id resolver (replace with real DB lookup later) ---
function getMockOrgForEmail(email: string): string {
  // map all non-superadmin demo users to one org slug (e.g., "acme")
  // tweak freely or branch on email if you want multiple demo orgs
  if (email.toLowerCase() === "user@tool.com") return "acme";
  if (email.toLowerCase() === "hr@tool.com")   return "acme";
  if (email.toLowerCase() === "admin@tool.com")return "acme";
  return "acme";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User>(null);
  const navigate = useNavigate();

  const login = async (email: string, _password: string) => {
    await new Promise(r => setTimeout(r, 200));

    const e = email.trim().toLowerCase();
    if (!ALLOWED.has(e)) throw new Error("This email is not allowed in the demo.");

    const role = emailToRole(e);
    const isSuper = role === ("superadmin" as Role);
    const orgId = isSuper ? "central" : getMockOrgForEmail(e);

    setUser({ id: crypto.randomUUID(), email: e, role, orgId });

    // routes: superadmin → organizations; others → org area
    if (isSuper) {
      navigate("/organizations", { replace: true });
    } else {
      navigate(`/org/${orgId}/users`, { replace: true });
    }
  };

  const logout = () => { setUser(null); navigate("/login", { replace: true }); };

  const perms = React.useMemo<Perm[]>(
    () => (user?.perms && user.perms.length ? user.perms : (user ? ROLE_PERMS[user.role] : [])),
    [user]
  );

  const value = React.useMemo(() => ({ user, login, logout, perms }), [user, perms]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
