import { NavLink, Outlet } from "react-router-dom";
import { Suspense } from "react";
import { Box, Skeleton } from "@mui/material";

const links = [
  { label: "Organization Details", to: "details" },
  { label: "Departments", to: "departments" },
  { label: "Levels", to: "levels" },
  { label: "Roles and Competencies", to: "roles" },
  { label: "People", to: "employees" },
  // { label: "Competency Mapping", to: "employee-competencies" },
  { label: "Competency Analytics", to: "surveys" },
];

function OrgDetailsSkeleton() {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 900,
        mx: "auto",
        mt: 2,
      }}
    >
      <Skeleton variant="text" width="30%" height={30} sx={{ mb: 2 }} />
      <Skeleton
        variant="rectangular"
        width="100%"
        height={160}
        sx={{ mb: 2, borderRadius: 2 }}
      />
      <Skeleton
        variant="rectangular"
        width="100%"
        height={140}
        sx={{ mb: 2, borderRadius: 2 }}
      />
    </Box>
  );
}

export default function AdminOrgDetailsShell() {
  return (
    <div className="w-full flex gap-4 items-start">
      {/* Sidebar */}
      <aside
        className="glass rounded-2xl p-3 md:sticky md:top-24 md:h-max"
        style={{ minWidth: 260, maxWidth: 320 }}
      >
        <h5
          className="mb-2 text-[20px] md:text-[22px] font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          Organization Settings
        </h5>

        <hr className="opacity-30 mb-2" />

        <nav className="flex flex-col">
          {links.map((l) => {
            const isSurveys = l.to === "surveys";
            const isRoles = l.to === "roles"; // 👈 NEW

            return (
              <NavLink
                key={l.to}
                to={l.to}
                // surveys + roles should stay active for nested routes
                end={!isSurveys && !isRoles}  // 👈 UPDATED
                className={({ isActive }) =>
                  [
                    "px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-[color-mix(in_srgb,var(--logo-green)_16%,transparent)]"
                      : "hover:bg-black/5",
                  ].join(" ")
                }
                style={({ isActive }) => ({
                  color: isActive ? "var(--logo-green)" : "var(--color-text-2)",
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: "none",
                })}
              >
                {l.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Right content */}
      <section className="flex-1 min-w-0">
        <div className="w-full [&>*]:w-full">
          <Suspense fallback={<OrgDetailsSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
