// src/pages/organization/dashboard/analyticsApi.ts
import axios from "../../../api/axiosInstance";

/**
 * NOTE: Server endpoints should be implemented to match these routes and return the shapes used by
 * the chart components below. Example route names:
 *  - GET /organizations/:orgId/analytics/skill-trends
 *  - GET /organizations/:orgId/analytics/role-averages
 *  - GET /organizations/:orgId/analytics/department-averages
 *
 * Each returns an array of { key: string, current_avg: number|null, expected_avg: number|null, count?: number }
 */

export async function getSkillTrends(orgId: string, params: Record<string, any> = {}) {
  const res = await axios.get(`/organizations/${orgId}/analytics/skill-trends`, { params });
  return res.data;
}

export async function getRoleAverages(orgId: string, params: Record<string, any> = {}) {
  const res = await axios.get(`/organizations/${orgId}/analytics/role-averages`, { params });
  return res.data;
}

export async function getDepartmentAverages(orgId: string, params: Record<string, any> = {}) {
  const res = await axios.get(`/organizations/${orgId}/analytics/department-averages`, { params });
  return res.data;
}
