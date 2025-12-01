import { useAuth } from "../../pages/auth/useAuth";
import { hasAny, hasAll, type Perm } from "../../guards/rbac";

export function usePerms() {
  const { perms } = useAuth();
  return {
    perms,
    has: (p: Perm) => perms.includes(p),
    any: (ps: Perm[]) => hasAny(perms, ps),
    all: (ps: Perm[]) => hasAll(perms, ps),
  };
}
