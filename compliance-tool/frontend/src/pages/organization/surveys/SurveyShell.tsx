// src/pages/organization/surveys/SurveyShell.tsx
import * as React from "react";
import {
  Outlet,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import {
  Box,
} from "@mui/material";
import axios from "../../../api/axiosInstance"; // adjust path if different
import { store } from "./surveysStore";

// NEW: survey-level context so Participants + Analytics can share cached data
type SurveyContextValue = {
  orgId: string;
  surveyId: string;
  // anything is fine here, we'll shape it in children
  participantsCache: any;
  setParticipantsCache: React.Dispatch<React.SetStateAction<any>>;
  analyticsCache: any;
  setAnalyticsCache: React.Dispatch<React.SetStateAction<any>>;
};

const SurveyContext = React.createContext<SurveyContextValue | null>(null);

export function useSurveyContext() {
  const ctx = React.useContext(SurveyContext);
  if (!ctx) {
    throw new Error("useSurveyContext must be used within SurveyShell");
  }
  return ctx;
}

export default function SurveyShell() {
  const { orgId = "", surveyId = "" } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const listBase = `/org/${orgId}/organization/surveys`;
  const detailBase = `${listBase}/${encodeURIComponent(surveyId)}`;

  // Cast to any so TS doesn't treat this as just {}
  const metaFromStore: any = (store.get(surveyId || "") || {}) as any;

  // 🔹 NEW: shared caches
  const [participantsCache, setParticipantsCache] = React.useState<any>(
    metaFromStore.participantsCache ?? null
  );
  const [analyticsCache, setAnalyticsCache] = React.useState<any>(
    metaFromStore.analyticsCache ?? null
  );

  React.useEffect(() => {
    if (!orgId || !surveyId) {
      navigate(listBase, { replace: true });
      return;
    }
  }, [orgId, surveyId, listBase, navigate]);

  React.useEffect(() => {
    if (pathname === detailBase || pathname === `${detailBase}/`) {
      navigate(`${detailBase}/participants`, { replace: true });
    }
  }, [pathname, detailBase, navigate]);

  // fetch survey meta (name/description/dates)
  React.useEffect(() => {
    let on = true;
    (async () => {
      if (!orgId || !surveyId) return;
      try {
        const { data } = await axios.get(
          `/organizations/${orgId}/surveys/${surveyId}`
        );
        if (!on) return;
        // sync minimal bits into store for other tabs (optional)
        store.update(
          surveyId,
          {
            name: data?.name,
            description: data?.description,
            created_at: data?.created_at,
          } as any // cast so extra fields are accepted
        );
      } catch {
        // ignore; keep store fallback
      }
    })();
    return () => {
      on = false;
    };
  }, [orgId, surveyId]);

  // listen for progress events from Participants tab
  React.useEffect(() => {
    const handler = (e: any) => {
      const pct = Math.max(0, Math.min(100, e?.detail?.percent ?? 0));
      const filled = e?.detail?.filled;
      const total = e?.detail?.total;

      if (typeof filled === "number" && typeof total === "number") {

        // cache in store so it survives tab switches / reopen
        store.update(
          surveyId,
          {
            progressPercent: pct,
            progressFilled: filled,
            progressTotal: total,
          } as any
        );
      }
    };

    window.addEventListener(
      "survey-progress-overall",
      handler as EventListener
    );
    return () =>
      window.removeEventListener(
        "survey-progress-overall",
        handler as EventListener
      );
  }, [surveyId]);

  return (
    <SurveyContext.Provider
      value={{
        orgId,
        surveyId,
        participantsCache,
        setParticipantsCache,
        analyticsCache,
        setAnalyticsCache,
      }}
    >
      {/* Body only – header card with Participants/Analytics tabs removed */}
      <Box sx={{ maxWidth: 1200, mx: "auto", px: 2.5, py: 2 }}>
        <Outlet />
      </Box>
    </SurveyContext.Provider>
  );
}
