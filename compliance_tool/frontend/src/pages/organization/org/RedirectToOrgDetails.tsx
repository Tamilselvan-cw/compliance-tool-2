// src/pages/organization/org/RedirectToOrgDetails.tsx
import { Navigate, useParams } from "react-router-dom";

export default function RedirectToOrgDetails() {
  const { orgId = "" } = useParams();
  return <Navigate to={`/org/${orgId}/organization/details`} replace />;
}
