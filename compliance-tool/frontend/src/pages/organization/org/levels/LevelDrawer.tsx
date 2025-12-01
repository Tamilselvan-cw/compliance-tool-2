// ----------------------------------------------
// src/services/orgApi.ts
import axios from "@/api/axiosInstance";

/** Drawer / CSV payload fields */
export type LevelCreateIn = {
  name: string;
  description?: string;
  score: number;
};

/** What backend returns */
export type LevelOut = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  score: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
};

/** Utility: extract orgId from current URL (/organization/:orgId/...) */
function currentOrgIdFromUrl(): string | null {
  const m = window.location.pathname.match(/\/organization\/([^/]+)/i);
  return m?.[1] ?? null;
}

/** Resolve orgId for calls */
function resolveOrgId(orgId?: string): string {
  const resolved = orgId ?? currentOrgIdFromUrl();
  if (!resolved) throw new Error("organization_id not found in URL or argument");
  return resolved;
}

/** ---------------------------------------------
 * CRUD APIs — all organization scoped
 * ---------------------------------------------- */

/** Create one level */
async function addLevel(payload: LevelCreateIn, orgId?: string): Promise<LevelOut> {
  const resolved = resolveOrgId(orgId);
  const { data } = await axios.post<LevelOut>(`/organizations/${resolved}/levels`, payload);
  return data;
}

/** Bulk create levels */
async function bulkLevels(
  items: LevelCreateIn[],
  orgId?: string
): Promise<{ inserted: LevelOut[]; count: number; skipped: number }> {
  const resolved = resolveOrgId(orgId);
  const { data } = await axios.post(`/organizations/${resolved}/levels/bulk`, { items });
  return data;
}

/** List levels */
async function listLevels(
  params?: { q?: string; only_active?: boolean; page?: number; limit?: number },
  orgId?: string
) {
  const resolved = resolveOrgId(orgId);
  const { data } = await axios.get(`/organizations/${resolved}/levels`, {
    params: { only_active: true, page: 1, limit: 100, ...(params || {}) },
  });
  return data; // { items, total, page, limit }
}

/** Delete a level (soft=true by default) */
async function deleteLevel(id: string, soft = true, orgId?: string) {
  const resolved = resolveOrgId(orgId);
  await axios.delete(`/organizations/${resolved}/levels/${id}`, { params: { soft } });
}

/** Get one level by ID */
async function getLevel(id: string, orgId?: string): Promise<LevelOut> {
  const resolved = resolveOrgId(orgId);
  const { data } = await axios.get<LevelOut>(`/organizations/${resolved}/levels/${id}`);
  return data;
}

/** Export service */
export const orgApi = {
  addLevel,
  bulkLevels,
  listLevels,
  deleteLevel,
  getLevel,
};
