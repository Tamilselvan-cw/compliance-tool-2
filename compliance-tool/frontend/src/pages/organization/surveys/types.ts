// src/pages/organization/surveys/types.ts
export type SurveyStatus = "active" | "archived";

export type LevelsMap = Record<string, Record<string, number | null>>;

export type Survey = {
  id: string;
  name: string;
  organization_id: string;
  created_by: string;
  created_at: string;     // ISO
  status: "active" | "archived";
  /** Optional map: { userId: { competencyId: levelScore|null } } */
  levels?: LevelsMap;
};

export type EmployeeLite = {
  id: string;
  name: string;
  email: string;
  role_name: string;
  competencys: { id: string; name: string }[];
};

export type SurveycompetencyRating = {
  id: string;
  survey_id: string;
  employee_id: string;
  role_name: string;
  competency_id: string;
  competency_name: string;
  level_score: number | null; // 1..5 or null
};

export type LevelDef = {
  id: string;   // e.g., "L1"
  name: string; // "L1 – Novice"
  score: number; // 1..5
};
