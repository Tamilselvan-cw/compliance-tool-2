// First-class Categories, competencys (with category_id), Role→competencys mapping,
// and Survey state including per-employee PER-competency levels.

export type LevelDef = { id: string; name: string; score: number };
export const LEVELS: LevelDef[] = [
  { id: "L1", name: "L1 – Novice",     score: 1 },
  { id: "L2", name: "L2 – Beginner",   score: 2 },
  { id: "L3", name: "L3 – Proficient", score: 3 },
  { id: "L4", name: "L4 – Advanced",   score: 4 },
  { id: "L5", name: "L5 – Expert",     score: 5 },
];

export type Category = { id: string; name: string; description?: string; order?: number };
export const CATEGORIES: Category[] = [
  { id: "c-tech",  name: "Technical",  description: "Tech stack & tooling",  order: 1 },
  { id: "c-func",  name: "Functional", description: "Domain & process",      order: 2 },
  { id: "c-behav", name: "Behavioural",description: "Soft competencys",           order: 3 },
];

export type OrgRole = { id: string; name: string };
export const ROLES: OrgRole[] = [
  { id: "r-fe", name: "Frontend Engineer" },
  { id: "r-be", name: "Backend Engineer" },
  { id: "r-qa", name: "QA Engineer" },
  { id: "r-pm", name: "Product Manager" },
];

export type competency = { id: string; name: string; category_id: string };
export const competencyS: competency[] = [
  { id: "s-react",  name: "React",            category_id: "c-tech"  },
  { id: "s-ts",     name: "TypeScript",       category_id: "c-tech"  },
  { id: "s-rest",   name: "REST/GraphQL",     category_id: "c-tech"  },
  { id: "s-domain", name: "Business Domain",  category_id: "c-func"  },
  { id: "s-req",    name: "Requirements",     category_id: "c-func"  },
  { id: "s-comm",   name: "Communication",    category_id: "c-behav" },
  { id: "s-collab", name: "Collaboration",    category_id: "c-behav" },
];

export type RolecompetencyExpectation = {
  role_id: string;
  competency_id: string;
  expected_level: number; // LEVELS.score
};

// Sample: what each role expects (you can wire this to your competencysPage later)
export const ROLE_competencyS: RolecompetencyExpectation[] = [
  { role_id: "r-fe", competency_id: "s-react",  expected_level: 4 },
  { role_id: "r-fe", competency_id: "s-ts",     expected_level: 4 },
  { role_id: "r-fe", competency_id: "s-rest",   expected_level: 3 },
  { role_id: "r-fe", competency_id: "s-comm",   expected_level: 3 },
  { role_id: "r-fe", competency_id: "s-collab", expected_level: 3 },

  { role_id: "r-be", competency_id: "s-rest",   expected_level: 4 },
  { role_id: "r-be", competency_id: "s-domain", expected_level: 3 },
  { role_id: "r-be", competency_id: "s-comm",   expected_level: 3 },

  { role_id: "r-qa", competency_id: "s-req",    expected_level: 4 },
  { role_id: "r-qa", competency_id: "s-comm",   expected_level: 3 },

  { role_id: "r-pm", competency_id: "s-domain", expected_level: 4 },
  { role_id: "r-pm", competency_id: "s-req",    expected_level: 4 },
  { role_id: "r-pm", competency_id: "s-comm",   expected_level: 4 },
  { role_id: "r-pm", competency_id: "s-collab", expected_level: 4 },
];

export type Employee = { id: string; name: string; email: string; role_id: string; };
export const EMPLOYEES: Employee[] = [
  { id: "e1", name: "Nila Devi",    email: "nila@acme.com",  role_id: "r-fe" },
  { id: "e2", name: "Ajay Kumar",   email: "ajay@acme.com",  role_id: "r-fe" },
  { id: "e3", name: "Rohit Singh",  email: "rohit@acme.com", role_id: "r-be" },
  { id: "e4", name: "Anu Priya",    email: "anu@acme.com",   role_id: "r-qa" },
  { id: "e5", name: "Meera Thomas", email: "meera@acme.com", role_id: "r-pm" },
];

export type Survey = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  role_ids: string[];

  // per-employee per-competency chosen level
  levelsBycompetency: Record<string /*employeeId*/, Record<string /*competencyId*/, number /*LEVELS.score*/>>;
};

let SURVEYS: Survey[] = [];

export const store = {
  list(): Survey[] { return SURVEYS; },
  get(id: string): Survey | undefined { return SURVEYS.find(s => s.id === id); },
  add(partial: Partial<Survey>): Survey {
    const s: Survey = {
      id: partial.id ?? ("svy_" + Math.random().toString(16).slice(2, 8)),
      name: partial.name ?? "Untitled survey",
      created_by: partial.created_by ?? "admin@tool.com",
      created_at: partial.created_at ?? new Date().toISOString(),
      role_ids: partial.role_ids ?? [],
      levelsBycompetency: partial.levelsBycompetency ?? {},
    };
    SURVEYS = [s, ...SURVEYS];
    return s;
  },
  update(id: string, patch: Partial<Survey>) {
    SURVEYS = SURVEYS.map(s => (s.id === id ? { ...s, ...patch } : s));
  },
  setRoleIds(id: string, role_ids: string[]) {
    const s = store.get(id); if (!s) return;
    s.role_ids = role_ids;
  },
  setEmployeecompetencyLevel(id: string, employeeId: string, competencyId: string, lvl: number) {
    const s = store.get(id); if (!s) return;
    if (!s.levelsBycompetency[employeeId]) s.levelsBycompetency[employeeId] = {};
    s.levelsBycompetency[employeeId][competencyId] = lvl;
  },
};

// tiny helpers
export const byId = <T extends { id: string }>(arr: T[], id?: string) => arr.find(a => a.id === id);
export const rolecompetencysFor = (role_id: string) => ROLE_competencyS.filter(r => r.role_id === role_id);
export const competencysByCategory = (competencyIds: string[]) => {
  const map: Record<string, competency[]> = {};
  for (const id of competencyIds) {
    const s = byId(competencyS, id);
    if (!s) continue;
    if (!map[s.category_id]) map[s.category_id] = [];
    map[s.category_id].push(s);
  }
  return map;
};
