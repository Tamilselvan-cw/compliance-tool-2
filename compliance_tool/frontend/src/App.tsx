// src/App.tsx
import * as React from "react";
import { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import RequireAuth from "./guards/RequireAuth";
import { AuthProvider } from "./pages/auth/useAuth";
import RedirectToOrgDetails from "./pages/organization/org/RedirectToOrgDetails";
import UsersPage from "./pages/organization/org/employee/UsersPage";
import { Box, Skeleton } from "@mui/material";   
import AdminShell from "./pages/organization/AdminShell";
import AdminOrgDetailsShell from "./pages/organization/org/AdminOrgDetailsShell";
import axiosInstance from "./api/axiosInstance"; // add thi
// core pages
const Index = lazy(() => import("./pages/Index"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const EmailConfirmPage = lazy(() => import("./pages/auth/EmailConfirmPage"));
const OrganizationsPage = lazy(
  () => import("./pages/superadmin/OrganizationsPage")
);
const CoreCompetencyPage = lazy(
  () => import("./pages/superadmin/CoreCompetencyPage")
);

const NavbarShell = lazy(
  () => import("./pages/superadmin/components/navbar-shell")
);

const NotFound = lazy(() => import("./pages/NotFound"));

// navbar pages
const OrganizationDashboardPage = lazy(
  () => import("./pages/organization/dashboard/OrganizationDashboardPage")
);
const CompetencyMatrixAnalyticsOrgWise = lazy(
  () =>
    import(
      "./pages/organization/org/competency_matrix/CompetencyMatrixAnalyticsOrgWise"
    )
);

const CompetencyDictionaryPage = lazy(
  () =>
    import(
      "./pages/organization/competency_dictionary/CompetencyDictionaryPage"
    )
);
const OrganizationDetailsPage = lazy(
  () =>
    import(
      "./pages/organization/organization_details/OrganizationDetailsPage"
    )
);

// org shells + section pages
const RolesPage = lazy(() => import("./pages/organization/org/roles/RolesPage"));
const AddRolePage = lazy(
  () => import("./pages/organization/org/roles/AddRolePage")
);
// consistent spelling
const ArHierarchyPage = lazy(
  () => import("./pages/organization/dashboard/ArHeirarchyPage")
);
const EmployeeDetailPage = lazy(
  () => import("./pages/organization/org/employee/EmployeeDetailPage")
);

const EmployeeCompetencyMappingPage = lazy(
  () => import("./pages/organization/org/EmployeeCompetencyMappingPage")
);

const LevelsPage = lazy(
  () => import("./pages/organization/org/levels/LevelsListPage")
);
const CategoriesPage = lazy(
  () => import("./pages/organization/categories/CategoriesPage")
);
const DepartmentPage = lazy(
  () => import("./pages/organization/org/departments/DepartmentPage")
);

// single-role skills / competency mapping page
const SkillsPage = lazy(
  () => import("./pages/organization/org/SkillsPage")
);

// surveys – only shell + tabs now
const SurveyDetailsPage = lazy(
  () => import("./pages/organization/surveys/SurveyDetailsPage")
);
const SurveyShell = lazy(
  () => import("./pages/organization/surveys/SurveyShell")
);
const SurveyDashboardTab = lazy(
  () => import("./pages/organization/surveys/SurveyDashboardTab")
);
const SurveyParticipantsTab = lazy(
  () => import("./pages/organization/surveys/SurveyParticipantsTab")
);
const SurveyRolesTab = lazy(
  () => import("./pages/organization/surveys/SurveyRolesTab")
);

const queryClient = new QueryClient();

/** /org/:orgId/surveys -> /org/:orgId/organization/surveys */
const SurveyListAlias: React.FC = () => {
  const { orgId = "" } = useParams();
  return <Navigate to={`/org/${orgId}/organization/surveys`} replace />;
};

/** /org/:orgId/surveys/... -> /org/:orgId/organization/surveys/... */
const SurveyDeepAlias: React.FC = () => {
  const { pathname } = useLocation();
  if (pathname.includes("/organization/surveys/"))
    return <Navigate to={pathname} replace />;
  const next = pathname.replace(
    /^\/org\/([^/]+)\/surveys(\/.*)?$/,
    "/org/$1/organization/surveys$2"
  );
  return <Navigate to={next} replace />;
};

/**
 * When clicking “Competency” in sidebar it hits
 * /org/:orgId/organization/surveys  ➜ immediately redirect to
 * /org/:orgId/organization/surveys/:surveyId/analytics
 *
 * It will reuse an existing survey or create one if needed.
 */
const OrgCompetencyParticipantsEntry: React.FC = () => {
  const { orgId = "" } = useParams();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    (async () => {
      try {
        // 1) Your existing logic – keep this exactly as you have it
        const listRes = await axiosInstance.get<{
          items: Array<{ id: string }>;
          total: number;
        }>(`/organizations/${orgId}/surveys`, {
          params: { page: 1, limit: 1 },
        });

        let surveyId: string | undefined = listRes.data?.items?.[0]?.id;

        if (!surveyId) {
          const payload = {
            name: "Organization Competency Mapping",
            description: null,
            role_ids: [] as string[],
            status: "draft" as const,
          };
          const createRes = await axiosInstance.post(
            `/organizations/${orgId}/surveys`,
            payload
          );

          surveyId =
            (createRes.data as any)?.id ||
            (createRes.data as any)?.data?.id;
        }

        if (!cancelled && surveyId) {
          // keep your existing target here (participants or analytics)
          navigate(
            `/org/${orgId}/organization/surveys/${encodeURIComponent(
              surveyId
            )}/analytics`,
            { replace: true }
          );
        }
      } catch (e) {
        console.error("Failed to find/create singleton survey", e);
        if (!cancelled) {
          navigate(`/org/${orgId}/organization/details`, {
            replace: true,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orgId, navigate]);

  // 🔹 Show a light skeleton instead of a blank page
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1200,
        mx: "auto",
        px: 2.5,
        py: 3,
      }}
    >
      <Skeleton variant="text" width="35%" height={30} sx={{ mb: 1.5 }} />
      <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 2 }} />
      <Skeleton variant="rectangular" height={180} sx={{ mb: 2, borderRadius: 2 }} />
    </Box>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={null}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<LoginPage />} />

              {/* // example */}
              <Route path="/auth/confirm" element={<EmailConfirmPage />} />


              {/* Protected */}
              <Route element={<RequireAuth />}>

              <Route path="" element={<NavbarShell />}>
                <Route
                  path="/organizations"
                  element={<OrganizationsPage />}
                />
                <Route
                  path="/core-competencies"
                  element={<CoreCompetencyPage />}
                />
                </Route>

                <Route path="/org/:orgId" element={<AdminShell />}>
                  {/* Top navbar tabs */}
                  <Route
                    index
                    element={
                      <Navigate
                        to="organization/details"
                        replace
                      />
                    }
                  />
                  <Route
                    path="dashboard"
                    element={<OrganizationDashboardPage />}
                  />
                  <Route
                    path="competency-dictionary"
                    element={<CompetencyDictionaryPage />}
                  />

                  {/* AR hierarchy & employee details */}
                  <Route
                    path="org-hierarchy"
                    element={<ArHierarchyPage />}
                  />
                  <Route
                    path="employees/:empId"
                    element={<EmployeeDetailPage />}
                  />

                  {/* Old survey paths → new paths */}
                  <Route
                    path="surveys"
                    element={<SurveyListAlias />}
                  />
                  <Route
                    path="surveys/:surveyId/*"
                    element={<SurveyDeepAlias />}
                  />

                  {/* Organization shell with sidebar */}
                  <Route
                    path="organization"
                    element={<AdminOrgDetailsShell />}
                  >
                    <Route
                      index
                      element={
                        <Navigate to="details" replace />
                      }
                    />
                    <Route
                      path="details"
                      element={<OrganizationDetailsPage />}
                    />
                    <Route
                      path="departments"
                      element={<DepartmentPage />}
                    />
                    <Route
                      path="levels"
                      element={<LevelsPage />}
                    />
                    <Route
                      path="employees"
                      element={<UsersPage />}
                    />

                    <Route
                      path="/org/:orgId/organization/users/new"
                      element={<EmployeeDetailPage />}
                    />
                    <Route
                      path="/org/:orgId/organization/users/:employeeId"
                      element={<EmployeeDetailPage />}
                    />

                    <Route
                      path="/org/:orgId/organization/employee-competencies"
                      element={<EmployeeCompetencyMappingPage />}
                    />

                    {/* Roles list page */}
                    <Route
                      path="roles"
                      element={<RolesPage />}
                    />

                    <Route
                      path="roles/new"
                      element={<AddRolePage />}
                    />

                    <Route
                      path="roles/:roleId"
                      element={<AddRolePage />}
                    />

                    {/* Single-role skills / competency mapping */}
                    <Route
                      path="roles/:roleId/competencys"
                      element={<SkillsPage />}
                    />
                    <Route
                      path="categories"
                      element={<CategoriesPage />}
                    />

                    {/* 🔁 Competency mapping entry */}
                    <Route
                      path="surveys"
                      element={<OrgCompetencyParticipantsEntry />}
                    />

                    {/* Survey shell + tabs under surveyId */}
                    <Route
                      path="surveys/:surveyId"
                      element={<SurveyShell />}
                    >
                      <Route
                        index
                        element={<SurveyDashboardTab />}
                      />
                      <Route
                        path="participants"
                        element={<SurveyParticipantsTab />}
                      />
                      <Route
                        path="roles"
                        element={<SurveyRolesTab />}
                      />
                      <Route
                        path="analytics"
                        element={
                          <CompetencyMatrixAnalyticsOrgWise />
                        }
                      />
                    </Route>
                    <Route
                      path="surveys/:surveyId/details"
                      element={<SurveyDetailsPage />}
                    />
                  </Route>

                  {/* Org-level analytics shortcut */}
                  <Route
                    path="analytics"
                    element={<CompetencyMatrixAnalyticsOrgWise />}
                  />

                  {/* Fallback */}
                  <Route
                    path="*"
                    element={<RedirectToOrgDetails />}
                  />
                </Route>
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
