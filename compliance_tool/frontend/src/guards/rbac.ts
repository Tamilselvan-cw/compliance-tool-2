// Roles you use now (extend anytime)
export type Role = "owner" | "admin" | "manager" | "user" | "viewer";

// Fine-grained permissions; use slashes for scoping
export type Perm =
  | "org:create"
  | "org:read"
  | "org:update"
  | "org:delete"
  | "member:invite"
  | "billing:view"
  | "billing:update"
  | "settings:write";

// Default matrix (replace with API result after login)
export const ROLE_PERMS: Record<Role, Perm[]> = {
  owner: [
    "org:create","org:read","org:update","org:delete",
    "member:invite","billing:view","billing:update","settings:write",
  ],
  admin: [
    "org:create","org:read","org:update",
    "member:invite","billing:view","settings:write",
  ],
  manager: ["org:read","org:update","member:invite"],
  user:    ["org:read"],
  viewer:  ["org:read"],
};

export function hasPerm(userPerms: Perm[] | undefined, perm: Perm) {
  if (!userPerms) return false;
  return userPerms.includes(perm);
}

export function hasAll(userPerms: Perm[] | undefined, perms: Perm[]) {
  return perms.every(p => hasPerm(userPerms, p));
}

export function hasAny(userPerms: Perm[] | undefined, perms: Perm[]) {
  return perms.some(p => hasPerm(userPerms, p));
}
