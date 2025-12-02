import * as React from "react";
import { Box, Typography, Divider, Stack, Chip, Paper } from "@mui/material";
import { useParams } from "react-router-dom";
import axios from "../../../api/axiosInstance";
import { DonutProgress } from "../dashboard/components/DonutProgress";
import { SparklineWithAxes } from "../dashboard/components/SparklineWithAxes";

export default function EmployeeDetailPage() {
  const { orgId, empId } = useParams();
  const [emp, setEmp] = React.useState<any>(null);

  React.useEffect(() => {
    (async () => {
      const res = await axios.get(`/organizations/${orgId}/employees/${empId}/profile`);
      setEmp(res.data);
    })();
  }, [orgId, empId]);

  if (!emp) return "Loading...";

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        {emp.name}
      </Typography>
      <Typography variant="subtitle2" color="text.secondary">
        {emp.role} • {emp.department}
      </Typography>

      <Divider sx={{ my: 2 }} />

      {/* Personal Info */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Personal Details
      </Typography>
      <Typography>Email: {emp.email}</Typography>
      <Typography>Job Title: {emp.job_title}</Typography>

      <Divider sx={{ my: 2 }} />

      {/* Role Info */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Role Details
      </Typography>
      <Typography>Role Description: {emp.role_description ?? "—"}</Typography>

      <Divider sx={{ my: 2 }} />

      {/* competencys */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        competencys
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1} mt={1}>
        {emp.competencys?.map((s: any) => (
          <Chip
            key={s.id}
            label={`${s.name} (${s.level})`}
            color={s.is_strength ? "success" : "default"}
          />
        ))}
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* Competency Analytics */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Competency Matrix Analytics
      </Typography>

      <Stack direction="row" spacing={3} mt={1}>
        <Paper sx={{ p: 2 }}>
          <DonutProgress value={emp.analytics.overall_score} caption="Overall Score" />
        </Paper>
        <Paper sx={{ p: 2 }}>
          <SparklineWithAxes
            data={emp.analytics.trend}
            labels={["Q1","Q2","Q3","Q4"]}
            height={100}
            width={240}
          />
        </Paper>
      </Stack>

      <Typography sx={{ mt: 1.5 }}>
        Strengths: {emp.analytics.strengths.join(", ")}
      </Typography>
      <Typography>
        Improvement Areas: {emp.analytics.weaknesses.join(", ")}
      </Typography>
    </Box>
  );
}
