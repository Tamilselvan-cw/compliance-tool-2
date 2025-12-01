import * as React from "react";
import type { Survey, EmployeeLite, SurveycompetencyRating, LevelDef } from "./types";

export type RoleDef = { id: string; name: string };
export type competency = { id: string; name: string; category?: string };
export type Rolecompetency = { role_id: string; competency_id: string };

type Store = {
  levels: LevelDef[];
  roles: RoleDef[];
  competencys: competency[];
  rolecompetencys: Rolecompetency[];
  employees: EmployeeLite[];

  surveys: Survey[];
  ratings: SurveycompetencyRating[];

  // old simple creator (kept)
  createSurvey: (s: Omit<Survey, "id" | "created_at" | "status">) => Survey;

  // new: scoped by selected role ids
  createSurveyScoped: (
    meta: Omit<Survey, "id" | "created_at" | "status">,
    selectedRoleIds: string[]
  ) => Survey;

  setRating: (surveyId: string, employeeId: string, competencyId: string, level: number | null) => void;
};

const seedLevels: LevelDef[] = [
  { id: "L1", name: "L1 – Novice", score: 1 },
  { id: "L2", name: "L2 – Beginner", score: 2 },
  { id: "L3", name: "L3 – Proficient", score: 3 },
  { id: "L4", name: "L4 – Advanced", score: 4 },
  { id: "L5", name: "L5 – Expert", score: 5 },
];

const seedRoles: RoleDef[] = [
  { id: "r-fe", name: "Frontend Engineer" },
  { id: "r-be", name: "Backend Engineer" },
  { id: "r-qa", name: "QA Engineer" },
  { id: "r-pm", name: "Product Manager" },
  { id: "r-da", name: "Data Analyst" },
];

const seedcompetencys: competency[] = [
  { id: "s-react", name: "React", category: "Frontend" },
  { id: "s-ts", name: "TypeScript", category: "Language" },
  { id: "s-css", name: "HTML/CSS & A11y", category: "Frontend" },
  { id: "s-sql", name: "SQL", category: "Data" },
  { id: "s-rest", name: "REST/GraphQL", category: "Backend" },
  { id: "s-test", name: "Testing", category: "QA" },
];

// role ⇄ competency mapping
const seedRolecompetencys: Rolecompetency[] = [
  { role_id: "r-fe", competency_id: "s-react" },
  { role_id: "r-fe", competency_id: "s-ts" },
  { role_id: "r-fe", competency_id: "s-css" },
  { role_id: "r-be", competency_id: "s-rest" },
  { role_id: "r-be", competency_id: "s-sql" },
  { role_id: "r-qa", competency_id: "s-test" },
  { role_id: "r-da", competency_id: "s-sql" },
];

// employees already mapped to roles and competencys they’re assessed on
const seedEmployees: EmployeeLite[] = [
  { id: "e1", name: "Theresa Brown", email: "theresa@acme.com", role_name: "Frontend Engineer",
    competencys: [{ id: "s-react", name: "React" }, { id: "s-ts", name: "TypeScript" }] },
  { id: "e2", name: "Roosevelt Tremblay", email: "roo@acme.com", role_name: "Backend Engineer",
    competencys: [{ id: "s-rest", name: "REST/GraphQL" }, { id: "s-sql", name: "SQL" }] },
  { id: "e3", name: "Lucia Schneider", email: "lucia@acme.com", role_name: "QA Engineer",
    competencys: [{ id: "s-test", name: "Testing" }] },
  { id: "e4", name: "Kathy McClure", email: "kathy@acme.com", role_name: "Frontend Engineer",
    competencys: [{ id: "s-react", name: "React" }, { id: "s-css", name: "HTML/CSS & A11y" }] },
];

const Ctx = React.createContext<Store | null>(null);

export function SurveyStoreProvider({ children }: { children: React.ReactNode }) {
  const [levels] = React.useState(seedLevels);
  const [roles] = React.useState(seedRoles);
  const [competencys] = React.useState(seedcompetencys);
  const [rolecompetencys] = React.useState(seedRolecompetencys);
  const [employees] = React.useState(seedEmployees);

  const [surveys, setSurveys] = React.useState<Survey[]>([]);
  const [ratings, setRatings] = React.useState<SurveycompetencyRating[]>([]);

  const createSurvey: Store["createSurvey"] = (base) => {
    const s: Survey = {
      id: "sv_" + Math.random().toString(16).slice(2, 10),
      name: base.name,
      organization_id: base.organization_id,
      created_by: base.created_by,
      created_at: new Date().toISOString(),
      status: "active",
    };
    setSurveys((prev) => [s, ...prev]);

    // seed all employees (legacy behavior)
    const seedRows: SurveycompetencyRating[] = [];
    for (const emp of employees) {
      for (const sk of emp.competencys) {
        seedRows.push({
          id: "r_" + Math.random().toString(16).slice(2, 10),
          survey_id: s.id,
          employee_id: emp.id,
          role_name: emp.role_name,
          competency_id: sk.id,
          competency_name: sk.name,
          level_score: null,
        });
      }
    }
    setRatings((prev) => [...seedRows, ...prev]);
    return s;
  };

  const createSurveyScoped: Store["createSurveyScoped"] = (meta, selectedRoleIds) => {
    const s: Survey = {
      id: "sv_" + Math.random().toString(16).slice(2, 10),
      name: meta.name,
      organization_id: meta.organization_id,
      created_by: meta.created_by,
      created_at: new Date().toISOString(),
      status: "active",
    };
    setSurveys((prev) => [s, ...prev]);

    // compute allowed competency ids by selected roles
    const allowedcompetencyIds = new Set(
      rolecompetencys.filter(rs => selectedRoleIds.includes(rs.role_id)).map(rs => rs.competency_id)
    );

    // employees whose role is in selection
    const allowedRoleNames = new Set(
      roles.filter(r => selectedRoleIds.includes(r.id)).map(r => r.name)
    );

    const seedRows: SurveycompetencyRating[] = [];
    for (const emp of employees) {
      if (!allowedRoleNames.has(emp.role_name)) continue;
      for (const sk of emp.competencys) {
        if (!allowedcompetencyIds.has(sk.id)) continue;
        seedRows.push({
          id: "r_" + Math.random().toString(16).slice(2, 10),
          survey_id: s.id,
          employee_id: emp.id,
          role_name: emp.role_name,
          competency_id: sk.id,
          competency_name: sk.name,
          level_score: null,
        });
      }
    }
    setRatings((prev) => [...seedRows, ...prev]);
    return s;
  };

  const setRating: Store["setRating"] = (surveyId, employeeId, competencyId, level) => {
    setRatings((prev) =>
      prev.map((r) =>
        r.survey_id === surveyId && r.employee_id === employeeId && r.competency_id === competencyId
          ? { ...r, level_score: level }
          : r
      )
    );
  };

  const value: Store = {
    levels, roles, competencys, rolecompetencys, employees,
    surveys, ratings,
    createSurvey, createSurveyScoped, setRating
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSurveyStore() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useSurveyStore must be used within SurveyStoreProvider");
  return ctx;
}
